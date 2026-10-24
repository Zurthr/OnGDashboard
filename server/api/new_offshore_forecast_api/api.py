
from pathlib import Path
import json
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, ConfigDict

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
CONFIG_FILE = MODELS_DIR / "model_config.json"
YEAR_INDEX_FILE = BASE_DIR / "year_index.json"

with open(CONFIG_FILE, "r", encoding="utf-8") as f:
    MODEL_CONFIG = json.load(f)

# The model artifacts supplied by the user.
MODEL_FILES = {
    "substructure": MODELS_DIR / "substructure.pkl",
    "pipeline": MODELS_DIR / "pipeline.pkl",
    "topside_deck": MODELS_DIR / "topside_deck.pkl",
    "topside_production": MODELS_DIR / "topside_production.pkl",
    "certification": MODELS_DIR / "certification.pkl",
    "general_support": MODELS_DIR / "general_support.pkl",
}

FEATURES = MODEL_CONFIG["model_features"]

MODELS = {}
for name, path in MODEL_FILES.items():
    if not path.exists():
        raise FileNotFoundError(f"Missing model file: {path}")
    MODELS[name] = joblib.load(path)

app = FastAPI(
    title="Offshore Platform Cost Forecasting API",
    version="1.0.0",
    description=(
        "Forecasts six offshore platform cost components using the supplied "
        "XGBoost models and applies a project-year inflation/index factor."
    ),
)


class ForecastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    leg: float = Field(..., gt=0, description="Number of platform legs")
    water_depth: float = Field(..., ge=0, description="Water depth in meters")
    pipe_length: float = Field(..., ge=0, description="Pipeline length in km")
    pipe_diameter: float = Field(..., gt=0, description="Pipeline diameter in inches")
    piles: float = Field(..., ge=0, description="Pile weight in metric tonnes")
    jacket: float = Field(..., ge=0, description="Jacket weight in metric tonnes")
    topside: float = Field(..., ge=0, description="Topside/deck weight in metric tonnes")
    conductor: float = Field(..., ge=0, description="Conductor weight in metric tonnes")
    project_year: int = Field(..., ge=1900, le=2200, description="Execution/forecast year")


def load_year_index():
    """
    Expected year_index.json format:

    {
      "base_year": 2020,
      "index": {
        "2020": 1.0,
        "2021": 1.XX,
        "2022": 1.XX
      }
    }

    """
    if not YEAR_INDEX_FILE.exists():
        raise HTTPException(
            status_code=500,
            detail=(
                "year_index.json is missing. Add the project's approved "
                "inflation/cost index values before requesting a forecast."
            ),
        )

    with open(YEAR_INDEX_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "index" not in data or not isinstance(data["index"], dict):
        raise HTTPException(
            status_code=500,
            detail="year_index.json must contain an 'index' object.",
        )

    return data


def make_dataframe(req: ForecastRequest) -> pd.DataFrame:
    # Use the exact variable names recorded in model_config.json.
    return pd.DataFrame([{
        "Leg": req.leg,
        "Water Depth (meter)": req.water_depth,
        "Panjang (km)": req.pipe_length,
        "Diameter (inch)": req.pipe_diameter,
        "Piles": req.piles,
        "Jacket": req.jacket,
        "Topsides/Deck": req.topside,
        "Conductor": req.conductor,
    }])


def predict_component(name: str, df: pd.DataFrame) -> float:
    feature_names = FEATURES[name]
    X = df[feature_names]
    prediction = float(MODELS[name].predict(X)[0])

    # Costs cannot be negative.
    return max(0.0, prediction)


@app.get("/")
def root():
    return {
        "message": "Offshore Platform Cost Forecasting API",
        "docs": "/docs",
        "model": MODEL_CONFIG.get("model"),
        "validation": MODEL_CONFIG.get("validation"),
        "synthetic_ratio": MODEL_CONFIG.get("synthetic_ratio"),
        "inflation_index_file": "year_index.json",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": list(MODELS.keys()),
        "config_loaded": True,
        "year_index_file_exists": YEAR_INDEX_FILE.exists(),
    }


@app.get("/model-info")
def model_info():
    return {
        "model": MODEL_CONFIG.get("model"),
        "validation": MODEL_CONFIG.get("validation"),
        "metrics": MODEL_CONFIG.get("metrics"),
        "synthetic_ratio": MODEL_CONFIG.get("synthetic_ratio"),
        "features": FEATURES,
    }


@app.post("/forecast")
def forecast(req: ForecastRequest):
    year_data = load_year_index()

    year_key = str(req.project_year)
    if year_key not in year_data["index"]:
        available = sorted(year_data["index"].keys())
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"No inflation index is configured for {req.project_year}.",
                "available_years": available,
            },
        )

    try:
        index_value = float(year_data["index"][year_key])
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=500,
            detail=f"Invalid inflation index for year {req.project_year}.",
        )

    if index_value <= 0:
        raise HTTPException(
            status_code=500,
            detail=f"Inflation index for {req.project_year} must be greater than 0.",
        )

    df = make_dataframe(req)

    # Base model forecasts.
    base = {
        "substructure": predict_component("substructure", df),
        "pipeline": predict_component("pipeline", df),
        "topside_deck_structure": predict_component("topside_deck", df),
        "topside_production": predict_component("topside_production", df),
        "certification_and_permit": predict_component("certification", df),
        "general_support": predict_component("general_support", df),
    }

    # Apply the supplied project-year index.
    adjusted = {
        key: value * index_value
        for key, value in base.items()
    }

    total = sum(adjusted.values())

    return {
        "project_year": req.project_year,
        "inflation_index": index_value,
        "inputs": {
            "leg": req.leg,
            "water_depth": req.water_depth,
            "pipe_length": req.pipe_length,
            "pipe_diameter": req.pipe_diameter,
            "piles": req.piles,
            "jacket": req.jacket,
            "topside": req.topside,
            "conductor": req.conductor,
        },
        "forecast": {
            "base_cost_usd": base,
            "adjusted_cost_usd": adjusted,
            "total_project_cost_usd": total,
        },
        "calculation": (
            "Each component prediction is multiplied by the configured "
            "project-year index; total project cost is the sum of the six "
            "adjusted component forecasts."
        ),
    }
