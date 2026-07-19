# REST API Reference

## `GET /health`
Returns the status of the API and versioning info.

**Response**
```json
{
  "status": "ok",
  "pipeline_version": "1.1.0",
  "contract_version": "1.0"
}
```

## `POST /api/v1/etl/process`
Processes a single document payload through the validation rules.

**Request**
```json
{
  "source_filename": "string",
  "payload": {
     // Extracted JSON dict
  }
}
```

**Response (200 OK)**
```json
{
  "run_info": {
    "run_id": "uuid string",
    "timestamp": "ISO-8601",
    "pipeline_version": "1.1.0",
    "contract_version": "1.0",
    "processing_mode": "api_single_document",
    "source_filename": "string"
  },
  "validation_summary": {
    "total_documents": 1,
    "total_normalized_records": 10,
    "pass_count": 8,
    "failed_count": 2,
    "pass_rate": "80.0%",
    "dlq_rate": "20.0%"
  },
  "curated_records": [
    {
      "afe_number": "string",
      "project_type": "string",
      "parameter_name": "string",
      "sub_parameter": "string|null",
      "value": "string|number|null",
      "unit": "string|null",
      "validation_status": "PASS|WARNING",
      "notes": ["string"],
      "filename": "string",
      "json_path": "string",
      "reference_context": "string",
      "pages": "string|number"
    }
  ],
  "dlq_records": [
    {
      "afe_number": "string",
      "project_type": "string",
      "parameter_name": "string",
      "sub_parameter": "string|null",
      "raw_value": "string|null",
      "normalized_value": "string|number|null",
      "failed_rule": "string",
      "error_type": "string",
      "severity": "string",
      "failure_action": "string",
      "reference_context": "string",
      "pages": "string|number",
      "json_path": "string",
      "filename": "string"
    }
  ]
}
```
