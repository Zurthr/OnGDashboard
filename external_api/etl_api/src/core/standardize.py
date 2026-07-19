import re
import html

def standardize_afe_number(raw_value):
    if raw_value is None or str(raw_value).strip() in ["", "None", "nan"]:
        return None
    val_str = str(raw_value).strip()
    
    # optionally remove only a clear leading label such as: AFE, AFE No., AFE Number
    # remove separators or whitespace left directly after that removed label
    pattern = r"(?i)^(?:AFE(?:(?:\s+No\.?|\s+Number))?)\s*[:\-]?\s*(.*)$"
    match = re.match(pattern, val_str)
    if match:
        return match.group(1).strip()
    return val_str

def standardize_value(raw_value, expected_type="numeric"):
    """
    Parses strings to extract raw numeric values and units, separating text noise.
    Cleanses HTML entities.
    Returns: parsed_value, parsed_unit, status_notes
    """
    if raw_value is None or raw_value == "None":
        return None, None, ["Null value"]
        
    # Clean HTML entities
    cleaned = html.unescape(str(raw_value)).strip()
    
    if expected_type == "string":
        return cleaned, None, []
    
    notes = []
    
    # Check for ambiguous text
    if re.search(r'approx|~|-', cleaned, re.IGNORECASE):
        # Could be a range or approximate
        # e.g., approx 120-130
        notes.append("ambiguous value")
        # We might not parse a clean number from this safely without losing context
        
    # Extract number and unit
    # This regex looks for an optional minus, digits, optional decimal, then optional space, then words
    match = re.match(r'^([+-]?\d+(?:\.\d+)?)\s*(.*)$', cleaned)
    
    parsed_value = None
    parsed_unit = None
    
    if match:
        val_str = match.group(1)
        rest = match.group(2).strip()
        try:
            if expected_type == "integer":
                if '.' in val_str:
                    f_val = float(val_str)
                    if f_val.is_integer():
                        parsed_value = int(f_val)
                    else:
                        # will fail validation later
                        parsed_value = f_val
                else:
                    parsed_value = int(val_str)
            else:
                if '.' in val_str:
                    parsed_value = float(val_str)
                else:
                    parsed_value = int(val_str)
        except ValueError:
            pass
            
        if rest:
            parsed_unit = rest
    else:
        # If it didn't match a starting number, it might be text noise, string list (equipment), or string number ("Four")
        notes.append("parse warning: non-numeric start")
        parsed_value = cleaned
        
    # Check for text noise in unit
    if parsed_unit and len(parsed_unit) > 15:
        # Long text instead of a short unit code
        notes.append("text noise")
        
    return parsed_value, parsed_unit, notes
