from __future__ import annotations

import json
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional


@dataclass
class TimeSeriesPoint:
    date: str
    value: float


@dataclass
class SeriesData:
    id: str
    name: str
    source: str
    points: List[TimeSeriesPoint] = field(default_factory=list)
    error: Optional[str] = None


def _fetch_json(
    url: str, headers: Optional[Dict[str, str]] = None, timeout: int = 15
) -> Any:
    req = urllib.request.Request(url)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def fetch_fred_series(series_id: str, api_key: str = "demo") -> SeriesData:
    url = f"https://api.stlouisfed.org/fred/series/observations?series_id={series_id}&api_key={api_key}&file_type=json"
    data = _fetch_json(url)
    obs = data.get("observations", [])
    points = []
    for o in obs:
        try:
            points.append(TimeSeriesPoint(date=o["date"], value=float(o["value"])))
        except (ValueError, KeyError):
            continue
    return SeriesData(id=series_id, name=series_id, source="fred", points=points)


def fetch_world_bank_series(
    indicator_id: str, country: str = "all", years: str = "2000:2030"
) -> SeriesData:
    url = f"https://api.worldbank.org/v2/country/{country}/indicator/{indicator_id}?format=json&per_page=1000&date={years}"
    pages = _fetch_json(url)
    indicators = pages[1] if len(pages) > 1 else []
    points = []
    name = ""
    for ind in indicators:
        if not name and ind.get("indicator", {}).get("value"):
            name = ind["indicator"]["value"]
        try:
            year = ind.get("date", "")
            val = ind.get("value")
            if year and val is not None:
                points.append(TimeSeriesPoint(date=f"{year}-12-31", value=float(val)))
        except (ValueError, TypeError):
            continue
    points.sort(key=lambda p: p.date)
    return SeriesData(id=indicator_id, name=name, source="world_bank", points=points)


def fetch_imf_series(flow_id: str) -> SeriesData:
    url = f"https://sdmxcentral.imf.org/ws/public/sdmxapi/rest/data/{flow_id}/all?format=compactdata"
    raw = _fetch_json(url)
    ds = raw.get("data", {}).get("dataSets", [{}])[0]
    obs_list = ds.get("observations", {})
    series = ds.get("series", {})
    points = []
    name = flow_id
    for series_key, series_meta in series.items():
        name = series_meta.get("name", flow_id)
        obs = obs_list.get(series_key, [])
        for obs_item in obs:
            try:
                time_dim = obs_item.get("timePeriod", "")
                obs_val = float(obs_item.get("obsValue", {}).get("value", 0))
                points.append(TimeSeriesPoint(date=time_dim, value=obs_val))
            except (ValueError, TypeError, KeyError):
                continue
    points.sort(key=lambda p: p.date)
    return SeriesData(id=flow_id, name=name, source="imf", points=points)


def fetch_oecd_series(dataset_id: str) -> SeriesData:
    url = f"https://stats.oecd.org/sdmx-json/data/{dataset_id}/all"
    data = _fetch_json(url)
    points = []
    name = dataset_id
    ds = data.get("dataSets", [{}])[0]
    series = ds.get("series", {})
    obs = ds.get("observations", {})
    for series_key in series:
        obs_list = obs.get(series_key, {})
        for time_idx, val_list in obs_list.items():
            try:
                value = float(val_list[0])
                points.append(TimeSeriesPoint(date=str(time_idx), value=value))
            except (ValueError, TypeError, KeyError):
                continue
    points.sort(key=lambda p: p.date)
    return SeriesData(id=dataset_id, name=name, source="oecd", points=points)


def fetch_eurostat_series(dataset_id: str) -> SeriesData:
    url = f"https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/{dataset_id}?format=JSONv2.0"
    data = _fetch_json(url)
    points = []
    name = dataset_id
    ds = data.get("data", {}).get("dataSets", [{}])[0]
    obs_list = ds.get("observations", {})
    series = ds.get("series", {})
    for series_key in series:
        obs = obs_list.get(series_key, {})
        for time_idx, val_list in obs.items():
            try:
                value = float(val_list[0])
                points.append(TimeSeriesPoint(date=str(time_idx), value=value))
            except (ValueError, TypeError, KeyError):
                continue
    points.sort(key=lambda p: p.date)
    return SeriesData(id=dataset_id, name=name, source="eurostat", points=points)


