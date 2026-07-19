# API Integration Guide for Anas

## Overview
This document provides practical instructions for integrating with the Validation-Aware ETL API.

## Installation & Startup
1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Startup command:**
   ```bash
   uvicorn src.api.app:app --reload
   ```
3. **Health Endpoint:**
   Check if the API is running by navigating to `GET http://localhost:8000/health`.
4. **Swagger Documentation:**
   Available at `http://localhost:8000/docs`.

## Integration Contract

### Request Wrapper
Send a single JSON document payload per request:
```json
{
  "source_filename": "18-21A-218-OO_extracted.json",
  "payload": {
    "AFE_Extraction": { 
        "AFE_Number": {
            "value": "18-21A-218-OO"
        }
    }
  }
}
```

**Important:** `AFE_Number.value` must contain *only* the AFE identifier without prefixes (e.g., "AFE", "AFE No.").

### Response
The response follows the standard Integration Contract returning `curated_records`, `dlq_records`, and `validation_summary`.

- **Curated Records**: Valid records (`PASS`) or accepted warnings (`WARNING`). Downstream database should insert/upsert these.
- **DLQ Records**: Failed records (`FAIL`). These should be reviewed by an operator and require correction. They are considered a successful quality control check, so the API returns `200 OK`.
- **Validation Summary**: Count metrics of the document processed.

## HTTP Status Behavior
- **200 OK**: Request was valid, and the ETL processed the payload successfully (even if all records end up in DLQ).
- **422 / 400 Bad Request**: Payload structure is malformed or not a valid JSON dictionary.
- **500 Internal Server Error**: Unexpected technical exception.

## Configuration Loading
The API dynamically loads rules into memory on startup from:
- `config/validation_rules.xlsx`
- `config/parameter_aliases.csv`
- `config/unit_mapping.csv`

**Important**: A restart of the FastAPI server is required if any configuration files are modified on disk.

## Exclusions & Responsibilities
- **Database/Upsert Responsibility**: The API operates statelessly. Downstream BFF/DB is responsible for persisting records and checking for repository-wide duplicates.
- **Ground Truth Excluded**: Ground truth evaluation files are strictly excluded from the operational API mode as they are intended for Thesis/TA evaluation only.
