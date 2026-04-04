from __future__ import annotations

from typing import Any, Dict, List, Optional

from .api_proxy import fetch_series, SeriesData
from .hybrid_cache import HybridCache
from .data_query import query_data_points, query_by_category


_cache = HybridCache(ttl=3600)


def fetch_hybrid(
    source: str,
    series_id: str,
    category: Optional[str] = None,
    use_cache: bool = True,
    use_db: bool = True,
    use_api: bool = True,
    **kwargs,
) -> Dict[str, Any]:
    cache_key = f"{source}:{series_id}"

    if use_cache:
        cached = _cache.get(cache_key)
        if cached is not None:
            return {"source": "cache", "data": cached, "cache_key": cache_key}

    if use_db:
        if category:
            pts_by_ds = query_by_category(category)
            if pts_by_ds:
                result = {
                    name: [{"date": str(p.date), "value": p.value} for p in pts]
                    for name, pts in pts_by_ds.items()
                }
                if use_cache:
                    _cache.set(cache_key, result)
                return {"source": "database", "data": result}
        else:
            try:
                from .data_query import query_datasets

                datasets = query_datasets(source=source)
                if datasets:
                    ds = datasets[0]
                    pts = query_data_points(ds["id"])
                    if pts:
                        result = [{"date": str(p.date), "value": p.value} for p in pts]
                        if use_cache:
                            _cache.set(cache_key, result)
                        return {"source": "database", "data": result}
            except Exception:
                pass

    if use_api:
        result = fetch_series(source, series_id, **kwargs)
        if result.error:
            return {"source": "api", "data": None, "error": result.error}
        data = [{"date": p.date, "value": p.value} for p in result.points]
        if use_cache:
            _cache.set(cache_key, data)
        return {"source": "api", "data": data, "series_name": result.name}

    return {"source": "none", "data": None, "error": "All sources unavailable"}


def cache_stats() -> Dict[str, Any]:
    return _cache.stats()


def invalidate_cache(key: str) -> bool:
    return _cache.invalidate(key)