def fetch_nbs_series(code: str) -> SeriesData:
    url = f"https://data.stats.gov.cn/easyquery.htm?m=QueryData&dbcode=hgnd&rowcode=sj&colcode=zj&wds=%5B%5D&dfwds=%5B%7B%22wdcode%22%3A%22zb%22%2C%22valuecode%22%3A%22{code}%22%7D%5D&k1=1"
    req = urllib.request.Request(url)
    req.add_header("Referer", "https://data.stats.gov.cn/")
    req.add_header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
    data = _fetch_json(
        url, {"Referer": "https://data.stats.gov.cn/", "User-Agent": "Mozilla/5.0"}
    )
    points = []
    name = code
    nodes = data.get("returndata", {}).get("datanodes", [])
    for n in nodes:
        try:
            name = n.get("data", {}).get("strdata", code)
            date_str = n.get("code", "").split(".")[-1]
            value = float(n.get("data", {}).get("data", {}).get("data", 0))
            points.append(TimeSeriesPoint(date=date_str, value=value))
        except (ValueError, TypeError, KeyError):
            continue
    points.sort(key=lambda p: p.date)
    return SeriesData(id=code, name=name, source="nbs", points=points)


def fetch_google_trends_series(keyword: str) -> SeriesData:
    from pytrends.request import TrendReq

    pytrends = TrendReq(hl="en-US", tz=360, timeout=(10, 15))
    pytrends.build_payload([keyword], timeframe="today 5-y", geo="")
    df = pytrends.interest_over_time()

    if df is None or df.empty:
        return SeriesData(
            id=keyword, name=keyword, source="google_trends", error="No data returned"
        )

    points = []
    for ts, row in df.iterrows():
        try:
            date_str = (
                ts.strftime("%Y-%m-%d") if hasattr(ts, "strftime") else str(ts)[:10]
            )
            value = float(row[keyword])
            points.append(TimeSeriesPoint(date=date_str, value=value))
        except (ValueError, TypeError, KeyError):
            continue

    points.sort(key=lambda p: p.date)
    return SeriesData(id=keyword, name=keyword, source="google_trends", points=points)


def fetch_yfinance_series(ticker: str) -> SeriesData:
    import yfinance as yf

    t = yf.Ticker(ticker)
    hist = t.history(period="2y")

    if hist is None or hist.empty:
        return SeriesData(
            id=ticker, name=ticker, source="yfinance", error="No data returned"
        )

    points = []
    for ts, row in hist.iterrows():
        try:
            date_str = (
                ts.strftime("%Y-%m-%d") if hasattr(ts, "strftime") else str(ts)[:10]
            )
            value = float(row.get("Close", row.get("Adj Close", 0)))
            if value > 0:
                points.append(TimeSeriesPoint(date=date_str, value=value))
        except (ValueError, TypeError):
            continue

    points.sort(key=lambda p: p.date)
    return SeriesData(id=ticker, name=ticker, source="yfinance", points=points)


FETCHERS = {
    "fred": fetch_fred_series,
    "world_bank": fetch_world_bank_series,
    "imf": fetch_imf_series,
    "oecd": fetch_oecd_series,
    "eurostat": fetch_eurostat_series,
    "nbs": fetch_nbs_series,
    "google_trends": fetch_google_trends_series,
    "yfinance": fetch_yfinance_series,
}


def fetch_series(source: str, series_id: str, **kwargs) -> SeriesData:
    fn = FETCHERS.get(source)
    if fn is None:
        return SeriesData(
            id=series_id,
            name=series_id,
            source=source,
            error=f"Unknown source: {source}",
        )
    try:
        return fn(series_id, **kwargs)
    except Exception as e:
        return SeriesData(id=series_id, name=series_id, source=source, error=str(e))
