def harmonize_data(raw_data):
    """
    Standardizes different JSON schemas into a uniform list of asset blocks.
    Input: list of (filename, dict)
    Output: list of dicts with keys: document_id, asset_name, parameters (dict of raw parameters), base_path
    """
    harmonized = []
    
    for filename, data in raw_data:
        doc_id = filename
        
        if "AFE_Extraction" in data:
            container = data["AFE_Extraction"]
            base_key = "AFE_Extraction"
            
            # Extract asset name from AFE_Number value if it exists
            asset_name = "Unknown Asset"
            if "AFE_Number" in container and isinstance(container["AFE_Number"], dict):
                val = container["AFE_Number"].get("value")
                if val is not None:
                    import re
                    cleaned = str(val)
                    cleaned = re.sub(r'(?i)afe\s*(no\.?)?\s*', '', cleaned)
                    cleaned = cleaned.replace(" ", "")
                    # sometimes the LLM extracts multiple AFEs joined by "dan" or ";"
                    # let's just grab the first token before ";" or "dan" to be safe for the primary ID, 
                    # but the user asked just to remove spaces and check length. We'll leave it as is after removing spaces.
                    asset_name = cleaned
                    container["AFE_Number"]["value"] = cleaned
            
            # Keep all params including AFE_Number in case it's needed for tracing, 
            # or remove it. We can keep it to be flattened.
            params = container
            
            harmonized.append({
                "document_id": doc_id,
                "asset_name": asset_name,
                "parameters": params,
                "base_path": base_key,
                "filename": filename
            })
                
    return harmonized
