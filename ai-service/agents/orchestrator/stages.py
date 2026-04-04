from __future__ import annotations

import json
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

STATE_DIR = Path(__file__).parent.parent.parent / ".emuworld" / "state"
STATE_DIR.mkdir(parents=True, exist_ok=True)


class Stage(Enum):
    DATA_QUERY = 0
    TREND_ANALYSIS = 1
    CORRELATION = 2
    FORECAST = 3
    ANOMALY_DETECT = 4
    REPORT_GEN = 5
    QUALITY_GATE = 6


class StageStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEED = "succeed"
    FAIL = "fail"
    RETRY = "retry"
    TIMEOUT = "timeout"
    APPROVE = "approve"
    REJECT = "reject"


NEXT_STAGE: Dict[Stage, Optional[Stage]] = {
    Stage.DATA_QUERY: Stage.TREND_ANALYSIS,
    Stage.TREND_ANALYSIS: Stage.CORRELATION,
    Stage.CORRELATION: Stage.FORECAST,
    Stage.FORECAST: Stage.ANOMALY_DETECT,
    Stage.ANOMALY_DETECT: Stage.REPORT_GEN,
    Stage.REPORT_GEN: Stage.QUALITY_GATE,
    Stage.QUALITY_GATE: None,
}

GATE_STAGES = {Stage.QUALITY_GATE}
GATE_ROLLBACK: Dict[Stage, Stage] = {
    Stage.QUALITY_GATE: Stage.FORECAST,
}

MAX_RETRIES = 2
MAX_ROLLBACK_PIVOTS = 1


def advance(
    stage: Stage, status: StageStatus, rollback_count: int = 0
) -> tuple[Optional[Stage], int]:
    if status == StageStatus.SUCCEED:
        return NEXT_STAGE.get(stage), rollback_count

    if status in (StageStatus.APPROVE,):
        if stage == Stage.QUALITY_GATE:
            return None, rollback_count
        return NEXT_STAGE.get(stage), rollback_count

    if status == StageStatus.REJECT:
        target = GATE_ROLLBACK.get(stage)
        if target and rollback_count < MAX_ROLLBACK_PIVOTS:
            return target, rollback_count + 1
        return Stage.REPORT_GEN, rollback_count

    if status in (StageStatus.FAIL, StageStatus.RETRY):
        return Stage.REPORT_GEN, rollback_count

    if status == StageStatus.TIMEOUT:
        return Stage.REPORT_GEN, rollback_count

    return NEXT_STAGE.get(stage), rollback_count


@dataclass
class StageResult:
    stage: Stage
    status: StageStatus
    artifacts: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    duration_ms: float = 0
    retries: int = 0


@dataclass
class PipelineState:
    question: str
    category: Optional[str] = None
    horizon_days: Optional[int] = None
    outcomes: Optional[List[str]] = None
    data: Dict[str, Any] = field(default_factory=dict)
    analysis: Dict[str, Any] = field(default_factory=dict)
    forecast: Dict[str, Any] = field(default_factory=dict)
    report: Optional[str] = None
    stage_results: List[StageResult] = field(default_factory=list)
    started_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    rollback_count: int = 0
    current_stage: Optional[Stage] = None


def write_checkpoint(state: PipelineState) -> None:
    path = STATE_DIR / "checkpoint.json"
    data = {
        "question": state.question,
        "category": state.category,
        "horizon_days": state.horizon_days,
        "current_stage": state.current_stage.value if state.current_stage else None,
        "rollback_count": state.rollback_count,
        "stage_results": [
            {
                "stage": r.stage.value,
                "status": r.status.value,
                "error": r.error,
                "duration_ms": r.duration_ms,
                "retries": r.retries,
            }
            for r in state.stage_results
        ],
        "started_at": state.started_at,
    }
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def write_heartbeat(stage: Stage, status: str) -> None:
    path = STATE_DIR / "heartbeat.json"
    data = {
        "stage": stage.value,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pid": __import__("os").getpid(),
    }
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def write_pipeline_summary(state: PipelineState) -> None:
    path = STATE_DIR / "pipeline_summary.json"
    total_ms = sum(r.duration_ms for r in state.stage_results)
    data = {
        "question": state.question,
        "final_stage": state.stage_results[-1].stage.value
        if state.stage_results
        else None,
        "final_status": state.stage_results[-1].status.value
        if state.stage_results
        else None,
        "total_duration_ms": total_ms,
        "stages_completed": len(
            [r for r in state.stage_results if r.status == StageStatus.SUCCEED]
        ),
        "stages_failed": len(
            [
                r
                for r in state.stage_results
                if r.status in (StageStatus.FAIL, StageStatus.REJECT)
            ]
        ),
        "rollback_count": state.rollback_count,
        "started_at": state.started_at,
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
