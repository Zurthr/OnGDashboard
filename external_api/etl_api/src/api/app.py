from fastapi import FastAPI, HTTPException
from src.api.models import ETLRequest, ETLResponse, HealthResponse
from src.core.processing import process_single_document
from src.core.rules import load_aliases, load_unit_mapping, load_validation_rules, load_global_settings
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Validation-Aware ETL API",
    version="1.0.0"
)

# Load config globally at startup
# We assume the API runs with CWD at the project root
try:
    aliases = load_aliases()
    unit_mapping = load_unit_mapping()
    rules = load_validation_rules()
    sys_rules = load_global_settings()
except Exception as e:
    # Fail clearly at startup
    raise RuntimeError(f"Failed to load configurations: {e}")

@app.get("/health", response_model=HealthResponse)
def health_check():
    return {
        "status": "ok",
        "pipeline_version": "1.1.0",
        "contract_version": "1.0"
    }

@app.post("/api/v1/etl/process", response_model=ETLResponse)
def process_document(request: ETLRequest):
    if not request.payload or not isinstance(request.payload, dict):
        raise HTTPException(status_code=400, detail="Payload must be a valid JSON object.")
        
    try:
        result = process_single_document(
            payload=request.payload,
            source_filename=request.source_filename,
            rules=rules,
            global_settings=sys_rules,
            aliases=aliases,
            unit_mapping=unit_mapping
        )
        return result
    except Exception as e:
        # Unexpected technical failure
        logger.exception("Unexpected technical failure during processing.")
        raise HTTPException(status_code=500, detail="Unexpected technical error occurred during processing.")
