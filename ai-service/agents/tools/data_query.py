from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, List, Optional

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None


@dataclass
class DataPoint:
    dataset_id: int
    date: date
    value: float
    dataset_name: str = ""
    source: str = ""
    category: str = ""


def _get_conn():
    if psycopg2 is None:
        raise RuntimeError("psycopg2 not installed. Run: pip install psycopg2-binary")
    url = os.environ.get(
        "DATABASE_URL", "postgresql://emuworld:emuworld_pass@localhost:5432/emuworld"
    )
    return psycopg2.connect(url)


def query_datasets(
    category: Optional[str] = None, source: Optional[str] = None
) -> List[Dict[str, Any]]:
    """List all datasets, optionally filtered by category or source."""
    conn = _get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        sql = "SELECT id, name, source, category, external_id, description FROM datasets WHERE 1=1"
        params: list = []
        if category:
            sql += " AND category = %s"
            params.append(category)
        if source:
            sql += " AND source = %s"
            params.append(source)
        sql += " ORDER BY category, name"
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def query_data_points(dataset_id: int, limit: int = 2000) -> List[DataPoint]:
    """Get time-series observations for a dataset."""
    conn = _get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT dp.dataset_id, dp.date, dp.value, d.name AS dataset_name, d.source, d.category
            FROM data_points dp
            JOIN datasets d ON dp.dataset_id = d.id
            WHERE dp.dataset_id = %s
            ORDER BY dp.date DESC
            LIMIT %s
            """,
            (dataset_id, limit),
        )
        return [
            DataPoint(
                dataset_id=r["dataset_id"],
                date=r["date"],
                value=r["value"],
                dataset_name=r["dataset_name"],
                source=r["source"],
                category=r["category"],
            )
            for r in cur.fetchall()
        ]
    finally:
        conn.close()


def query_by_category(
    category: str, limit_per_dataset: int = 500
) -> Dict[str, List[DataPoint]]:
    """Get latest observations for all datasets in a category."""
    conn = _get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT dp.dataset_id, dp.date, dp.value, d.name AS dataset_name, d.source, d.category
            FROM (
                SELECT dataset_id, date, value,
                       ROW_NUMBER() OVER (PARTITION BY dataset_id ORDER BY date DESC) as rn
                FROM data_points
            ) dp
            JOIN datasets d ON dp.dataset_id = d.id
            WHERE d.category = %s AND dp.rn <= %s
            ORDER BY dp.dataset_id, dp.date
            """,
            (category, limit_per_dataset),
        )
        result: Dict[str, List[DataPoint]] = {}
        for r in cur.fetchall():
            name = r["dataset_name"]
            if name not in result:
                result[name] = []
            result[name].append(
                DataPoint(
                    dataset_id=r["dataset_id"],
                    date=r["date"],
                    value=r["value"],
                    dataset_name=name,
                    source=r["source"],
                    category=r["category"],
                )
            )
        return result
    finally:
        conn.close()


def query_all_sources() -> List[Dict[str, Any]]:
    """List all registered data sources."""
    conn = _get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT id, name, display_name, enabled, description FROM data_sources ORDER BY name"
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()
