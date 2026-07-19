# Anas ETL API Handoff

This package contains the Izzafi Validation-Aware ETL REST API, extracted from the main repository for operational handoff. 

## System Boundary and Responsibility
**IMPORTANT: The API is not a database.**
It processes one submitted JSON document and returns curated records, DLQ records, and a validation summary. Database persistence and repository-wide upsert/deduplication remain Anas’s responsibility.

## Package Structure
- `src/api`: FastAPI application and Pydantic schema models
- `src/core`: The shared ETL processing core (harmonization, flattening, standardization, routing, validation)
- `config/`: System rules, aliases, and unit mappings (`validation_rules.xlsx`, etc.)
- `examples/`: Request/Response JSON examples representing exactly what the API expects and emits
- `docs/`: Reference documentation for integration
- `tests/`: Isolated Pytest regression suite

## Installation and Requirements
Requires Python 3.10+

1. Create a virtual environment: `python -m venv venv`
2. Activate it:
   - Mac/Linux: `source venv/bin/activate`
   - Windows: `venv\Scripts\activate`
3. Install dependencies: `pip install -r requirements.txt`

## Running the API
To start the API in development mode:
- Mac/Linux: `./run_api.sh`
- Windows: `uvicorn src.api.app:app --reload`

By default, the server runs at `http://127.0.0.1:8000`.

- **Swagger Documentation**: `http://127.0.0.1:8000/docs`
- **Health Check Endpoint**: `GET /health`
- **Processing Endpoint**: `POST /api/v1/etl/process`

## Configuration
The `config/validation_rules.xlsx` controls schema, expected types, outlier boundaries, unit mappings, and error routing. **You must restart the API after modifying the Excel file** because rules are loaded globally into memory at startup.

## API Payload Shape
The API requires the actual nested schema produced by the upstream pipeline. Refer to `examples/api_request_valid_example.json` for the exact payload shape.

**Important**: `AFE_Number.value` must contain *only* the AFE identifier, without any labels such as "AFE", "AFE No.", or "AFE Number".

Example wrapper:
```json
{
  "source_filename": "18-21A-218-OO_extracted.json",
  "payload": {
    "AFE_Extraction": {
      "AFE_Number": {
        "value": "18-21A-218-OO",
        "reference_context": "Found on page 2",
        "pages": "2"
      }
    }
  }
}
```

## HTTP Status Behavior
- `200 OK`: Processing succeeded (even if records failed validation and were routed to DLQ). Check `validation_summary` to see DLQ counts.
- `400 Bad Request`: Structural violation caught in manual routing (e.g. empty dictionary `{}`).
- `422 Unprocessable Entity`: Schema violation caught natively by Pydantic (e.g. missing `payload` key, or array instead of dict).
- `500 Internal Server Error`: Unexpected technical failure during execution.

## Running Tests
Anas can verify the integrity of this package at any time:
`pip install -r requirements-dev.txt`
`pytest -q`

*Note: All experimental ground truth evaluations, batch processing scripts, and training datasets have been cleanly removed from this operational handoff.*
