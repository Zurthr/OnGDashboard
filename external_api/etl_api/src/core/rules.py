import csv
import pandas as pd
import os
from pathlib import Path

def _get_default_config_dir():
    return Path(__file__).resolve().parent.parent.parent / "config"

def load_aliases(alias_path=None):
    if alias_path is None:
        alias_path = _get_default_config_dir() / "parameter_aliases.csv"
    aliases = {}
    if os.path.exists(alias_path):
        with open(alias_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                aliases[row['alias'].lower()] = row['canonical_name']
    return aliases

def load_unit_mapping(unit_path=None):
    if unit_path is None:
        unit_path = _get_default_config_dir() / "unit_mapping.csv"
    mapping = {}
    if os.path.exists(unit_path):
        with open(unit_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                mapping[row['alias']] = row['canonical_unit']
    return mapping

def load_validation_rules(rules_path=None):
    """
    Loads parameter rules into a list of dicts.
    """
    if rules_path is None:
        rules_path = _get_default_config_dir() / "validation_rules.xlsx"
        
    if not os.path.exists(rules_path):
        return []
    
    df = pd.read_excel(rules_path, sheet_name='Parameter_Rules')
    df = df.where(pd.notnull(df), None)
    return df.to_dict('records')

def load_global_settings(sys_path=None):
    """
    Loads system configuration rules into a dictionary.
    """
    if sys_path is None:
        sys_path = _get_default_config_dir() / "validation_rules.xlsx"
        
    sys_rules = {
        "REQUIRE_VALID_AFE": True,
        "MAX_AFE_LENGTH": 13,
        "ERROR_MAPPINGS": {}
    }
    if not os.path.exists(sys_path):
        return sys_rules
        
    df_globals = pd.read_excel(sys_path, sheet_name='Global_Settings')
    for _, row in df_globals.iterrows():
        setting_name = row.get("setting_name")
        setting_value = row.get("setting_value")
        if setting_name == "REQUIRE_VALID_AFE":
            sys_rules["REQUIRE_VALID_AFE"] = bool(setting_value)
        elif setting_name == "MAX_AFE_LENGTH":
            sys_rules["MAX_AFE_LENGTH"] = int(setting_value)
            
    df_errors = pd.read_excel(sys_path, sheet_name='Error_Messages')
    for _, row in df_errors.iterrows():
        err_code = row.get("internal_error_code")
        sys_rules["ERROR_MAPPINGS"][err_code] = {
            "failed_rule": str(row.get("failed_rule_output")) if pd.notnull(row.get("failed_rule_output")) else "",
            "error_type": str(row.get("error_type_output")) if pd.notnull(row.get("error_type_output")) else "",
            "severity": str(row.get("fallback_severity")) if pd.notnull(row.get("fallback_severity")) else "",
            "failure_action": str(row.get("fallback_action")) if pd.notnull(row.get("fallback_action")) else ""
        }
                
    return sys_rules

def get_canonical_name(raw_name, aliases):
    lower_name = raw_name.lower().strip()
    return aliases.get(lower_name, raw_name)

def get_canonical_unit(raw_unit, unit_mapping):
    if not raw_unit:
        return raw_unit
    # direct match
    if raw_unit in unit_mapping:
        return unit_mapping[raw_unit]
    # case-insensitive match
    for k, v in unit_mapping.items():
        if k.lower() == raw_unit.lower():
            return v
    return raw_unit
