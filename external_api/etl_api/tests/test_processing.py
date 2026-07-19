import os
from src.core.processing import process_single_document
from src.core.rules import load_aliases, load_unit_mapping, load_validation_rules, load_global_settings
import pytest

aliases = load_aliases()
unit_mapping = load_unit_mapping()
rules = load_validation_rules()
sys_rules = load_global_settings()

def test_missing_mandatory_detection():
    # Only supply AFE_Number and Project_Type
    payload = {
        "AFE_Extraction": {
            "AFE_Number": {"value": "AFE 04-3810"},
            "Project_Type": {"value": "Platform"}
        }
    }
    
    result = process_single_document(
        payload=payload,
        source_filename="test_missing.json",
        rules=rules,
        global_settings=sys_rules,
        aliases=aliases,
        unit_mapping=unit_mapping
    )
    
    dlq = result["dlq_records"]
    missing_records = [r for r in dlq if r["error_type"] == "missing mandatory value"]
    
    # We should have multiple missing mandatory parameters (e.g. water_depth, topside_weight, etc.)
    assert len(missing_records) > 0
    param_names = [r["parameter_name"] for r in missing_records]
    assert "water_depth" in param_names
    assert "topside_weight" in param_names

def test_string_standardization():
    # Topside Equipment should be parsed as string
    payload = {
        "AFE_Extraction": {
            "AFE_Number": {"value": "AFE 04-3810"},
            "Topside_Equipment": {
                "Compressor": {"value": "2 Units"}
            }
        }
    }
    
    result = process_single_document(
        payload=payload,
        source_filename="test_string.json",
        rules=rules,
        global_settings=sys_rules,
        aliases=aliases,
        unit_mapping=unit_mapping
    )
    
    # We expect 2 Units to be in curated if it passes schema
    all_recs = result["curated_records"] + result["dlq_records"]
    topside_rec = next(r for r in all_recs if r["parameter_name"] == "topside_equipment")
    
    assert topside_rec["value"] == "2 Units" or topside_rec["raw_value"] == "2 Units"
    if topside_rec.get("validation_status") == "PASS":
        assert topside_rec["value"] == "2 Units"
        assert topside_rec["unit"] is None

def test_config_portability():
    # Run config load from different CWD
    original_cwd = os.getcwd()
    try:
        os.chdir("/tmp")
        # should not raise FileNotFoundError
        aliases_tmp = load_aliases()
        assert aliases_tmp is not None
    finally:
        os.chdir(original_cwd)

def test_afe_normalization():
    from src.core.standardize import standardize_afe_number
    
    assert standardize_afe_number("18-21A-218-OO") == "18-21A-218-OO"
    assert standardize_afe_number("AFE 04-3810") == "04-3810"
    assert standardize_afe_number("AFE-04-3810") == "04-3810"
    assert standardize_afe_number("AFE No. 04-3810") == "04-3810"
    assert standardize_afe_number("  18-21A-218-OO  ") == "18-21A-218-OO"
    assert standardize_afe_number("AFE Number: 18-21A-218-OO") == "18-21A-218-OO"
