import json

def flatten_records(harmonized_data):
    """
    Flattens harmonized nested structures into discrete parameter-level records.
    Input: list of asset blocks from harmonize.py
    Output: list of flattened parameter records
    """
    records = []
    
    for block in harmonized_data:
        doc_id = block["document_id"]
        afe_number = block["asset_name"]
        params = block["parameters"]
        base_path = block["base_path"]
        filename = block["filename"]
        
        for param_key, param_value in params.items():
            json_path = f"{base_path}.{param_key}" if "[" not in param_key else f'{base_path}["{param_key}"]'
            if " " in param_key:
                json_path = f'{base_path}["{param_key}"]'
                
            if isinstance(param_value, dict):
                if "value" in param_value:
                    val = param_value.get("value")
                    unit = param_value.get("unit") 
                    ref_context = param_value.get("reference_context")
                    pages = param_value.get("pages")
                    
                    if val is None:
                        raw_val_str = None
                    else:
                        raw_val_str = str(val) if unit is None else f"{val} {unit}"
                    
                    records.append({
                        "AFE_Number": afe_number,
                        "parameter_name": param_key,
                        "sub_parameter": None,
                        "raw_value": raw_val_str,
                        "reference_context": ref_context,
                        "pages": pages,
                        "json_path": json_path,
                        "filename": filename
                    })
                else:
                    # Sub-parameters like Impurities or Topside_Equipment
                    for sub_k, sub_v in param_value.items():
                        sub_path = f'{json_path}.{sub_k}' if " " not in sub_k else f'{json_path}["{sub_k}"]'
                        
                        ref_context = None
                        pages = None
                        
                        if isinstance(sub_v, dict) and "value" in sub_v:
                            val = sub_v.get("value")
                            ref_context = sub_v.get("reference_context")
                            pages = sub_v.get("pages")
                            if val is None:
                                raw_val_str = None
                            else:
                                raw_val_str = str(val)
                        else:
                            raw_val_str = str(sub_v) if sub_v is not None else None
                            
                        records.append({
                            "AFE_Number": afe_number,
                            "parameter_name": param_key,
                            "sub_parameter": sub_k,
                            "raw_value": raw_val_str,
                            "reference_context": ref_context,
                            "pages": pages,
                            "json_path": sub_path,
                            "filename": filename
                        })
            else:
                # Fallback for unexpected scalar values at root
                raw_val_str = str(param_value) if param_value is not None else None
                records.append({
                    "AFE_Number": afe_number,
                    "parameter_name": param_key,
                    "sub_parameter": None,
                    "raw_value": raw_val_str,
                    "reference_context": None,
                    "pages": None,
                    "json_path": json_path,
                    "filename": filename
                })
                
    return records
