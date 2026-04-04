import sys
import os
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import asyncio
from concurrent import futures
import logging
import random
import threading

import grpc
from fastapi import FastAPI
from openai import OpenAI
from pydantic import BaseModel, Field
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any

import ai_service_pb2
import ai_service_pb2_grpc

from agents.orchestrator import Stage, run_pipeline, LeadAgent, LeadAgentConfig
from agents.orchestrator.handlers import make_handlers
from agents.memory import (
    SkillRegistry,
    PredictionHistory,
    CostTracker,
    check_permission,
    PermissionLevel,
)
from agents.tools import discover_all, discover_source
from agents.tools.hybrid_fetcher import fetch_hybrid, cache_stats, invalidate_cache
from agents.tools.api_proxy import fetch_series, FETCHERS

app = FastAPI(title="EmuWorld AI Service")
logger = logging.getLogger("emuworld.ai")

_agent = LeadAgent(LeadAgentConfig())
_cost_tracker = CostTracker()
_prediction_history = PredictionHistory()
_openai_api_key = os.getenv("OPENAI_API_KEY")
_openai_model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
_openai_client = OpenAI(api_key=_openai_api_key) if _openai_api_key else None


class PredictRequest(BaseModel):
    question: str
    horizon_days: int
    outcomes: List[str]


class ChatDatasetContext(BaseModel):
    id: int
    name: str
    source: str
    category: str
    description: str


class ChatTargetContext(BaseModel):
    id: int
    question: str
    category: str
    horizon_days: int


class ChatPredictionContext(BaseModel):
    run_id: Optional[int] = None
    status: Optional[str] = None
    model_version: Optional[str] = None
    top_outcome: Optional[str] = None
    top_probability: Optional[float] = None


class ChatContext(BaseModel):
    page: str = "datasets"
    datasets_count: int = 0
    targets_count: int = 0
    predictions_count: int = 0
    dataset_catalog: List[str] = Field(default_factory=list)
    target_catalog: List[str] = Field(default_factory=list)
    prediction_catalog: List[str] = Field(default_factory=list)
    dataset_series_summary: List[str] = Field(default_factory=list)
    target_outcomes: List[str] = Field(default_factory=list)
    prediction_distribution: List[str] = Field(default_factory=list)
    dataset: Optional[ChatDatasetContext] = None
    target: Optional[ChatTargetContext] = None
    prediction: Optional[ChatPredictionContext] = None


class WorkspaceChatRequest(BaseModel):
    session_id: Optional[int] = None
    message: str
    context: ChatContext = Field(default_factory=ChatContext)
    history: List[Dict[str, str]] = Field(default_factory=list)


class WorkspaceChatResponse(BaseModel):
    answer: str
    suggested_prompts: List[str]
    provider: str
    model: str
    used_fallback: bool


class AgentRequest(BaseModel):
    question: str
    category: Optional[str] = None
    horizon_days: Optional[int] = 30
    outcomes: Optional[List[str]] = None


class AgentResponse(BaseModel):
    question: str
    report: Optional[str] = None
    stages_completed: int
    stages_failed: int
    total_duration_ms: float
    data_summary: Optional[dict] = None
    trend_summary: Optional[dict] = None
    forecast_summary: Optional[dict] = None
    anomalies: Optional[dict] = None


class SkillInfo(BaseModel):
    id: str
    name: str
    description: str
    tools: List[str]


class SkillListResponse(BaseModel):
    skills: List[SkillInfo]


def monte_carlo_prediction(outcomes: List[str]):
    n_outcomes = len(outcomes)
    if n_outcomes == 0:
        return []
    if n_outcomes == 1:
        return [1.0]

    weights = [random.expovariate(1.0) for _ in range(n_outcomes)]
    total = sum(weights)
    probabilities = [w / total for w in weights]
    probabilities = [round(p, 2) for p in probabilities]
    diff = round(1.0 - sum(probabilities), 2)
    probabilities[0] = round(probabilities[0] + diff, 2)

    return probabilities


