# Offshore Platform Cost Forecasting API

This package uses the exact trained model artifacts supplied in `models.zip`.

## Models

- `substructure.pkl`
- `pipeline.pkl`
- `topside_deck.pkl`
- `topside_production.pkl`
- `certification.pkl`
- `general_support.pkl`

The feature relationships are read from `models/model_config.json`.

## Important: inflation index

The supplied ZIP contains `model_config.json` and six `.pkl` files, but it does **not** contain an inflation/year-index table.

Therefore, the API deliberately does not invent inflation values.

Before forecasting, edit `year_index.json` and insert the approved project inflation/cost index values.

Example structure:

```json
{
  "base_year": 2020,
  "index": {
    "2020": 1.0,
    "2021": 1.XX,
    "2022": 1.XX,
    "2023": 1.XX,
    "2024": 1.XX,
    "2025": 1.XX,
    "2026": 1.XX
  }
}
```

Replace every `1.XX` with the actual index used by your project.

## Install

Open Command Prompt/PowerShell in this folder:

```bash
pip install -r requirements.txt
```

## Run

```bash
uvicorn api:app --reload
```

Then open:

```text
http://127.0.0.1:8000/docs
```

## Forecast request

Use `POST /forecast` with:

```json
{
  "leg": 4,
  "water_depth": 65,
  "pipe_length": 67.2,
  "pipe_diameter": 24,
  "piles": 700,
  "jacket": 1500,
  "topside": 1200,
  "conductor": 100,
  "project_year": 2026
}
```

## Cost relationships

### Substructure
Water Depth + Piles + Jacket + Conductor

### Pipeline
Pipe Length + Pipe Diameter + Water Depth

### Topside Deck Structure
Topside + Water Depth

### Topside Production
Topside + Water Depth

### Certification and Permit
All 8 engineering inputs

### General Support
All 8 engineering inputs

### Total
Sum of the six adjusted cost components.

## Endpoints

- `GET /` — API information
- `GET /health` — model/load status
- `GET /model-info` — model configuration and feature relationships
- `POST /forecast` — generate a project cost forecast
