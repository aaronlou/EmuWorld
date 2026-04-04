from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Protocol


class HasDateValue(Protocol):
    date: Any
    value: float


@dataclass
class TrendResult:
    dataset_name: str
    current_value: float
    previous_value: Optional[float]
    yoy_change: Optional[float]
    mom_change: Optional[float]
    ma_3: Optional[float]
    ma_6: Optional[float]
    ma_12: Optional[float]
    trend_direction: str
    data_points: List[Any]


def _moving_average(values: List[float], window: int) -> Optional[float]:
    if len(values) < window:
        return None
    return sum(values[-window:]) / window


def _pct_change(current: float, previous: float) -> Optional[float]:
    if previous == 0:
        return None
    return round((current - previous) / abs(previous) * 100, 2)


def analyze_trend(points: List[HasDateValue]) -> TrendResult:
    if not points:
        raise ValueError("No data points provided")

    sorted_points = sorted(points, key=lambda p: p.date)
    values = [p.value for p in sorted_points]
    current = values[-1]

    previous = values[-2] if len(values) >= 2 else None
    yoy_value = values[-13] if len(values) >= 13 else None
    mom_value = values[-2] if len(values) >= 2 else None

    ma_3 = _moving_average(values, 3)
    ma_6 = _moving_average(values, 6)
    ma_12 = _moving_average(values, 12)

    yoy_change = _pct_change(current, yoy_value) if yoy_value is not None else None
    mom_change = _pct_change(current, mom_value) if mom_value is not None else None

    if ma_3 is not None and ma_6 is not None:
        if ma_3 > ma_6 * 1.01:
            direction = "up"
        elif ma_3 < ma_6 * 0.99:
            direction = "down"
        else:
            direction = "stable"
    else:
        direction = "stable"

    name = getattr(points[0], "dataset_name", "")
    return TrendResult(
        dataset_name=name,
        current_value=current,
        previous_value=previous,
        yoy_change=yoy_change,
        mom_change=mom_change,
        ma_3=round(ma_3, 4) if ma_3 else None,
        ma_6=round(ma_6, 4) if ma_6 else None,
        ma_12=round(ma_12, 4) if ma_12 else None,
        trend_direction=direction,
        data_points=sorted_points[-24:],
    )


def analyze_category_trends(
    points_by_dataset: Dict[str, List[HasDateValue]],
) -> Dict[str, TrendResult]:
    return {
        name: analyze_trend(pts)
        for name, pts in points_by_dataset.items()
        if len(pts) >= 2
    }
