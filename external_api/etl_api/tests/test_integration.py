import os
import json
from src.core.integration import generate_integration_output

def test_integration_output_generation(tmp_path):
    normalized = [
        {
            "AFE_Number": "AFE-001",
            "parameter_name": "Project_Type",
            "parsed_value": "Drilling",
            "raw_value": "Drilling"
        },
        {
            "AFE_Number": "AFE-001",
            "parameter_name": "Total_Depth",
            "parsed_value": 15000,
            "raw_value": "15,000 ft"
        }
    ]
    
    curated = [
        {
            "AFE_Number": "AFE-001",
            "parameter_name": "Total_Depth",
            "sub_parameter": None,
            "parsed_value": 15000,
            "standard_unit": "ft",
            "validation_status": "PASS",
            "notes": ["Clean parsed"],
            "filename": "afe_doc.json",
            "json_path": "root.Total_Depth",
            "reference_context": "The total depth is 15000 ft",
            "pages": [1]
        }
    ]
    
    dlq = [
        {
            "AFE_Number": "AFE-001",
            "parameter_name": "Rig_Rate",
            "sub_parameter": None,
            "raw_value": "Missing",
            "normalized_value": None,
            "failed_rule": "R-101",
            "error_type": "MISSING_MANDATORY",
            "severity": "HIGH",
            "failure_action": "Flag for Review",
            "reference_context": None,
            "pages": None,
            "json_path": "root.Rig_Rate",
            "source_file": "afe_doc.json"
        }
    ]
    
    # Generate output
    summary_metrics = {"total_documents": 1}
        
    data = generate_integration_output(normalized, curated, dlq, summary_metrics=summary_metrics)
        
    assert "run_info" in data
    assert "validation_summary" in data
    assert "curated_records" in data
    assert "dlq_records" in data
    
    # Check project type association
    assert data["curated_records"][0]["project_type"] == "Drilling"
    assert data["dlq_records"][0]["project_type"] == "Drilling"
    
    # Check numeric types
    assert isinstance(data["curated_records"][0]["value"], int)
    assert data["curated_records"][0]["value"] == 15000
    
    # Check summary parsing
    assert data["validation_summary"]["total_documents"] == 1