def build_chat_response(message: str, context: ChatContext) -> WorkspaceChatResponse:
    question = message.strip()
    lowered = question.lower()

    page_hint = {
        "datasets": "You are on the datasets workspace, which is best for exploring coverage, source mix, and series history.",
        "targets": "You are on the targets workspace, which is where new forecast questions are drafted and launched.",
        "predictions": "You are on the predictions workspace, which is where run status, confidence bands, and outcome probabilities are reviewed.",
    }.get(context.page, "You are on the EmuWorld workspace.")

    context_lines: List[str] = [
        page_hint,
        f"The system currently has {context.datasets_count} datasets, {context.targets_count} targets, and {context.predictions_count} predictions in view.",
    ]

    if context.dataset_catalog:
        context_lines.append(
            "Available dataset signals include: " + ", ".join(context.dataset_catalog[:8]) + "."
        )
    if context.target_catalog:
        context_lines.append(
            "Available forecast targets include: " + "; ".join(context.target_catalog[:5]) + "."
        )
    if context.prediction_catalog:
        context_lines.append(
            "Prediction summaries in view: " + "; ".join(context.prediction_catalog[:5]) + "."
        )

    if context.dataset:
        context_lines.append(
            f"The selected dataset is '{context.dataset.name}' from {context.dataset.source} in category '{context.dataset.category}'."
        )
        context_lines.append(context.dataset.description)

    if context.target:
        context_lines.append(
            f"The selected target asks: '{context.target.question}' with a {context.target.horizon_days}-day horizon."
        )

    if context.prediction and context.prediction.run_id:
        prediction_bits = [f"run #{context.prediction.run_id}"]
        if context.prediction.status:
            prediction_bits.append(f"status {context.prediction.status}")
        if context.prediction.model_version:
            prediction_bits.append(f"model {context.prediction.model_version}")
        if context.prediction.top_outcome and context.prediction.top_probability is not None:
            prediction_bits.append(
                f"top outcome {context.prediction.top_outcome} at {context.prediction.top_probability:.1f}%"
            )
        context_lines.append("The active forecast context is " + ", ".join(prediction_bits) + ".")

    answer_sections: List[str] = []

    if any(token in lowered for token in ["what can you do", "help", "capabilities"]):
        answer_sections.append(
            "I can explain the current workspace, summarize the selected dataset or forecast run, help interpret indicators, and suggest the next question to model."
        )
    elif "dataset" in lowered or "series" in lowered:
        if context.dataset:
            answer_sections.append(
                f"{context.dataset.name} is a {context.dataset.category} indicator sourced from {context.dataset.source}. "
                f"It is useful when you want to anchor a macro narrative in a concrete observed series."
            )
        else:
            answer_sections.append(
                "No specific dataset is selected yet, so I can only speak at the catalog level: the workspace is strongest at comparing sources, coverage, and category depth."
            )
    elif any(token in lowered for token in ["predict", "forecast", "run", "confidence", "probability"]):
        if context.target:
            answer_sections.append(
                f"This forecast is centered on '{context.target.question}'. The right way to read it is: first identify the leading outcome, then compare the confidence range before making any decision off the run."
            )
        else:
            answer_sections.append(
                "There is no active target in context yet. Create a forecast target first, then I can help interpret the run, the confidence envelope, and the most likely outcome."
            )
    elif any(token in lowered for token in ["source", "coverage", "mix"]):
        answer_sections.append(
            "Use the source mix chart to see who dominates your live feed, then use the category spread panel to spot where the catalog is deep enough to support forecasting."
        )
    else:
        answer_sections.append(
            "The fastest way to use this workspace is: scan the current context, identify the strongest signal, and then ask a narrower question about one dataset or one prediction run."
        )

    answer_sections.append(" ".join(context_lines))

    suggestions = [
        "Summarize the current workspace for me.",
        "What is the most useful next question to model?",
        "How should I interpret the selected dataset or forecast?",
    ]

    if context.dataset:
        suggestions[0] = f"What does {context.dataset.name} tell me?"
    if context.target:
        suggestions[1] = "How should I refine this forecast target?"
    if context.prediction and context.prediction.run_id:
        suggestions[2] = "Explain this run like an analyst briefing."

    return WorkspaceChatResponse(
        answer="\n\n".join(answer_sections),
        suggested_prompts=suggestions,
        provider="fallback",
        model="rules",
        used_fallback=True,
    )


