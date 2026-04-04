from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from ..orchestrator import Stage, PipelineState, run_pipeline
from ..orchestrator.handlers import make_handlers
from ..middlewares import (
    MiddlewareChain,
    MiddlewareContext,
    CacheMiddleware,
    AuditMiddleware,
    LoopDetectionMiddleware,
)
from ..memory import SkillRegistry


@dataclass
class LeadAgentConfig:
    auto_approve_gates: bool = True
    enable_cache: bool = True
    enable_audit: bool = True
    enable_loop_detection: bool = True
    max_loop_iterations: int = 3


class LeadAgent:
    def __init__(self, config: Optional[LeadAgentConfig] = None):
        self.config = config or LeadAgentConfig()
        self.chain = self._build_middlewares()
        self.skills = SkillRegistry()
        self._handlers = make_handlers()

    def _build_middlewares(self) -> MiddlewareChain:
        chain = MiddlewareChain()
        if self.config.enable_cache:
            chain.add(CacheMiddleware())
        if self.config.enable_audit:
            chain.add(AuditMiddleware())
        if self.config.enable_loop_detection:
            chain.add(LoopDetectionMiddleware(self.config.max_loop_iterations))
        return chain

    def analyze(
        self,
        question: str,
        category: Optional[str] = None,
        horizon_days: Optional[int] = 30,
        outcomes: Optional[List[str]] = None,
    ) -> PipelineState:
        ctx = MiddlewareContext(
            state=PipelineState(
                question=question,
                category=category,
                horizon_days=horizon_days,
                outcomes=outcomes or [],
            ),
        )

        self.chain.run_pre(ctx)

        if ctx.metadata.get("cache_hit") and ctx.metadata.get("cached_data"):
            ctx.state.data = ctx.metadata["cached_data"]

        state = run_pipeline(
            question=question,
            handlers=self._handlers,
            category=category,
            horizon_days=horizon_days,
            outcomes=outcomes or [],
            auto_approve_gates=self.config.auto_approve_gates,
        )

        ctx.state = state
        self.chain.run_post(ctx)

        audit = self.chain.get(AuditMiddleware)
        if audit:
            audit.flush()

        return state

    def available_skills(self) -> List[str]:
        return self.skills.list_ids()
