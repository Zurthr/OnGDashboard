def _resolve_error(err_code, sys_rules, rule=None):
    mapping = sys_rules["ERROR_MAPPINGS"].get(err_code)
    if mapping:
        f_rule = mapping["failed_rule"]
        e_type = mapping["error_type"]
        
        sev = rule.get("severity") if rule and pd.notnull(rule.get("severity")) else mapping["severity"]
        act = rule.get("failure_action") if rule and pd.notnull(rule.get("failure_action")) else mapping["failure_action"]
            
        return "FAIL", f_rule, e_type, sev, act
    return "FAIL", err_code, err_code, "error", "DLQ_REVIEW"

def _run_validation(record, rules, sys_rules, deduplication_set):
    """
    Validates a single record against business rules.
    Returns: validation_status, failed_rule, error_type, severity, failure_action, notes
    """
    param = record["parameter_name"]
    sub_param = record["sub_parameter"]
    val = record["parsed_value"]
    unit = record["standard_unit"]
    notes = record["notes"]
    
    # Global check: If the document's master AFE_Number is invalid, fail EVERY parameter from this document
    afe = record.get("AFE_Number")
    max_afe_len = sys_rules.get("MAX_AFE_LENGTH", 13)
    if sys_rules.get("REQUIRE_VALID_AFE", True):
        if not afe or str(afe).strip() == "" or str(afe).strip() == "Unknown Asset":
            status, f_rule, e_type, sev, act = _resolve_error("ERR_MISSING_AFE", sys_rules)
            return "FAIL", f_rule, e_type, sev, act, notes + ["Missing AFE Number"]
    if afe and len(str(afe)) > max_afe_len:
        status, f_rule, e_type, sev, act = _resolve_error("ERR_INVALID_AFE_LEN", sys_rules)
        return status, f_rule, e_type, sev, act, notes + [f"Document AFE_Number exceeds {max_afe_len} characters"]
    
    # Check duplicate
    dedup_key = (record.get("filename"), afe, param, sub_param)
    if dedup_key in deduplication_set:
        status, f_rule, e_type, sev, act = _resolve_error("ERR_DUPLICATE", sys_rules)
        return status, f_rule, e_type, sev, act, notes + ["Conflicting duplicate parameter"]
    deduplication_set.add(dedup_key)
    
    # Find matching rule
    rule = None
    for r in rules:
        if r["parameter_name"] == param:
            r_sub = r.get("sub_parameter")
            if pd.isna(r_sub) or r_sub is None or r_sub == sub_param:
                rule = r
                break
            
    if not rule:
        status, f_rule, e_type, sev, act = _resolve_error("ERR_NOT_IN_SCHEMA", sys_rules)
        return status, f_rule, e_type, sev, act, notes + ["Parameter not in schema"]
        
    # Check missing mandatory
    if rule.get("is_mandatory") == True or str(rule.get("is_mandatory")).upper() == "YES":
        if val is None or str(val).strip() == "" or str(val).lower() == "nan":
            status, f_rule, e_type, sev, act = _resolve_error("ERR_MISSING_MANDATORY", sys_rules, rule)
            return status, f_rule, e_type, sev, act, notes + ["Value is missing"]

    if val is None or str(val).strip() == "" or str(val).lower() == "nan":
        raw_val = record.get("raw_value")
        if raw_val is None or str(raw_val).strip() == "" or str(raw_val).lower() == "nan":
            status, f_rule, e_type, sev, act = _resolve_error("ERR_MISSING_OPTIONAL", sys_rules)
            return status, f_rule, e_type, sev, act, notes + ["Empty optional value"]
            
        if "ambiguous value" in notes:
            status, f_rule, e_type, sev, act = _resolve_error("ERR_AMBIGUOUS_VALUE", sys_rules, rule)
            return status, f_rule, e_type, sev, act, notes
        if "text noise" in notes:
            status, f_rule, e_type, sev, act = _resolve_error("ERR_TEXT_NOISE", sys_rules, rule)
            return status, f_rule, e_type, sev, act, notes
            
        status, f_rule, e_type, sev, act = _resolve_error("ERR_PARSE_ERROR", sys_rules, rule)
        return status, f_rule, e_type, sev, act, notes

    # Check data type
    expected_type = str(rule.get("expected_type", "")).lower()
    
    # We skip type enforcement if value is null because missing value logic handles nulls
    if val is not None and str(val).strip() != "" and str(val).lower() != "nan":
        if expected_type == "string":
            if not isinstance(val, str):
                status, f_rule, e_type, sev, act = _resolve_error("ERR_TYPE_CHECK", sys_rules, rule)
                return status, f_rule, e_type, sev, act, notes + ["Expected string"]
        elif expected_type == "integer":
            if not isinstance(val, int) or isinstance(val, bool):
                status, f_rule, e_type, sev, act = _resolve_error("ERR_TYPE_CHECK", sys_rules, rule)
                return status, f_rule, e_type, sev, act, notes + ["Expected integer"]
        elif expected_type in ["numeric", "float"]:
            if not isinstance(val, (int, float)) or isinstance(val, bool):
                 status, f_rule, e_type, sev, act = _resolve_error("ERR_TYPE_CHECK", sys_rules, rule)
                 return status, f_rule, e_type, sev, act, notes + [f"Expected {expected_type}"]

    # Check missing/invalid unit
    accepted_units = str(rule.get("accepted_units", "")).split(",")
    accepted_units = [u.strip() for u in accepted_units if u.strip()]
    
    if accepted_units and str(accepted_units) != "['nan']" and str(accepted_units) != "['None']":
        if not unit:
            status, f_rule, e_type, sev, act = _resolve_error("ERR_MISSING_UNIT", sys_rules, rule)
            return status, f_rule, e_type, sev, act, notes + ["Missing unit"]
        if unit not in accepted_units and unit != rule.get("standard_unit"):
            err_code = "ERR_NONSTD_IMPURITY_UNIT" if param == "impurities" else "ERR_INVALID_UNIT"
            status, f_rule, e_type, sev, act = _resolve_error(err_code, sys_rules, rule)
            return status, f_rule, e_type, sev, act, notes + [f"Invalid unit {unit}"]
            
    # Check range outlier
    if isinstance(val, (int, float)):
        min_val = rule.get("min_value")
        max_val = rule.get("max_value")
        try:
            if min_val is not None and not pd.isna(min_val) and val < float(min_val):
                status, f_rule, e_type, sev, act = _resolve_error("ERR_RANGE_OUTLIER", sys_rules, rule)
                return status, f_rule, e_type, sev, act, notes + ["Below min value"]
            if max_val is not None and not pd.isna(max_val) and val > float(max_val):
                status, f_rule, e_type, sev, act = _resolve_error("ERR_RANGE_OUTLIER", sys_rules, rule)
                return status, f_rule, e_type, sev, act, notes + ["Above max value"]
        except ValueError:
            pass
            
    # Check text noise
    if "text noise" in notes:
        status, f_rule, e_type, sev, act = _resolve_error("ERR_TEXT_NOISE", sys_rules, rule)
        return status, f_rule, e_type, sev, act, notes

    return "PASS", None, None, None, None, notes

def validate_record(record, rules, sys_rules, deduplication_set):
    status, failed_rule, err_type, sev, action, notes = _run_validation(record, rules, sys_rules, deduplication_set)
    if status == "FAIL" and str(sev).lower() == "warning":
        status = "WARNING"
    return status, failed_rule, err_type, sev, action, notes

import pandas as pd
