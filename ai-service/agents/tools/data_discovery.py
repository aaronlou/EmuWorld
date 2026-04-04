from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class SeriesInfo:
    id: str
    name: str
    description: str
    category: str = ""
    source: str = ""
    frequency: str = ""
    units: str = ""


@dataclass
class SourceCatalog:
    source: str
    display_name: str
    total_series: int
    series: List[SeriesInfo] = field(default_factory=list)
    error: Optional[str] = None


_DEFAULT_CATALOGS = {
    "fred": {
        "display_name": "FRED",
        "series": [
            (
                "CPIAUCSL",
                "Consumer Price Index for All Urban Consumers",
                "inflation",
                "Monthly",
                "Index 1982-84=100",
            ),
            ("UNRATE", "Unemployment Rate", "employment", "Monthly", "Percent"),
            (
                "FEDFUNDS",
                "Federal Funds Effective Rate",
                "interest_rate",
                "Monthly",
                "Percent",
            ),
            (
                "GDP",
                "Gross Domestic Product",
                "growth",
                "Quarterly",
                "Billions of Dollars",
            ),
            (
                "M2SL",
                "M2 Money Stock",
                "money_supply",
                "Monthly",
                "Billions of Dollars",
            ),
            (
                "EXUSEU",
                "U.S. / Euro Foreign Exchange Rate",
                "exchange_rate",
                "Daily",
                "Dollars to Euro",
            ),
            ("HOUST", "Housing Starts", "real_estate", "Monthly", "Thousands of Units"),
            (
                "CASHPIN",
                "S&P/Case-Shiller U.S. National Home Price Index",
                "real_estate",
                "Monthly",
                "Index 2000=100",
            ),
            (
                "TOTALES",
                "All Employees: Total Nonfarm",
                "employment",
                "Monthly",
                "Thousands of Persons",
            ),
            ("EXPIM", "U.S. Exports / Imports Ratio", "trade", "Monthly", "Ratio"),
        ],
    },
    "imf": {
        "display_name": "IMF",
        "series": [
            ("PCPI_PCPIEA", "Consumer Price Index", "inflation", "Annual", "Index"),
            ("NGDP_RPCH", "Real GDP Growth", "growth", "Annual", "Percent Change"),
            ("LUR", "Unemployment Rate", "employment", "Annual", "Percent"),
            ("NGDP", "Gross Domestic Product", "growth", "Annual", "Billions"),
            (
                "BCA_NGDP",
                "Current Account Balance",
                "trade",
                "Annual",
                "Percent of GDP",
            ),
            (
                "RAFA_NGDP",
                "Central Government Revenue",
                "fiscal",
                "Annual",
                "Percent of GDP",
            ),
        ],
    },
    "oecd": {
        "display_name": "OECD",
        "series": [
            ("CPCV01", "Consumer Price Index", "inflation", "Monthly", "Index"),
            ("GDPVONOBSA", "GDP Volume", "growth", "Quarterly", "Index"),
            ("LOLITAASTN", "Unemployment Rate", "employment", "Monthly", "Percent"),
            ("CXCPCV01", "Current Account Balance", "trade", "Monthly", "USD"),
            ("MABMM301", "Money Supply M3", "money_supply", "Monthly", "Billions"),
            ("CPGDPV", "GDP per Capita", "growth", "Annual", "USD"),
            (
                "CIVPART",
                "Civilian Labour Force Participation Rate",
                "employment",
                "Monthly",
                "Percent",
            ),
            ("P3300000", "House Prices", "real_estate", "Quarterly", "Index"),
        ],
    },
    "eurostat": {
        "display_name": "Eurostat",
        "series": [
            (
                "prc_hicp_manr",
                "Harmonised Index of Consumer Prices",
                "inflation",
                "Monthly",
                "Index",
            ),
            (
                "nama_10_gdp",
                "GDP and Main Components",
                "growth",
                "Annual",
                "Millions EUR",
            ),
            (
                "une_rt_a",
                "Unemployment by Sex and Age",
                "employment",
                "Annual",
                "Percent",
            ),
            ("bop_eu6", "Balance of Payments", "trade", "Monthly", "Millions EUR"),
            ("m3_eur_m", "M3 Money Supply", "money_supply", "Monthly", "Millions EUR"),
            ("ei_bs_q_r", "Business Surveys", "growth", "Quarterly", "Balance"),
            ("ei_pmn_q_r", "PMI Composite", "growth", "Monthly", "Index"),
            ("prc_ppp_ind", "Purchasing Power Parities", "trade", "Annual", "PPS"),
        ],
    },
    "nbs": {
        "display_name": "国家统计局",
        "series": [
            (
                "A0201000101",
                "居民消费价格指数 (CPI)",
                "inflation",
                "Monthly",
                "上年同月=100",
            ),
            (
                "A0201000102",
                "工业生产者出厂价格指数 (PPI)",
                "inflation",
                "Monthly",
                "上年同月=100",
            ),
            ("A0201000103", "工业增加值增速", "growth", "Monthly", "Percent"),
            ("A0201000104", "采购经理指数 (PMI)", "growth", "Monthly", "Index"),
            ("A0201000105", "城镇调查失业率", "employment", "Monthly", "Percent"),
            ("A0201000106", "社会消费品零售总额", "trade", "Monthly", "亿元"),
            ("A0201000107", "固定资产投资", "growth", "Monthly", "亿元"),
            ("A0201000108", "进出口总额", "trade", "Monthly", "亿元"),
            ("A0201000109", "房地产开发投资", "real_estate", "Monthly", "亿元"),
            ("A0201000110", "货币供应量 (M2)", "money_supply", "Monthly", "亿元"),
            ("A0201000111", "国内生产总值 (GDP)", "growth", "Quarterly", "亿元"),
            (
                "A0201000112",
                "70个大中城市新建商品住宅价格指数",
                "real_estate",
                "Monthly",
                "上年同月=100",
            ),
        ],
    },
}


