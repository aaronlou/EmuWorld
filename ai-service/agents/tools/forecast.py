from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .data_query import DataPoint


@dataclass
class ForecastResult:
    dataset_name: str
    predictions: List[Dict[str, Any]]
    confidence_lower: List[float]
    confidence_upper: List[float]
    method: str
    trend: str


def _linear_regression(values: List[float]) -> tuple[float, float]:
    """Simple linear regression: returns (slope, intercept)."""
    n = len(values)
    if n < 2:
        return 0.0, values[0] if values else 0.0
    x_mean = (n - 1) / 2
    y_mean = sum(values) / n
    num = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    den = sum((i - x_mean) ** 2 for i in range(n))
    if den == 0:
        return 0.0, y_mean
    slope = num / den
    intercept = y_mean - slope * x_mean
    return slope, intercept


def _residual_std(values: List[float], slope: float, intercept: float) -> float:
    n = len(values)
    if n < 3:
        return 0.0
    ss = sum((v - (slope * i + intercept)) ** 2 for i, v in enumerate(values))
    return math.sqrt(ss / (n - 2))


def forecast_linear(
    points: List[DataPoint],
    horizon: int = 30,
) -> ForecastResult:
    """Linear regression forecast with confidence intervals."""
    if not points:
        raise ValueError("No data points provided")

    sorted_points = sorted(points, key=lambda p: p.date)
    values = [p.value for p in sorted_points]

    slope, intercept = _linear_regression(values)
    residual_std = _residual_std(values, slope, intercept)

    last_value = values[-1]
    n = len(values)

    predictions = []
    conf_lower = []
    conf_upper = []

    for i in range(horizon):
        x = n + i
        pred = slope * x + intercept
        margin = (
            1.96
            * residual_std
            * math.sqrt(
                1
                + 1 / n
                + (x - (n - 1) / 2) ** 2
                / max(sum((j - (n - 1) / 2) ** 2 for j in range(n)), 1)
            )
        )
        predictions.append(pred)
        conf_lower.append(pred - margin)
        conf_upper.append(pred + margin)

    trend = "up" if slope > 0.001 else ("down" if slope < -0.001 else "stable")

    return ForecastResult(
        dataset_name=points[0].dataset_name,
        predictions=[
            {"step": i + 1, "value": round(v, 4)} for i, v in enumerate(predictions)
        ],
        confidence_lower=[round(v, 4) for v in conf_lower],
        confidence_upper=[round(v, 4) for v in conf_upper],
        method="linear_regression",
        trend=trend,
    )


def forecast_monte_carlo(
    points: List[DataPoint],
    horizon: int = 30,
    simulations: int = 10000,
) -> ForecastResult:
    """Monte Carlo forecast based on historical volatility."""
    import random

    if not points:
        raise ValueError("No data points provided")

    sorted_points = sorted(points, key=lambda p: p.date)
    values = [p.value for p in sorted_points]

    if len(values) < 2:
        return ForecastResult(
            dataset_name=points[0].dataset_name,
            predictions=[{"step": i + 1, "value": values[0]} for i in range(horizon)],
            confidence_lower=[values[0]] * horizon,
            confidence_upper=[values[0]] * horizon,
            method="monte_carlo",
            trend="stable",
        )

    returns = [
        (values[i] - values[i - 1]) / max(abs(values[i - 1]), 1e-9)
        for i in range(1, len(values))
    ]
    mean_return = sum(returns) / len(returns)
    std_return = (sum((r - mean_return) ** 2 for r in returns) / len(returns)) ** 0.5

    last_value = values[-1]
    sim_paths = []

    for _ in range(simulations):
        path = [last_value]
        for _ in range(horizon):
            step = random.gauss(mean_return, std_return)
            path.append(path[-1] * (1 + step))
        sim_paths.append(path[1:])

    predictions = []
    conf_lower = []
    conf_upper = []

    for i in range(horizon):
        step_values = sorted([path[i] for path in sim_paths])
        median = step_values[len(step_values) // 2]
        lower = step_values[int(len(step_values) * 0.025)]
        upper = step_values[int(len(step_values) * 0.975)]
        predictions.append({"step": i + 1, "value": round(median, 4)})
        conf_lower.append(round(lower, 4))
        conf_upper.append(round(upper, 4))

    trend = (
        "up" if mean_return > 0.001 else ("down" if mean_return < -0.001 else "stable")
    )

    return ForecastResult(
        dataset_name=points[0].dataset_name,
        predictions=predictions,
        confidence_lower=conf_lower,
        confidence_upper=conf_upper,
        method="monte_carlo",
        trend=trend,
    )
