from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
import time

from ..orchestrator import PipelineState


@dataclass
class MiddlewareContext:
    state: PipelineState
    metadata: Dict[str, Any] = field(default_factory=dict)


class Middleware(ABC):
    @abstractmethod
    def pre_execute(self, ctx: MiddlewareContext) -> None: ...

    @abstractmethod
    def post_execute(self, ctx: MiddlewareContext) -> None: ...


class CacheMiddleware(Middleware):
    def __init__(self, cache_dir=None):
        from pathlib import Path

        self._cache_dir = (
            cache_dir or Path(__file__).parent.parent.parent / ".emuworld" / "cache"
        )
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        self._hits = 0
        self._misses = 0

    def pre_execute(self, ctx: MiddlewareContext) -> None:
        import json

        key = f"{ctx.state.question}_{ctx.state.category}"
        cache_file = self._cache_dir / f"{hash(key)}.json"
        if cache_file.exists():
            data = json.loads(cache_file.read_text())
            ctx.metadata["cache_hit"] = True
            ctx.metadata["cached_data"] = data
            self._hits += 1
        else:
            ctx.metadata["cache_hit"] = False
            self._misses += 1

    def post_execute(self, ctx: MiddlewareContext) -> None:
        import json

        if not ctx.metadata.get("cache_hit") and ctx.state.data:
            key = f"{ctx.state.question}_{ctx.state.category}"
            cache_file = self._cache_dir / f"{hash(key)}.json"
            cache_file.write_text(json.dumps(ctx.state.data, default=str))


class AuditMiddleware(Middleware):
    def __init__(self):
        from pathlib import Path

        self._audit_dir = Path(__file__).parent.parent.parent / ".emuworld" / "audit"
        self._audit_dir.mkdir(parents=True, exist_ok=True)
        self._log: List[Dict[str, Any]] = []

    def pre_execute(self, ctx: MiddlewareContext) -> None:
        entry = {
            "event": "pre_execute",
            "stage": ctx.state.current_stage.value if ctx.state.current_stage else None,
            "timestamp": time.time(),
        }
        self._log.append(entry)

    def post_execute(self, ctx: MiddlewareContext) -> None:
        entry = {
            "event": "post_execute",
            "stage": ctx.state.current_stage.value if ctx.state.current_stage else None,
            "timestamp": time.time(),
            "stage_results_count": len(ctx.state.stage_results),
        }
        self._log.append(entry)

    def flush(self) -> None:
        import json
        from datetime import datetime, timezone

        path = (
            self._audit_dir
            / f"decisions_{datetime.now(timezone.utc).strftime('%Y%m%d')}.log"
        )
        with open(path, "a") as f:
            for entry in self._log:
                f.write(json.dumps(entry) + "\n")
        self._log.clear()


class LoopDetectionMiddleware(Middleware):
    def __init__(self, max_loops: int = 3):
        self._max_loops = max_loops
        self._stage_counts: Dict[str, int] = {}

    def pre_execute(self, ctx: MiddlewareContext) -> None:
        stage_name = (
            ctx.state.current_stage.value if ctx.state.current_stage else "unknown"
        )
        self._stage_counts[stage_name] = self._stage_counts.get(stage_name, 0) + 1
        if self._stage_counts[stage_name] > self._max_loops:
            ctx.metadata["loop_detected"] = True
            ctx.metadata["loop_stage"] = stage_name

    def post_execute(self, ctx: MiddlewareContext) -> None:
        pass


class MiddlewareChain:
    def __init__(self):
        self._middlewares: List[Middleware] = []

    def add(self, mw: Middleware) -> "MiddlewareChain":
        self._middlewares.append(mw)
        return self

    def run_pre(self, ctx: MiddlewareContext) -> None:
        for mw in self._middlewares:
            mw.pre_execute(ctx)

    def run_post(self, ctx: MiddlewareContext) -> None:
        for mw in self._middlewares:
            mw.post_execute(ctx)

    def get(self, cls_type: type) -> Optional[Middleware]:
        for mw in self._middlewares:
            if isinstance(mw, cls_type):
                return mw
        return None