def build_workspace_prompt(message: str, context: ChatContext) -> str:
    lines = [
        "You are EmuWorld Copilot, an economic and forecasting analysis assistant inside a macro data workspace.",
        "Answer clearly and directly. Prefer concrete interpretation over generic encouragement.",
        "Use the current workspace context. If the requested data is not present in context, say that explicitly and suggest the closest available next step.",
        f"Current page: {context.page}",
        f"Datasets in system: {context.datasets_count}",
        f"Targets in system: {context.targets_count}",
        f"Predictions in view: {context.predictions_count}",
    ]

    if context.dataset_catalog:
        lines.append("Visible datasets: " + ", ".join(context.dataset_catalog[:10]))
    if context.target_catalog:
        lines.append("Visible targets: " + " | ".join(context.target_catalog[:6]))
    if context.prediction_catalog:
        lines.append("Visible prediction summaries: " + " | ".join(context.prediction_catalog[:6]))

    if context.dataset:
        lines.extend(
            [
                "Selected dataset:",
                f"- name: {context.dataset.name}",
                f"- source: {context.dataset.source}",
                f"- category: {context.dataset.category}",
                f"- description: {context.dataset.description}",
            ]
        )
    if context.dataset_series_summary:
        lines.append("Selected dataset recent history: " + " | ".join(context.dataset_series_summary[:8]))

    if context.target:
        lines.extend(
            [
                "Selected target:",
                f"- question: {context.target.question}",
                f"- category: {context.target.category}",
                f"- horizon_days: {context.target.horizon_days}",
            ]
        )
    if context.target_outcomes:
        lines.append("Target outcomes: " + ", ".join(context.target_outcomes))

    if context.prediction:
        lines.extend(
            [
                "Selected prediction run:",
                f"- run_id: {context.prediction.run_id}",
                f"- status: {context.prediction.status}",
                f"- model_version: {context.prediction.model_version}",
                f"- top_outcome: {context.prediction.top_outcome}",
                f"- top_probability_percent: {context.prediction.top_probability}",
            ]
        )
    if context.prediction_distribution:
        lines.append("Prediction distribution: " + " | ".join(context.prediction_distribution[:8]))

    lines.extend(
        [
            "When useful, structure the answer in two short parts:",
            "1. what the current workspace does or does not contain",
            "2. what the user should do next inside EmuWorld",
            f"User question: {message.strip()}",
        ]
    )

    return "\n".join(lines)


def format_history(history: List[Dict[str, str]]) -> str:
    if not history:
        return "No prior conversation history."

    rendered = []
    for item in history[-12:]:
        role = item.get("role", "unknown").upper()
        content = item.get("content", "").strip()
        rendered.append(f"{role}: {content}")
    return "\n".join(rendered)


def build_suggested_prompts(context: ChatContext) -> List[str]:
    suggestions = [
        "Summarize the current workspace for me.",
        "What should I look at next?",
        "Explain the strongest signal on screen.",
    ]

    if context.dataset:
        suggestions[0] = f"What does {context.dataset.name} tell me?"
    if context.target:
        suggestions[1] = "How should I refine this target?"
    if context.prediction and context.prediction.run_id:
        suggestions[2] = "Explain this forecast run like an analyst."

    return suggestions


