"""
Data types for the layered memory system.
"""
from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class MemoryType(enum.Enum):
    EPISODIC = "episodic"       # short-term conversation context
    SEMANTIC = "semantic"       # long-term facts, knowledge
    PROCEDURAL = "procedural"   # skills, patterns, how-to
    COGNITIVE = "cognitive"     # user preferences, values, identity


class MemorySource(enum.Enum):
    USER_CHAT = "user_chat"
    AGENT_GENERATED = "agent_generated"
    OBSERVATION = "observation"
    SYSTEM = "system"
    IMPORTED = "imported"


class LinkRelation(enum.Enum):
    RELATED_TO = "related_to"
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"
    CAUSES = "causes"
    DERIVED_FROM = "derived_from"
    SUPERSEDES = "supersedes"


@dataclass
class MemoryEntry:
    id: Optional[int] = None
    memory_type: MemoryType = MemoryType.SEMANTIC
    content: str = ""
    summary: str = ""
    tags: List[str] = field(default_factory=list)
    source: MemorySource = MemorySource.SYSTEM
    confidence: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "memory_type": self.memory_type.value,
            "content": self.content,
            "summary": self.summary,
            "tags": self.tags,
            "source": self.source.value,
            "confidence": self.confidence,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

