"""
Memory store — PostgreSQL-backed layered memory system.

Provides write, search, retrieve, and link operations across
episodic / semantic / procedural / cognitive memory types.
Uses PostgreSQL full-text search for retrieval (pgvector reserved for future).
"""
from __future__ import annotations

import json
import os
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from contextlib import contextmanager

import psycopg2
import psycopg2.extras

from .types import MemoryEntry, MemorySource, MemoryType, LinkRelation

logger = logging.getLogger("emuworld.memory")

# ── Connection ───────────────────────────────────────────────

_DATABASE_URL = os.getenv("DATABASE_URL", "")

def _parse_dsn(url: str) -> dict:
    if not url:
        return {}
    # postgresql://user:pass@host:port/dbname → psycopg2 DSN
    url = url.replace("postgresql://", "")
    user_pass, rest = url.split("@", 1)
    user, _, password = user_pass.partition(":")
    host_port, dbname = rest.split("/", 1)
    host, _, port = host_port.partition(":")
    return {
        "dbname": dbname,
        "user": user,
        "password": password,
        "host": host,
        "port": int(port) if port else 5432,
        "options": "-c timezone=UTC",
    }

_POOL: dict = {}  # simple connection memoization per-thread

def _get_conn():
    import threading
    tid = threading.current_thread().ident
    if tid not in _POOL or _POOL[tid] is None:
        try:
            dsn = _parse_dsn(_DATABASE_URL)
            if not dsn:
                # Fallback defaults
                dsn = {
                    "dbname": "emuworld",
                    "user": "emuworld",
                    "password": "emuworld_pass",
                    "host": "localhost",
                    "port": 5432,
                }
            # Add connection timeout to prevent hanging on Python 3.14 / network issues
            dsn['connect_timeout'] = 5
            conn = psycopg2.connect(**dsn)
            conn.autocommit = True
            _POOL[tid] = conn
        except Exception:
            logger.warning("memory: cannot connect to PostgreSQL, store disabled")
            return None
    return _POOL[tid]


def _row_to_entry(row) -> MemoryEntry:
    """Convert psycopg2 dict row to MemoryEntry."""
    return MemoryEntry(
        id=row["id"],
        memory_type=MemoryType(row["memory_type"]),
        content=row["content"],
        summary=row["summary"],
        tags=row["tags"] or [],
        source=MemorySource(row["source"]) if row["source"] else MemorySource.SYSTEM,
        confidence=row["confidence"],
        metadata=row["metadata"] or {},
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


# ── Core API ─────────────────────────────────────────────────

class MemoryStore:
    """Unified interface to the PostgreSQL memory tables."""

    def __init__(self):
        self._connected = _DATABASE_URL is not None

    def write(
        self,
        memory_type: MemoryType,
        content: str,
        summary: str = "",
        tags: Optional[List[str]] = None,
        source: MemorySource = MemorySource.SYSTEM,
        confidence: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[int]:
        conn = _get_conn()
        if not conn:
            logger.warning("memory.write: no DB connection")
            return None
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO memory_entries
                        (memory_type, content, summary, tags, source, confidence, metadata)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        memory_type.value,
                        content,
                        summary or content[:200],
                        tags or [],
                        source.value,
                        confidence,
                        json.dumps(metadata or {}),
                    ),
                )
                row = cur.fetchone()
                logger.info(
                    "memory.write: %s id=%s tags=%s", memory_type.value, row["id"], tags
                )
                return row["id"]
        except Exception:
            logger.exception("memory.write: error")
            return None

    def update_confidence(self, entry_id: int, confidence: float) -> bool:
        conn = _get_conn()
        if not conn:
            return False
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE memory_entries SET confidence=%s, updated_at=NOW() WHERE id=%s",
                    (round(confidence, 3), entry_id),
                )
            return True
        except Exception:
            logger.exception("memory.update_confidence: error")
            return False

    def search(
        self,
        query: str,
        memory_type: Optional[MemoryType] = None,
        tags: Optional[List[str]] = None,
        top_k: int = 5,
    ) -> List[MemoryEntry]:
        """Full-text search over content + summary.
        Returns entries sorted by relevance (ts_rank).
        """
        conn = _get_conn()
        if not conn:
            return []
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                sql = """
                    SELECT *, ts_rank(
                        to_tsvector('simple', content || ' ' || summary),
                        plainto_tsquery('simple', %s)
                    ) AS rank
                    FROM memory_entries
                    WHERE to_tsvector('simple', content || ' ' || summary)
                          @@ plainto_tsquery('simple', %s)
                """
                params = [query, query]

                if memory_type:
                    sql += " AND memory_type = %s"
                    params.append(memory_type.value)

                if tags:
                    sql += " AND tags && %s"
                    params.append(tags)

                sql += " ORDER BY rank DESC, confidence DESC, created_at DESC LIMIT %s"
                params.append(top_k)

                cur.execute(sql, params)
                rows = cur.fetchall()
                return [_row_to_entry(r) for r in rows]
        except Exception:
            logger.exception("memory.search: error")
            return []

    def get_recent(
        self,
        memory_type: MemoryType,
        limit: int = 10,
    ) -> List[MemoryEntry]:
        conn = _get_conn()
        if not conn:
            return []
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT * FROM memory_entries
                    WHERE memory_type = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (memory_type.value, limit),
                )
                return [_row_to_entry(r) for r in cur.fetchall()]
        except Exception:
            logger.exception("memory.get_recent: error")
            return []

    def get_by_id(self, entry_id: int) -> Optional[MemoryEntry]:
        conn = _get_conn()
        if not conn:
            return None
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM memory_entries WHERE id = %s", (entry_id,)
                )
                row = cur.fetchone()
                return _row_to_entry(row) if row else None
        except Exception:
            logger.exception("memory.get_by_id: error")
            return None

    def link(
        self,
        source_id: int,
        target_id: int,
        relation: LinkRelation,
    ) -> Optional[int]:
        conn = _get_conn()
        if not conn:
            return None
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO memory_links (source_id, target_id, relation)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (source_id, target_id, relation) DO NOTHING
                    RETURNING id
                    """,
                    (source_id, target_id, relation.value),
                )
                row = cur.fetchone()
                if row:
                    logger.info(
                        "memory.link: %d →%s %d", source_id, relation.value, target_id
                    )
                    return row["id"]
                return None  # conflict
        except Exception:
            logger.exception("memory.link: error")
            return None

    def get_links(self, entry_id: int) -> List[dict]:
        conn = _get_conn()
        if not conn:
            return []
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT ml.*, m2.content AS target_content
                    FROM memory_links ml
                    JOIN memory_entries m2 ON m2.id = ml.target_id
                    WHERE ml.source_id = %s
                    ORDER BY ml.created_at DESC
                    """,
                    (entry_id,),
                )
                return [dict(r) for r in cur.fetchall()]
        except Exception:
            logger.exception("memory.get_links: error")
            return []

    def delete(self, entry_id: int) -> bool:
        conn = _get_conn()
        if not conn:
            return False
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM memory_entries WHERE id = %s", (entry_id,)
                )
            return True
        except Exception:
            logger.exception("memory.delete: error")
            return False


# ── Singleton ────────────────────────────────────────────────

_memory_store: Optional[MemoryStore] = None

def get_memory_store() -> MemoryStore:
    global _memory_store
    if _memory_store is None:
        _memory_store = MemoryStore()
    return _memory_store