def generate_llm_chat_response(message: str, context: ChatContext, history: Optional[List[Dict[str, str]]] = None) -> Optional[WorkspaceChatResponse]:
    if not _openai_client:
        return None

    prompt = build_workspace_prompt(message, context) + "\nConversation history:\n" + format_history(history or [])
    logger.info("calling OpenAI chat model=%s page=%s message_len=%s", _openai_model, context.page, len(message))
    response = _openai_client.responses.create(
        model=_openai_model,
        input=prompt,
        max_output_tokens=500,
    )

    answer = (response.output_text or "").strip()
    if not answer:
        return None

    return WorkspaceChatResponse(
        answer=answer,
        suggested_prompts=build_suggested_prompts(context),
        provider="openai",
        model=_openai_model,
        used_fallback=False,
    )


class PredictionServicer(ai_service_pb2_grpc.PredictionServiceServicer):
    def Predict(self, request, context):
        probabilities = monte_carlo_prediction(list(request.outcomes))
        return ai_service_pb2.PredictResponse(probabilities=probabilities)


def serve_grpc(port=9001):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    ai_service_pb2_grpc.add_PredictionServiceServicer_to_server(
        PredictionServicer(), server
    )
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    print(f"gRPC server listening on [::]:{port}")
    server.wait_for_termination()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"message": "EmuWorld AI Service"}


@app.post("/predict")
async def predict(req: PredictRequest):
    return monte_carlo_prediction(req.outcomes)


@app.post("/chat", response_model=WorkspaceChatResponse)
async def chat(req: WorkspaceChatRequest):
    if _openai_client:
        try:
            loop = asyncio.get_event_loop()
            llm_response = await loop.run_in_executor(
                None, lambda: generate_llm_chat_response(req.message, req.context, req.history)
            )
            if llm_response:
                return llm_response
        except Exception as error:
            logger.exception("OpenAI chat request failed: %s", error)

    logger.info("falling back to rule-based chat response")
    return build_chat_response(req.message, req.context)


@app.post("/chat/stream")
async def chat_stream(req: WorkspaceChatRequest):
    if _openai_client:
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, lambda: generate_llm_chat_response(req.message, req.context, req.history)
            )
            if response:
                return StreamingResponse(
                    stream_workspace_chat_response(response),
                    media_type="text/event-stream",
                )
        except Exception as error:
            logger.exception("OpenAI chat stream request failed: %s", error)

    response = build_chat_response(req.message, req.context)
    return StreamingResponse(
        stream_workspace_chat_response(response),
        media_type="text/event-stream",
    )


def stream_workspace_chat_response(response: WorkspaceChatResponse):
    def _emit(payload: dict):
        return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    yield _emit(
        {
            "type": "meta",
            "provider": response.provider,
            "model": response.model,
            "usedFallback": response.used_fallback,
        }
    )

    answer = response.answer
    chunk_size = 36
    for start in range(0, len(answer), chunk_size):
        yield _emit({"type": "delta", "delta": answer[start:start + chunk_size]})

    yield _emit(
        {
            "type": "done",
            "suggestedPrompts": response.suggested_prompts,
        }
    )


@app.post("/predict/monte-carlo")
async def monte_carlo_predict(req: PredictRequest):
    n_simulations = 10000
    n_outcomes = len(req.outcomes)

    if n_outcomes == 0:
        return []
    if n_outcomes == 1:
        return [1.0]

    counts = [0] * n_outcomes
    for _ in range(n_simulations):
        weights = [random.gauss(0.5, 0.2) for _ in range(n_outcomes)]
        winner = max(range(n_outcomes), key=lambda i: weights[i])
        counts[winner] += 1

    probabilities = [round(c / n_simulations, 2) for c in counts]
    return probabilities