def _build_catalog_from_defaults(source: str) -> SourceCatalog:
    info = _DEFAULT_CATALOGS.get(source)
    if not info:
        return SourceCatalog(source=source, display_name=source, total_series=0)
    series = [
        SeriesInfo(
            id=sid,
            name=name,
            description="",
            category=cat,
            source=source,
            frequency=freq,
            units=units,
        )
        for sid, name, cat, freq, units in info["series"]
    ]
    return SourceCatalog(
        source=source,
        display_name=info["display_name"],
        total_series=len(series),
        series=series,
    )


def discover_fred(api_key: str = "demo") -> SourceCatalog:
    try:
        url = "https://api.stlouisfed.org/fred/releases?api_key=demo&file_type=json"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            releases = data.get("releases", [])[:20]
            series = [
                SeriesInfo(
                    id=f"release:{r.get('id', '')}",
                    name=r.get("name", ""),
                    description=r.get("notes", "")[:200],
                    source="fred",
                )
                for r in releases
            ]
            return SourceCatalog(
                source="fred",
                display_name="FRED",
                total_series=len(series),
                series=series,
            )
    except Exception as e:
        cat = _build_catalog_from_defaults("fred")
        cat.error = (
            f"Live API failed (needs valid api_key), using built-in catalog: {e}"
        )
        return cat


def discover_world_bank() -> SourceCatalog:
    try:
        url = "https://api.worldbank.org/v2/indicator?format=json&per_page=50"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            pages = json.loads(resp.read())
            indicators = pages[1] if len(pages) > 1 else []
            series = [
                SeriesInfo(
                    id=ind.get("id", ""),
                    name=ind.get("name", ""),
                    description=ind.get("sourceNote", "")[:200],
                    source="world_bank",
                )
                for ind in indicators[:30]
            ]
            return SourceCatalog(
                source="world_bank",
                display_name="World Bank",
                total_series=len(series),
                series=series,
            )
    except Exception as e:
        cat = _build_catalog_from_defaults("world_bank")
        cat.error = str(e)
        return cat


def discover_imf() -> SourceCatalog:
    return _build_catalog_from_defaults("imf")


def discover_oecd() -> SourceCatalog:
    return _build_catalog_from_defaults("oecd")


def discover_eurostat() -> SourceCatalog:
    return _build_catalog_from_defaults("eurostat")


def discover_nbs() -> SourceCatalog:
    return _build_catalog_from_defaults("nbs")


DISCOVERERS = {
    "fred": discover_fred,
    "world_bank": discover_world_bank,
    "imf": discover_imf,
    "oecd": discover_oecd,
    "eurostat": discover_eurostat,
    "nbs": discover_nbs,
}


def discover_all() -> Dict[str, SourceCatalog]:
    return {name: fn() for name, fn in DISCOVERERS.items()}


def discover_source(source: str) -> SourceCatalog:
    fn = DISCOVERERS.get(source)
    if fn is None:
        return SourceCatalog(
            source=source,
            display_name=source,
            total_series=0,
            error=f"Unknown source: {source}",
        )
    return fn()
