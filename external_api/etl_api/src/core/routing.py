import csv
import os

def route_records(validated_records):
    """
    Routes valid records to curated output and failed records to DLQ.
    Outputs: normalized, curated, dlq lists of dicts
    """
    
    normalized = []
    curated = []
    dlq = []
    
    for rec in validated_records:
        # Normalized contains detailed parsing info and context
        normalized_row = {
            "AFE_Number": rec.get("AFE_Number"),
            "parameter_name": rec.get("parameter_name"),
            "sub_parameter": rec.get("sub_parameter"),
            "raw_value": rec.get("raw_value"),
            "parsed_value": rec.get("parsed_value"),
            "parsed_unit": rec.get("parsed_unit"),
            "standard_unit": rec.get("standard_unit"),
            "reference_context": rec.get("reference_context"),
            "pages": rec.get("pages"),
            "json_path": rec.get("json_path"),
            "validation_status": rec.get("validation_status"),
            "notes": "; ".join(rec.get("notes", []))
        }
        normalized.append(normalized_row)
        
        status = rec.get("validation_status")
        if status in ["PASS", "WARNING"]:
            curated_row = {
                "AFE_Number": rec.get("AFE_Number"),
                "parameter_name": rec.get("parameter_name"),
                "sub_parameter": rec.get("sub_parameter"),
                "value": rec.get("parsed_value"),
                "unit": rec.get("standard_unit"),
                "validation_status": rec.get("validation_status"),
                "notes": "; ".join(rec.get("notes", []))
            }
            curated.append(curated_row)
        elif status == "FAIL":
            dlq_row = {
                "AFE_Number": rec.get("AFE_Number"),
                "parameter_name": rec.get("parameter_name"),
                "sub_parameter": rec.get("sub_parameter"),
                "raw_value": rec.get("raw_value"),
                "normalized_value": rec.get("parsed_value"),
                "failed_rule": rec.get("failed_rule"),
                "error_type": rec.get("error_type"),
                "severity": rec.get("severity"),
                "failure_action": rec.get("failure_action"),
                "reference_context": rec.get("reference_context"),
                "pages": rec.get("pages"),
                "json_path": rec.get("json_path"),
                "source_file": rec.get("filename")
            }
            # Only put it in DLQ if action is not explicitly Drop? Wait, if they want it in DLQ, we keep it. 
            # I will just write it.
            dlq.append(dlq_row)
            
    curated_original = [r for r in validated_records if r.get("validation_status") in ["PASS", "WARNING"]]
    
    return normalized, curated_original, dlq
