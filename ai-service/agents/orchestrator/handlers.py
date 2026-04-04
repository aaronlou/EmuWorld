from __future__ import annotations

from typing import Any, Callable, Dict

from ..orchestrator import Stage, PipelineState
from ..tools import (
    analyze_trend,
    forecast_linear,
)
from ..tools.api_proxy import fetch_series, TimeSeriesPoint


def make_handlers() -> Dict[Stage, Callable[[PipelineState], Dict[str, Any]]]:
    return {
        Stage.DATA_QUERY: _handle_data_query,
        Stage.TREND_ANALYSIS: _handle_trend_analysis,
        Stage.CORRELATION: _handle_correlation,
        Stage.FORECAST: _handle_forecast,
        Stage.ANOMALY_DETECT: _handle_anomaly_detect,
        Stage.REPORT_GEN: _handle_report_gen,
        Stage.QUALITY_GATE: _handle_quality_gate,
    }


def _handle_data_query(state: PipelineState) -> Dict[str, Any]:
    from ..tools.api_proxy import fetch_series, TimeSeriesPoint

    data = {}
    targets = [
        ("world_bank", "NY.GDP.MKTP.CD"),
        ("world_bank", "FP.CPI.TOTL.ZG"),
    ]

    for src, sid in targets:
        try:
            result = fetch_series(src, sid)
            if not result.error and result.points:
                data[sid] = result.points
        except Exception:
            pass

    data_summary = {name: len(pts) for name, pts in data.items()}
    return {"data": data, "data_summary": data_summary}


def _handle_trend_analysis(state: PipelineState) -> Dict[str, Any]:
    data = state.data
    if not data:
        return {"analysis": {}, "trend_summary": "No data available for analysis"}

    trends = {}
    for name, pts in data.items():
        if len(pts) >= 2:
            t = analyze_trend(pts)
            trends[name] = {
                "direction": t.trend_direction,
                "current": t.current_value,
                "yoy_change": t.yoy_change,
                "mom_change": t.mom_change,
                "ma_3": t.ma_3,
                "ma_6": t.ma_6,
                "ma_12": t.ma_12,
            }

    return {"analysis": trends}


def _handle_correlation(state: PipelineState) -> Dict[str, Any]:
    data = state.data
    if len(data) < 2:
        return {"correlations": {}, "note": "Need 2+ datasets for correlation"}

    correlations = {}
    names = list(data.keys())
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            key = f"{names[i]} vs {names[j]}"
            pts_a = data[names[i]]
            pts_b = data[names[j]]
            correlations[key] = _pearson(pts_a, pts_b)

    return {"correlations": correlations}


def _pearson(a_pts, b_pts):
    n = min(len(a_pts), len(b_pts))
    if n < 3:
        return None
    a_vals = [p.value for p in a_pts[-n:]]
    b_vals = [p.value for p in b_pts[-n:]]
    mean_a = sum(a_vals) / n
    mean_b = sum(b_vals) / n
    num = sum((a - mean_a) * (b - mean_b) for a, b in zip(a_vals, b_vals))
    den_a = sum((a - mean_a) ** 2 for a in a_vals) ** 0.5
    den_b = sum((b - mean_b) ** 2 for b in b_vals) ** 0.5
    if den_a == 0 or den_b == 0:
        return None
    return round(num / (den_a * den_b), 4)


def _handle_forecast(state: PipelineState) -> Dict[str, Any]:
    data = state.data
    horizon = state.horizon_days or 30

    forecasts = {}
    for name, pts in data.items():
        if len(pts) < 5:
            continue
        result = forecast_linear(pts, horizon=min(horizon, len(pts)))
        forecasts[name] = {
            "method": result.method,
            "trend": result.trend,
            "predictions": result.predictions[:horizon],
            "confidence_lower": result.confidence_lower[:horizon],
            "confidence_upper": result.confidence_upper[:horizon],
        }

    return {"forecast": forecasts}


def _handle_anomaly_detect(state: PipelineState) -> Dict[str, Any]:
    data = state.data
    anomalies = {}

    for name, pts in data.items():
        if len(pts) < 5:
            continue
        values = [p.value for p in pts]
        mean = sum(values) / len(values)
        std = (sum((v - mean) ** 2 for v in values) / len(values)) ** 0.5
        if std == 0:
            continue
        detected = []
        for p in pts:
            z = abs(p.value - mean) / std
            if z > 2.5:
                detected.append(
                    {"date": str(p.date), "value": p.value, "z_score": round(z, 2)}
                )
        if detected:
            anomalies[name] = detected

    return {"anomalies": anomalies}


def _handle_report_gen(state: PipelineState) -> Dict[str, Any]:
    sections = []
    sections.append(f"# Analysis Report: {state.question}\n")

    if state.data:
        sections.append("## Data Overview\n")
        for name, pts in state.data.items():
            sections.append(f"- **{name}**: {len(pts)} observations\n")

    if state.analysis:
        sections.append("## Trend Analysis\n")
        for name, info in state.analysis.items():
            direction = info.get("direction", "unknown")
            sections.append(f"- **{name}**: trending {direction}")
            if info.get("yoy_change") is not None:
                sections.append(f" (YoY: {info['yoy_change']}%)")
            sections.append("\n")

    if state.forecast:
        sections.append("## Forecast\n")
        for name, fc in state.forecast.items():
            sections.append(f"- **{name}**: {fc['trend']} trend ({fc['method']})\n")

    if state.data.get("correlations"):
        sections.append("## Correlations\n")
        for pair, corr in state.data["correlations"].items():
            if corr is not None:
                sections.append(f"- **{pair}**: r = {corr}\n")

    if state.data.get("anomalies"):
        sections.append("## Anomalies\n")
        for name, items in state.data["anomalies"].items():
            sections.append(f"- **{name}**: {len(items)} anomalies detected\n")

    report = "\n".join(sections)
    return {"report": report}


def _handle_quality_gate(state: PipelineState) -> Dict[str, Any]:
    if state.report and len(state.report) > 50:
        return {"gate_status": "approved"}
    return {"gate_status": "rejected", "reason": "Report too short or missing"}
