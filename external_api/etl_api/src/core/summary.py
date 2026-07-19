import csv
import os
from collections import Counter

def generate_summary(normalized, curated, dlq):
    doc_ids = set([r["AFE_Number"] for r in normalized])
    total_docs = len(doc_ids)
    total_records = len(normalized)
    
    pass_count = sum(1 for r in normalized if r["validation_status"] == "PASS")
    # Actually warning count isn't explicitly defined in my validation yet, we just have PASS or FAIL.
    # We will assume warnings are FAILs with a 'Flag for Review / Impute' or 'Cleanse / Flag' but still FAIL,
    # or they are PASS with warnings. Let's just base it on curated vs DLQ.
    warning_count = sum(1 for r in normalized if r["validation_status"] == "WARNING")
    failed_count = len(dlq)
    
    pass_rate = pass_count / total_records if total_records else 0
    warning_rate = warning_count / total_records if total_records else 0
    dlq_rate = failed_count / total_records if total_records else 0
    
    error_types = Counter([r["error_type"] for r in dlq if r.get("error_type")])
    param_errors = Counter([r["parameter_name"] for r in dlq])
    
    summary_rows = [
        {"metric": "total_documents", "value": total_docs},
        {"metric": "total_normalized_records", "value": total_records},
        {"metric": "pass_count", "value": pass_count},
        {"metric": "pass_rate", "value": f"{pass_rate:.2%}"},
        {"metric": "warning_count", "value": warning_count},
        {"metric": "warning_rate", "value": f"{warning_rate:.2%}"},
        {"metric": "failed_count", "value": failed_count},
        {"metric": "dlq_rate", "value": f"{dlq_rate:.2%}"},
    ]
    
    for etype, count in error_types.items():
        summary_rows.append({"metric": f"error_type:{etype}", "value": count})
        
    for param, count in param_errors.items():
        summary_rows.append({"metric": f"error_parameter:{param}", "value": count})
        
    # Returning as a dictionary to be used by integration
    summary_dict = {}
    for row in summary_rows:
        summary_dict[row["metric"]] = row["value"]
        
    return summary_rows, summary_dict
