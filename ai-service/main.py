from concurrent import futures
import random
import threading

import grpc
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

import ai_service_pb2
import ai_service_pb2_grpc

app = FastAPI(title="EmuWorld AI Service")


class PredictRequest(BaseModel):
    question: str
    horizon_days: int
    outcomes: List[str]


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
    """
    Monte Carlo simulation for probability estimation.
    For MVP: uses heuristic-based random allocation.
    Later: integrates with real data sources and Bayesian models.
    """
    return monte_carlo_prediction(req.outcomes)


@app.post("/predict/monte-carlo")
async def monte_carlo_predict(req: PredictRequest):
    """
    Monte Carlo simulation with configurable iterations.
    """
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


def start_grpc_server():
    grpc_thread = threading.Thread(target=serve_grpc, daemon=True)
    grpc_thread.start()
    return grpc_thread


if __name__ == "__main__":
    start_grpc_server()
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=9000)
