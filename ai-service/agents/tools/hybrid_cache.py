from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

CACHE_DIR = Path(__file__).parent.parent.parent / ".emuworld" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class CacheEntry:
    key: str
    data: Any
    created_at: float
    ttl: int
    hits: int = 0

    @property
    def is_expired(self) -> bool:
        return time.time() - self.created_at > self.ttl

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "data": self.data,
            "created_at": self.created_at,
            "ttl": self.ttl,
            "hits": self.hits,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "CacheEntry":
        return cls(**d)


class HybridCache:
    DEFAULT_TTL = 3600

    def __init__(self, ttl: Optional[int] = None):
        self._ttl = ttl or self.DEFAULT_TTL
        self._entries: Dict[str, CacheEntry] = {}
        self._load()

    def _file(self, key: str) -> Path:
        safe = key.replace("/", "_").replace(":", "_")
        return CACHE_DIR / f"{safe}.json"

    def _load(self):
        for f in CACHE_DIR.glob("*.json"):
            if f.name.startswith("_"):
                continue
            try:
                data = json.loads(f.read_text())
                if "key" not in data:
                    f.unlink()
                    continue
                entry = CacheEntry.from_dict(data)
                if not entry.is_expired:
                    self._entries[entry.key] = entry
            except (json.JSONDecodeError, KeyError, TypeError):
                try:
                    f.unlink()
                except OSError:
                    pass

    def get(self, key: str) -> Optional[Any]:
        entry = self._entries.get(key)
        if entry is None:
            return None
        if entry.is_expired:
            del self._entries[key]
            return None
        entry.hits += 1
        return entry.data

    def set(self, key: str, data: Any, ttl: Optional[int] = None) -> None:
        entry = CacheEntry(
            key=key, data=data, created_at=time.time(), ttl=ttl or self._ttl
        )
        self._entries[key] = entry
        self._persist(entry)

    def _persist(self, entry: CacheEntry) -> None:
        f = self._file(entry.key)
        f.write_text(json.dumps(entry.to_dict(), default=str))

    def invalidate(self, key: str) -> bool:
        if key in self._entries:
            del self._entries[key]
            f = self._file(key)
            if f.exists():
                f.unlink()
            return True
        return False

    def stats(self) -> Dict[str, Any]:
        total = len(self._entries)
        hits = sum(e.hits for e in self._entries.values())
        return {"entries": total, "hits": hits, "ttl": self._ttl}
