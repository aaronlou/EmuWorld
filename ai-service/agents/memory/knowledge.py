from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import json

KB_DIR = Path(__file__).parent.parent.parent / ".emuworld" / "knowledge"
KB_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class PredictionRecord:
    question: str
    category: Optional[str]
    horizon_days: int
    predicted_outcome: str
    actual_outcome: Optional[str] = None
    confidence: Optional[float] = None
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    evaluated_at: Optional[str] = None


class PredictionHistory:
    def __init__(self):
        self._file = KB_DIR / "predictions.jsonl"
        self._file.touch(exist_ok=True)

    def record(self, pred: PredictionRecord) -> None:
        with open(self._file, "a") as f:
            f.write(json.dumps(pred.__dict__) + "\n")

    def get_all(self) -> List[PredictionRecord]:
        records = []
        if not self._file.exists():
            return records
        with open(self._file) as f:
            for line in f:
                line = line.strip()
                if line:
                    data = json.loads(line)
                    records.append(PredictionRecord(**data))
        return records

    def accuracy(self) -> Optional[float]:
        records = self.get_all()
        evaluated = [r for r in records if r.actual_outcome is not None]
        if not evaluated:
            return None
        correct = sum(1 for r in evaluated if r.predicted_outcome == r.actual_outcome)
        return round(correct / len(evaluated) * 100, 1)


class CostTracker:
    def __init__(self):
        self._file = KB_DIR / "costs.jsonl"
        self._file.touch(exist_ok=True)
        self._llm_calls = 0
        self._data_api_calls = 0
        self._total_tokens = 0

    def record_llm_call(self, tokens: int = 0, cost: float = 0.0) -> None:
        self._llm_calls += 1
        self._total_tokens += tokens
        self._write("llm_call", tokens=tokens, cost=cost)

    def record_data_api_call(self, source: str = "", cost: float = 0.0) -> None:
        self._data_api_calls += 1
        self._write("data_api_call", source=source, cost=cost)

    def _write(self, event_type: str, **kwargs) -> None:
        entry = {
            "type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **kwargs,
        }
        with open(self._file, "a") as f:
            f.write(json.dumps(entry) + "\n")

    def summary(self) -> Dict[str, Any]:
        return {
            "llm_calls": self._llm_calls,
            "data_api_calls": self._data_api_calls,
            "total_tokens": self._total_tokens,
        }
