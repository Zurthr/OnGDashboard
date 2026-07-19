import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.core.validate import validate_record
from src.core.rules import load_global_settings

SYS_RULES = load_global_settings()

def test_missing_mandatory():
    rules = [{"parameter_name": "water_depth", "mandatory": True, "severity": "High", "failure_action": "Flag for Review"}]
    rec = {
        "filename": "D1.json", "AFE_Number": "A1", "parameter_name": "water_depth",
        "sub_parameter": None, "raw_value": None, "parsed_value": None,
        "parsed_unit": None, "standard_unit": None, "json_path": "", "notes": []
    }
    status, failed_rule, err, sev, action, notes = validate_record(rec, rules, SYS_RULES, set())
    assert status == "FAIL"
    assert err == "empty value"

def test_invalid_unit():
    rules = [{"parameter_name": "water_depth", "accepted_units": "m,ft", "severity": "High"}]
    rec = {
        "filename": "D1.json", "AFE_Number": "A1", "parameter_name": "water_depth",
        "sub_parameter": None, "raw_value": "45 gal", "parsed_value": 45,
        "parsed_unit": "gal", "standard_unit": "gal", "json_path": "", "notes": []
    }
    status, failed_rule, err, sev, action, notes = validate_record(rec, rules, SYS_RULES, set())
    assert status == "FAIL"
    assert err == "invalid unit"

def test_range_outlier():
    rules = [{"parameter_name": "water_depth", "min_value": 0, "max_value": 5000}]
    rec = {
        "filename": "D1.json", "AFE_Number": "A1", "parameter_name": "water_depth",
        "sub_parameter": None, "raw_value": "9999 m", "parsed_value": 9999,
        "parsed_unit": "m", "standard_unit": "m", "json_path": "", "notes": []
    }
    status, failed_rule, err, sev, action, notes = validate_record(rec, rules, SYS_RULES, set())
    assert status == "FAIL"
    assert err == "range outlier"
