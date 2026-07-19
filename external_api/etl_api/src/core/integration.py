import json
import os
import csv
import uuid
from datetime import datetime, timezone

def generate_integration_output(normalized, curated, dlq, summary_metrics, processing_mode="api_single_document", source_filename=None):
    """
    Generates a consolidated machine-readable JSON integration output representing one complete ETL run.
    """
    
    # 1. Extract Project_Type per AFE
    project_types = {}
    for rec in normalized:
        if rec.get("parameter_name") == "Project_Type":
            pt_val = rec.get("parsed_value")
            if pt_val is None:
                pt_val = rec.get("raw_value")
            if pt_val:
                project_types[rec.get("AFE_Number")] = pt_val
                
    # 2. Build Curated records
    curated_out = []
    for r in curated:
        notes = r.get("notes")
        if isinstance(notes, list):
            notes_list = notes
        elif isinstance(notes, str):
            notes_list = [n.strip() for n in notes.split(";") if n.strip()]
        else:
            notes_list = []
            
        curated_out.append({
            "afe_number": r.get("AFE_Number"),
            "project_type": project_types.get(r.get("AFE_Number")),
            "parameter_name": r.get("parameter_name"),
            "sub_parameter": r.get("sub_parameter"),
            "value": r.get("parsed_value"),
            "unit": r.get("standard_unit"),
            "validation_status": r.get("validation_status"),
            "notes": notes_list,
            "filename": r.get("filename"),
            "json_path": r.get("json_path"),
            "reference_context": r.get("reference_context"),
            "pages": r.get("pages")
        })

    # 3. Build DLQ records
    dlq_out = []
    for r in dlq:
        dlq_out.append({
            "afe_number": r.get("AFE_Number"),
            "project_type": project_types.get(r.get("AFE_Number")),
            "parameter_name": r.get("parameter_name"),
            "sub_parameter": r.get("sub_parameter"),
            "raw_value": r.get("raw_value"),
            "normalized_value": r.get("normalized_value"),
            "failed_rule": r.get("failed_rule"),
            "error_type": r.get("error_type"),
            "severity": r.get("severity"),
            "failure_action": r.get("failure_action"),
            "reference_context": r.get("reference_context"),
            "pages": r.get("pages"),
            "json_path": r.get("json_path"),
            "filename": r.get("source_file")
        })

    # 5. Compile Integration JSON
    integration_data = {
        "run_info": {
            "run_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "pipeline_version": "1.1.0",
            "contract_version": "1.0",
            "processing_mode": processing_mode,
            "source_filename": source_filename
        },
        "validation_summary": summary_metrics,
        "curated_records": curated_out,
        "dlq_records": dlq_out
    }

    return integration_data
