from pydantic import BaseModel, ConfigDict
from typing import Dict, Any, Optional, List, Union

class ETLRequest(BaseModel):
    source_filename: str
    payload: Dict[str, Any]

class HealthResponse(BaseModel):
    status: str
    pipeline_version: str
    contract_version: str

class RunInfo(BaseModel):
    run_id: str
    timestamp: str
    pipeline_version: str
    contract_version: str
    processing_mode: str
    source_filename: Optional[str] = None

class ValidationSummary(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    total_documents: int
    total_normalized_records: int
    pass_count: int
    pass_rate: str
    warning_count: int
    warning_rate: str
    failed_count: int
    dlq_rate: str

class CuratedRecord(BaseModel):
    afe_number: Optional[str] = None
    project_type: Optional[str] = None
    parameter_name: str
    sub_parameter: Optional[str] = None
    value: Union[str, int, float, None] = None
    unit: Optional[str] = None
    validation_status: str
    notes: List[str]
    filename: Optional[str] = None
    json_path: Optional[str] = None
    reference_context: Optional[str] = None
    pages: Union[str, int, List[Union[str, int]], None] = None

class DLQRecord(BaseModel):
    afe_number: Optional[str] = None
    project_type: Optional[str] = None
    parameter_name: str
    sub_parameter: Optional[str] = None
    raw_value: Union[str, int, float, None] = None
    normalized_value: Union[str, int, float, None] = None
    failed_rule: Optional[str] = None
    error_type: Optional[str] = None
    severity: Optional[str] = None
    failure_action: Optional[str] = None
    reference_context: Optional[str] = None
    pages: Union[str, int, List[Union[str, int]], None] = None
    json_path: Optional[str] = None
    filename: Optional[str] = None

class ETLResponse(BaseModel):
    run_info: RunInfo
    validation_summary: ValidationSummary
    curated_records: List[CuratedRecord]
    dlq_records: List[DLQRecord]
