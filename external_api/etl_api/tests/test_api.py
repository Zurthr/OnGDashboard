import json
import os
from fastapi.testclient import TestClient
from src.api.app import app

client = TestClient(app)

def setup_module(module):
    valid_payload = {
        "source_filename": "AFE-001.json",
        "payload": {
            "AFE_Extraction": {
                "AFE_Number": {
                    "value": "18-21A-218-OO",
                    "reference_context": "AFE No. 18-21A-218-OO Meliwis WHP",
                    "pages": "2, 5, 6"
                },
                "Project_Type": {
                    "value": "Platform",
                    "reference_context": "Mini Jacket - Crossings EJGP",
                    "pages": "2"
                },
                "Water_Depth": {
                    "value": "120 m",
                    "reference_context": "Found on page 2",
                    "pages": "2"
                },
                "Weight_Topside": {
                    "value": "1500 MT",
                    "reference_context": "Deck sekitar 97.6MT",
                    "pages": "2"
                },
                "Weight_Jacket": {
                    "value": "2000 MT",
                    "reference_context": "Jacket Tiga Kaki",
                    "pages": "2"
                },
                "Piling_Weight": {
                    "value": "500 MT",
                    "reference_context": "Piles",
                    "pages": "2"
                },
                "Number_of_Legs": {
                    "value": "4",
                    "reference_context": "Jacket Tiga Kaki",
                    "pages": "2"
                },
                "Number_of_Slots": {
                    "value": "12",
                    "reference_context": "WHP memiliki 2 Wells",
                    "pages": "2"
                },
                "Topside_Equipment": {
                    "Wellhead": {
                        "value": "Unit WHP dengan 2 Wells conductor slot",
                        "reference_context": "Satu unit WHP",
                        "pages": "2"
                    }
                },
                "Impurities": {
                    "H2S": {
                        "value": "10 ppm",
                        "reference_context": "H2S concentration is 10 ppm",
                        "pages": "9"
                    }
                }
            }
        }
    }
    
    os.makedirs("examples", exist_ok=True)
    with open("examples/api_request_valid_example.json", "w") as f:
        json.dump(valid_payload, f, indent=2)
        
    response = client.post("/api/v1/etl/process", json=valid_payload)
    with open("examples/api_response_valid_example.json", "w") as f:
        json.dump(response.json(), f, indent=2)
        
    dlq_payload = {
        "source_filename": "AFE-002.json",
        "payload": {
            "AFE_Extraction": {
                "AFE_Number": {
                    "value": "04-3811",
                    "reference_context": "AFE 04-3811",
                    "pages": "1"
                },
                "Project_Type": {
                    "value": "Platform",
                    "reference_context": "Platform",
                    "pages": "1"
                },
                "Water_Depth": {
                    "value": "invalid depth m",
                    "reference_context": "Water depth invalid",
                    "pages": "2"
                },
                "Weight_Topside": {
                    "value": "1500000000 MT",
                    "reference_context": "Topside weight outlier",
                    "pages": "3"
                }
            }
        }
    }
    
    with open("examples/api_request_dlq_example.json", "w") as f:
        json.dump(dlq_payload, f, indent=2)
        
    response = client.post("/api/v1/etl/process", json=dlq_payload)
    with open("examples/api_response_dlq_example.json", "w") as f:
        json.dump(response.json(), f, indent=2)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "pipeline_version" in data
    assert "contract_version" in data

def test_valid_example_match():
    with open("examples/api_request_valid_example.json") as f:
        req = json.load(f)
    with open("examples/api_response_valid_example.json") as f:
        expected = json.load(f)
        
    response = client.post("/api/v1/etl/process", json=req)
    assert response.status_code == 200
    resp = response.json()
    
    # Remove dynamic fields
    resp["run_info"]["run_id"] = ""
    resp["run_info"]["timestamp"] = ""
    expected["run_info"]["run_id"] = ""
    expected["run_info"]["timestamp"] = ""
    
    assert resp == expected
    
    # Verify no DLQ records, and check topside equipment is string
    assert len(resp["dlq_records"]) == 0
    topside_rec = next(r for r in resp["curated_records"] if r["parameter_name"] == "topside_equipment")
    assert topside_rec["value"] == "Unit WHP dengan 2 Wells conductor slot"
    assert topside_rec["unit"] is None

def test_dlq_example_match():
    with open("examples/api_request_dlq_example.json") as f:
        req = json.load(f)
    with open("examples/api_response_dlq_example.json") as f:
        expected = json.load(f)
        
    response = client.post("/api/v1/etl/process", json=req)
    assert response.status_code == 200 # DLQ still returns 200!
    resp = response.json()
    
    # Remove dynamic fields
    resp["run_info"]["run_id"] = ""
    resp["run_info"]["timestamp"] = ""
    expected["run_info"]["run_id"] = ""
    expected["run_info"]["timestamp"] = ""
    
    assert resp == expected
    
    # Verify there are DLQ records (e.g. absent mandatory parameters)
    assert len(resp["dlq_records"]) > 0

def test_process_invalid_payload_type():
    payload = {
        "source_filename": "test.json",
        "payload": [] # Invalid payload type, should be dict, caught by pydantic 422
    }
    response = client.post("/api/v1/etl/process", json=payload)
    assert response.status_code == 422

def test_process_empty_payload():
    payload = {
        "source_filename": "test.json",
        "payload": {} # Empty dict
    }
    response = client.post("/api/v1/etl/process", json=payload)
    assert response.status_code == 400
