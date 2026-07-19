# Integration Output Contract

The file `integration_output.json` serves as the structured data contract between the Validation-Aware ETL pipeline and downstream consumers (like a Nuxt BFF).

## Structure
The JSON root contains four primary keys:

```json
{
  "run_info": {},
  "validation_summary": {},
  "curated_records": [],
  "dlq_records": []
}
```

### 1. run_info
Contains metadata about the ETL execution.
- `run_id` (string): Unique identifier for this run.
- `timestamp` (string): ISO 8601 UTC timestamp of the run.
- `pipeline_version` (string): Pipeline version identifier.
- `contract_version` (string): Output schema version identifier.
- `processing_mode` (string): Identifies execution context (e.g., `batch_evaluation` or `api_single_document`).
- `source_filename` (string): Origin filename.

### 2. validation_summary
Contains aggregated statistics of the run mapping directly to the legacy CSV output.
- `total_documents` (int)
- `total_normalized_records` (int)
- `pass_count` (int), `pass_rate` (string percentage)
- `failed_count` (int), `dlq_rate` (string percentage)

### 3. curated_records
Array of records that passed validation (or accepted warnings). 
- `afe_number` (string): Parent AFE identifier.
- `project_type` (string | null): Derived project type from the source document.
- `parameter_name` (string): Canonical parameter name.
- `sub_parameter` (string | null): The sub-parameter name, if nested.
- `value` (number | string | null): The standardized numeric or text value. Serialized as a JSON number when appropriate.
- `unit` (string | null): The standardized unit.
- `validation_status` (string): Either `PASS` or `WARNING`.
- `notes` (array of strings): Parsing or validation notes.
- `filename` (string): Origin file.
- `json_path` (string): Specific location in the source JSON.
- `reference_context` (string | null): Contextual string from the source.
- `pages` (array | string | null): Sourced page numbers.

### 4. dlq_records
Array of records that failed validation.
- Retains structural tracing fields (`afe_number`, `project_type`, `parameter_name`, `sub_parameter`, `filename`, `json_path`, `reference_context`, `pages`).
- `raw_value` (string | null): The unparsed original value.
- `normalized_value` (number | string | null): The parsed attempt.
- `failed_rule` (string): The identifier of the rule that failed.
- `error_type` (string): Categorical error (e.g., `MISSING_MANDATORY`).
- `severity` (string): Error severity level.
- `failure_action` (string): The determined routing action (e.g., `Drop`, `Flag for Review`).

## Database Readiness
This contract enables clean mapping to relational structures:
1. `run_info` -> ETL Audit/Run tables.
2. `curated_records` -> `Fact_CuratedData` with `project_type` natively included to group parameters by AFE context.
3. `dlq_records` -> `Fact_DLQ` for review routing queues.
