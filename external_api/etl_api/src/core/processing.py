import sys
import os

from src.core.harmonize import harmonize_data
from src.core.flatten import flatten_records
from src.core.standardize import standardize_value, standardize_afe_number
from src.core.rules import get_canonical_name, get_canonical_unit
from src.core.validate import validate_record, _resolve_error
from src.core.routing import route_records
from src.core.summary import generate_summary
from src.core.integration import generate_integration_output
import pandas as pd

def process_single_document(
    payload: dict,
    source_filename: str,
    rules: list,
    global_settings: dict,
    aliases: dict,
    unit_mapping: dict
):
    """
    Core orchestrator that runs the ETL pipeline on a single JSON document payload.
    It expects payload to be a parsed dictionary.
    Returns the integration_output dict.
    """
    
    # 1. Format for harmonize_data which expects a list of (filename, dict)
    raw_data = [(source_filename, payload)]
    
    # 2. Harmonize
    harmonized = harmonize_data(raw_data)
    
    # 3. Flatten
    flat_records = flatten_records(harmonized)
    
    # 4. Standardize & Validate
    validated_records = []
    dedup_set = set()
    
    # Global Check for AFE presence
    is_bad_file = False
    if global_settings.get("REQUIRE_VALID_AFE"):
        has_afe = False
        for rec in flat_records:
            if rec["parameter_name"] == "AFE_Number":
                val = rec["raw_value"]
                if val and str(val).strip() != "" and str(val).strip() != "Unknown Asset":
                    has_afe = True
                    break
        if not has_afe:
            is_bad_file = True

    found_params = set()
    for rec in flat_records:
        raw_val = rec["raw_value"]
        
        # apply aliases FIRST
        canonical_param = get_canonical_name(rec["parameter_name"], aliases)
        found_params.add(canonical_param)
        
        # find rule to get expected type
        sub_param = rec["sub_parameter"]
        rule = None
        for r in rules:
            if r["parameter_name"] == canonical_param:
                r_sub = r.get("sub_parameter")
                if pd.isna(r_sub) or r_sub is None or r_sub == sub_param:
                    rule = r
                    break
                    
        expected_type = str(rule.get("expected_type", "numeric")).lower() if rule else "numeric"
        
        if expected_type == "string" and canonical_param == "afe_number":
            parsed_val = standardize_afe_number(raw_val)
            parsed_unit = None
            notes = []
        else:
            parsed_val, parsed_unit, notes = standardize_value(raw_val, expected_type)
        
        canonical_unit = get_canonical_unit(parsed_unit, unit_mapping)
        
        rec["parameter_name"] = canonical_param
        rec["parsed_value"] = parsed_val
        rec["parsed_unit"] = parsed_unit
        rec["standard_unit"] = canonical_unit
        rec["notes"] = notes
        
        # validate
        if is_bad_file:
            status, failed_rule, err_type, sev, action = _resolve_error("ERR_PARENT_MISSING_AFE", global_settings)
            rec["validation_status"] = status
            rec["failed_rule"] = failed_rule
            rec["error_type"] = err_type
            rec["severity"] = sev
            rec["failure_action"] = action
            rec["notes"] = notes + ["Parent document missing valid AFE_Number"]
        else:
            status, failed_rule, err_type, sev, action, updated_notes = validate_record(rec, rules, global_settings, dedup_set)
            rec["validation_status"] = status
            rec["failed_rule"] = failed_rule
            rec["error_type"] = err_type
            rec["severity"] = sev
            rec["failure_action"] = action
            rec["notes"] = updated_notes
        
        validated_records.append(rec)
        
    # Check for entirely absent mandatory parameters
    if not is_bad_file:
        doc_afe = None
        doc_proj = None
        for rec in validated_records:
            if rec["parameter_name"] == "AFE_Number" and rec["raw_value"]:
                doc_afe = rec["raw_value"]
            if rec["parameter_name"] == "Project_Type" and rec["raw_value"]:
                doc_proj = rec["raw_value"]
                
        generated_missing = set()
        for r in rules:
            if r.get("is_mandatory") == True or str(r.get("is_mandatory")).upper() == "YES":
                req_param = r["parameter_name"]
                if req_param not in found_params and req_param not in generated_missing:
                    status, f_rule, err_type, sev, action = _resolve_error("ERR_MISSING_MANDATORY", global_settings, r)
                    missing_rec = {
                        "AFE_Number": doc_afe,
                        "project_type": doc_proj,
                        "parameter_name": req_param,
                        "sub_parameter": None,
                        "raw_value": None,
                        "parsed_value": None,
                        "parsed_unit": None,
                        "standard_unit": None,
                        "validation_status": "FAIL",
                        "failed_rule": f_rule,
                        "error_type": err_type,
                        "severity": sev,
                        "failure_action": action,
                        "notes": ["Mandatory parameter is absent from submitted document"],
                        "filename": source_filename,
                        "json_path": None,
                        "reference_context": None,
                        "pages": None
                    }
                    validated_records.append(missing_rec)
                    generated_missing.add(req_param)
        
    # 5. Route
    normalized, curated, dlq = route_records(validated_records)
    
    # 6. Summarize
    summary_rows, summary_dict = generate_summary(normalized, curated, dlq)
    
    # 7. Integration Output
    integration_data = generate_integration_output(
        normalized, curated, dlq, summary_dict, 
        processing_mode="api_single_document", 
        source_filename=source_filename
    )
    
    return integration_data