@app.post("/agent/analyze", response_model=AgentResponse)
async def agent_analyze(req: AgentRequest):
    loop = asyncio.get_event_loop()
    state = await loop.run_in_executor(
        None,
        lambda: _agent.analyze(
            question=req.question,
            category=req.category,
            horizon_days=req.horizon_days,
            outcomes=req.outcomes or [],
        ),
    )

    data_summary = (
        state.data.get("data_summary") if isinstance(state.data, dict) else None
    )
    trend_summary = state.analysis if state.analysis else None
    forecast_summary = (
        {
            name: {"trend": fc["trend"], "method": fc["method"]}
            for name, fc in state.forecast.items()
        }
        if state.forecast
        else None
    )
    anomalies = state.data.get("anomalies") if isinstance(state.data, dict) else None

    return AgentResponse(
        question=state.question,
        report=state.report,
        stages_completed=len(
            [r for r in state.stage_results if r.status.value == "succeed"]
        ),
        stages_failed=len(
            [r for r in state.stage_results if r.status.value in ("fail", "reject")]
        ),
        total_duration_ms=sum(r.duration_ms for r in state.stage_results),
        data_summary=data_summary,
        trend_summary=trend_summary,
        forecast_summary=forecast_summary,
        anomalies=anomalies,
    )


@app.get("/agent/skills", response_model=SkillListResponse)
async def list_skills():
    registry = SkillRegistry()
    skills = []
    for sid, sdef in registry.list_all().items():
        skills.append(
            SkillInfo(
                id=sid, name=sdef.name, description=sdef.description, tools=sdef.tools
            )
        )
    return SkillListResponse(skills=skills)


class CostSummary(BaseModel):
    llm_calls: int
    data_api_calls: int
    total_tokens: int


@app.get("/agent/costs", response_model=CostSummary)
async def get_costs():
    return CostSummary(**_cost_tracker.summary())


class PermissionRequest(BaseModel):
    resource: str
    action: str
    level: str


class PermissionResponse(BaseModel):
    resource: str
    action: str
    level: str
    allowed: bool
    reason: Optional[str] = None


@app.post("/agent/permission/check", response_model=PermissionResponse)
async def check_perm(req: PermissionRequest):
    level = PermissionLevel(req.level)
    result = check_permission(req.resource, req.action, level)
    return PermissionResponse(
        resource=result.resource,
        action=result.action,
        level=result.level.value,
        allowed=result.allowed,
        reason=result.reason,
    )


@app.get("/agent/predictions/history")
async def prediction_history():
    records = _prediction_history.get_all()
    return {
        "total": len(records),
        "accuracy": _prediction_history.accuracy(),
        "records": [r.__dict__ for r in records[-50:]],
    }


class SeriesInfoOut(BaseModel):
    id: str
    name: str
    description: str
    category: str = ""
    source: str = ""


class SourceCatalogOut(BaseModel):
    source: str
    display_name: str
    total_series: int
    series: List[SeriesInfoOut]
    error: Optional[str] = None


class DiscoveryResponse(BaseModel):
    sources: Dict[str, SourceCatalogOut]
    total_series: int


@app.get("/agent/discover/all", response_model=DiscoveryResponse)
async def discover_all_sources():
    catalogs = discover_all()
    sources = {}
    total = 0
    for name, cat in catalogs.items():
        sources[name] = SourceCatalogOut(
            source=cat.source,
            display_name=cat.display_name,
            total_series=cat.total_series,
            series=[
                SeriesInfoOut(
                    id=s.id,
                    name=s.name,
                    description=s.description,
                    category=s.category,
                    source=s.source,
                )
                for s in cat.series
            ],
            error=cat.error,
        )
        total += cat.total_series
    return DiscoveryResponse(sources=sources, total_series=total)


@app.get("/agent/discover/{source}", response_model=SourceCatalogOut)
async def discover_single_source(source: str):
    cat = discover_source(source)
    return SourceCatalogOut(
        source=cat.source,
        display_name=cat.display_name,
        total_series=cat.total_series,
        series=[
            SeriesInfoOut(
                id=s.id,
                name=s.name,
                description=s.description,
                category=s.category,
                source=s.source,
            )
            for s in cat.series
        ],
        error=cat.error,
    )


class HybridFetchRequest(BaseModel):
    source: str
    series_id: str
    category: Optional[str] = None
    use_cache: bool = True
    use_db: bool = True
    use_api: bool = True


class HybridFetchResponse(BaseModel):
    source: str
    data: Optional[Any] = None
    error: Optional[str] = None
    series_name: Optional[str] = None
    cache_key: Optional[str] = None


