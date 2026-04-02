from fastapi import FastAPI
from pydantic import BaseModel
import random
import math
from typing import List

app = FastAPI(title="EmuWorld AI Service")


class PredictRequest(BaseModel):
    question: str
    horizon_days: int
    outcomes: List[str]


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
    n_outcomes = len(req.outcomes)
    if n_outcomes == 0:
        return []
    if n_outcomes == 1:
        return [1.0]

    # Generate random weights and normalize
    weights = [random.expovariate(1.0) for _ in range(n_outcomes)]
    total = sum(weights)
    probabilities = [w / total for w in weights]

    # Round to 2 decimal places
    probabilities = [round(p, 2) for p in probabilities]

    # Ensure they sum to 1.0
    diff = round(1.0 - sum(probabilities), 2)
    probabilities[0] = round(probabilities[0] + diff, 2)

    return probabilities


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
