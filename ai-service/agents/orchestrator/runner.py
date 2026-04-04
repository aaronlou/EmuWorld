from __future__ import annotations

import time
import traceback
from typing import Any, Callable, Dict, Optional

from .stages import (
    MAX_RETRIES,
    Stage,
    StageResult,
    StageStatus,
    PipelineState,
    advance,
    write_checkpoint,
    write_heartbeat,
    write_pipeline_summary,
)


class StageExecutor:
    def __init__(
        self, handlers: Dict[Stage, Callable[[PipelineState], Dict[str, Any]]]
    ):
        self._handlers = handlers

    def execute(self, stage: Stage, state: PipelineState) -> StageResult:
        handler = self._handlers.get(stage)
        if handler is None:
            return StageResult(
                stage=stage,
                status=StageStatus.FAIL,
                error=f"No handler for {stage.value}",
            )

        start = time.monotonic()
        write_heartbeat(stage, "running")

        try:
            artifacts = handler(state)
            duration = (time.monotonic() - start) * 1000
            return StageResult(
                stage=stage,
                status=StageStatus.SUCCEED,
                artifacts=artifacts,
                duration_ms=duration,
            )
        except Exception as e:
            duration = (time.monotonic() - start) * 1000
            return StageResult(
                stage=stage, status=StageStatus.FAIL, error=str(e), duration_ms=duration
            )


def run_pipeline(
    question: str,
    handlers: Dict[Stage, Callable[[PipelineState], Dict[str, Any]]],
    category: Optional[str] = None,
    horizon_days: Optional[int] = None,
    outcomes: Optional[list[str]] = None,
    auto_approve_gates: bool = True,
) -> PipelineState:
    state = PipelineState(
        question=question,
        category=category,
        horizon_days=horizon_days,
        outcomes=outcomes or [],
    )

    executor = StageExecutor(handlers)
    current = Stage.DATA_QUERY
    state.current_stage = current

    while current is not None:
        state.current_stage = current
        result = executor.execute(current, state)

        retries = 0
        while result.status == StageStatus.FAIL and retries < MAX_RETRIES:
            retries += 1
            result = executor.execute(current, state)
            result.retries = retries

        state.stage_results.append(result)

        if result.status == StageStatus.SUCCEED and result.artifacts:
            for key, value in result.artifacts.items():
                if key in ("data", "analysis", "forecast", "report"):
                    setattr(state, key, value)

        next_stage, rollback_count = advance(
            current, result.status, state.rollback_count
        )
        state.rollback_count = rollback_count
        current = next_stage
        state.current_stage = current

        write_checkpoint(state)

    write_pipeline_summary(state)
    return state