@app.post("/agent/fetch", response_model=HybridFetchResponse)
async def hybrid_fetch(req: HybridFetchRequest):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: fetch_hybrid(
            source=req.source,
            series_id=req.series_id,
            category=req.category,
            use_cache=req.use_cache,
            use_db=req.use_db,
            use_api=req.use_api,
        ),
    )
    return HybridFetchResponse(**result)


class CacheStatsResponse(BaseModel):
    entries: int
    hits: int
    ttl: int


@app.get("/agent/cache/stats", response_model=CacheStatsResponse)
async def get_cache_stats():
    return CacheStatsResponse(**cache_stats())


class InvalidateRequest(BaseModel):
    key: str


@app.post("/agent/cache/invalidate")
async def invalidate_cache_endpoint(req: InvalidateRequest):
    ok = invalidate_cache(req.key)
    return {"invalidated": ok, "key": req.key}


class SyncRequest(BaseModel):
    source: str
    series_ids: Optional[List[str]] = None


class SyncResponse(BaseModel):
    source: str
    series_synced: int
    total_points: int
    errors: List[str] = []


@app.post("/agent/sync", response_model=SyncResponse)
async def sync_data(req: SyncRequest):
    loop = asyncio.get_event_loop()

    def _do_sync():
        catalog = discover_source(req.source)
        if catalog.error:
            return SyncResponse(
                source=req.source,
                series_synced=0,
                total_points=0,
                errors=[catalog.error],
            )

        series_to_sync = req.series_ids or [s.id for s in catalog.series]
        synced = 0
        total_pts = 0
        errors = []

        for sid in series_to_sync:
            result = fetch_series(req.source, sid)
            if result.error:
                errors.append(f"{sid}: {result.error}")
            else:
                synced += 1
                total_pts += len(result.points)

        return SyncResponse(
            source=req.source,
            series_synced=synced,
            total_points=total_pts,
            errors=errors,
        )

    return await loop.run_in_executor(None, _do_sync)


class AgentChatRequest(BaseModel):
    question: str
    category: Optional[str] = None
    horizon_days: Optional[int] = 30


class AgentChatResponse(BaseModel):
    question: str
    report: Optional[str] = None
    stages_completed: int
    data_points_fetched: int
    duration_ms: float
    insights: List[str] = []


@app.post("/agent/chat", response_model=AgentChatResponse)
async def agent_chat(req: AgentChatRequest):
    loop = asyncio.get_event_loop()

    def _run_analysis():
        state = _agent.analyze(
            question=req.question,
            category=req.category,
            horizon_days=req.horizon_days,
        )
        insights = []
        if state.analysis:
            for name, info in state.analysis.items():
                direction = info.get("direction", "unknown")
                insights.append(f"{name}: trending {direction}")
                if info.get("yoy_change") is not None:
                    insights.append(f"{name}: YoY change {info['yoy_change']}%")
        if state.forecast:
            for name, fc in state.forecast.items():
                insights.append(f"{name}: forecast {fc['trend']} ({fc['method']})")
        if state.data.get("anomalies"):
            for name, items in state.data["anomalies"].items():
                insights.append(f"{name}: {len(items)} anomalies detected")

        total_pts = sum(
            len(pts) for pts in state.data.values() if isinstance(pts, list)
        )

        return {
            "question": state.question,
            "report": state.report,
            "stages_completed": len(
                [r for r in state.stage_results if r.status.value == "succeed"]
            ),
            "data_points_fetched": total_pts,
            "duration_ms": sum(r.duration_ms for r in state.stage_results),
            "insights": insights,
        }

    result = await loop.run_in_executor(None, _run_analysis)
    return AgentChatResponse(**result)


def start_grpc_server():
    grpc_thread = threading.Thread(target=serve_grpc, daemon=True)
    grpc_thread.start()
    return grpc_thread


if __name__ == "__main__":
    start_grpc_server()
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=9000)
