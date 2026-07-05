import os
import time
import uuid
import json
from json_repair import repair_json
import base64
import fitz  # PyMuPDF
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from docling.document_converter import DocumentConverter
from ollama import Client
from dotenv import load_dotenv

load_dotenv(override=True)

OLLAMA_URL = os.getenv("OLLAMA_URL", "https://ollama.defendercf.com").strip().strip('"').strip("'")
CF_CLIENT_ID = os.getenv("CF_ACCESS_CLIENT_ID", "").strip().strip('"').strip("'")
CF_CLIENT_SECRET = os.getenv("CF_ACCESS_CLIENT_SECRET", "").strip().strip('"').strip("'")

auth_headers = {
    'CF-Access-Client-Id': f'{CF_CLIENT_ID}.access',
    'CF-Access-Client-Secret': f'{CF_CLIENT_SECRET}'
}

UPLOAD_DIR = os.path.join(os.getcwd(), "temp_workspace")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- AUTOMATIC CLEANUP SYSTEM ---
# Set the max age to 3 hours (in seconds)
MAX_FILE_AGE_SECONDS = 3 * 60 * 60 
# Set how often the server should check for old files (e.g., every half an hour)
CLEANUP_CHECK_INTERVAL = 30 * 60 

async def periodic_cleanup():
    while True:
        # Wait for 1 hour before checking
        await asyncio.sleep(CLEANUP_CHECK_INTERVAL)
        
        now = time.time()
        # Scan the temp directory
        for filename in os.listdir(UPLOAD_DIR):
            file_path = os.path.join(UPLOAD_DIR, filename)
            
            # Make sure it's a file, not a subfolder
            if os.path.isfile(file_path):
                # Check how old the file is
                file_age = now - os.path.getmtime(file_path)
                
                if file_age > MAX_FILE_AGE_SECONDS:
                    try:
                        os.remove(file_path)
                        print(f"🗑️ Cleaned up expired file: {filename}")
                    except Exception as e:
                        print(f"⚠️ Failed to delete expired file {filename}: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the background cleanup task when the server starts
    cleanup_task = asyncio.create_task(periodic_cleanup())
    yield
    # Cancel the task safely if the server shuts down
    cleanup_task.cancel()

app = FastAPI(title="SKK Migas AFE Extraction API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- STATUS TRACKING HELPER ---
def set_job_status(job_id: str, status: str, stage: str, progress: int, result: dict = None, error: str = None):
    status_file = os.path.join(UPLOAD_DIR, f"{job_id}_status.json")
    payload = {
        "status": status,
        "stage": stage,
        "progress": progress,
        "result": result,
        "error": error
    }
    with open(status_file, "w", encoding="utf-8") as f:
        json.dump(payload, f)

def is_pdf_scanned(pdf_path, threshold=150):
    doc = fitz.open(pdf_path)
    total_chars = 0
    pages_to_check = min(3, len(doc))
    for i in range(pages_to_check):
        total_chars += len(doc[i].get_text("text").strip())
    doc.close()
    return (total_chars / pages_to_check) < threshold

# --- CORE EXTRACTION WITH STAGE UPDATES ---
def process_pdf_and_ask(pdf_path, question, job_id):
    client = Client(host=OLLAMA_URL, headers=auth_headers)
    extracted_markdown = ""

    # STAGE 1: Document Conversion / OCR
    if is_pdf_scanned(pdf_path):
        set_job_status(job_id, "processing", "Converting into markdown (Scanned Vision OCR)...", 25)
        doc = fitz.open(pdf_path)
        for i in range(len(doc)):
            # Update progress dynamically per page!
            page_prog = 25 + int((i / len(doc)) * 30)
            set_job_status(job_id, "processing", f"Converting page {i+1}/{len(doc)} into markdown...", page_prog)
            
            page = doc.load_page(i)
            pix = page.get_pixmap(matrix=fitz.Matrix(1.3, 1.3)) 
            img_b64 = base64.b64encode(pix.tobytes("png")).decode("utf-8")
            
            retries = 2
            while retries >= 0:
                try:
                    ocr_response = client.chat(
                        model='glm-ocr',
                        messages=[{
                            'role': 'user',
                            'content': 'Extract all text and tabular data from this image. Output in clean Markdown format.',
                            'images': [img_b64]
                        }]
                    )
                    extracted_markdown += f"--- Page {i + 1} ---\n{ocr_response['message']['content']}\n\n"
                    break
                except Exception as e:
                    if retries == 0:
                        extracted_markdown += f"--- Page {i + 1} ---\n[Error: Server timeout]\n\n"
                    else:
                        time.sleep(3)
                    retries -= 1
        doc.close()
    else:
        set_job_status(job_id, "processing", "Converting into markdown (Docling Native)...", 30)
        converter = DocumentConverter()
        result = converter.convert(pdf_path)
        doc = result.document
        parts = [f"--- Page {p} ---\n{doc.export_to_markdown(page_no=p)}" for p in range(1, len(doc.pages) + 1)]
        extracted_markdown = "\n\n".join(parts)
        # --- NEW: CONTEXT SIZE CHECK ---
        # Roughly 4 characters per token. 120,000 chars is ~30,000 tokens.
        MAX_MARKDOWN_CHARS = 120000 
        
        if len(extracted_markdown) > MAX_MARKDOWN_CHARS:
            # We raise a ValueError here. The try/except block in your worker 
            # function will catch this instantly and update the Vue UI to "error".
            estimated_tokens = len(extracted_markdown) // 4
            raise ValueError(f"File is too large to be extracted! (Estimated {estimated_tokens} tokens exceeds the safety limit).")

    # STAGE 2: LLM Extraction
    set_job_status(job_id, "processing", "Currently Extracting parameters (Gemma 4)...", 65)
    gemma_prompt = f"{question}\n\n4. Expected Input:\n```markdown\n{extracted_markdown}\n```\n"
    
    final_response = client.chat(
        model='gemma4:e4b',
        messages=[{'role': 'user', 'content': gemma_prompt}],
        options={'num_ctx': 32768}
    )
    return final_response['message']['content']

# --- BACKGROUND TASK WORKER ---
def run_extraction_job(job_id: str, pdf_path: str):
    user_query = """
    1. ROLE
    Act as an Expert Offshore Petroleum Engineer and Data Extraction Specialist.

    2. OBJECTIVE
    Your objective is to analyze unstructured Authorization for Expenditure (AFE) documents and accurately extract:
    (a) two document-level identifiers — AFE Number and Project Type; and
    (b) eight specific offshore structural parameters — Water Depth, Weight Topside, Weight Jacket, Piling Weight, Number of Legs, Number of Slots, Topside Equipment, and Impurities.

    3. INSTRUCTIONS
    * Scan the Text: Review the provided AFE document text for the document identifiers and the target parameters.
    * Keyword Association: Use industry-standard abbreviations and keywords to identify the data:
        * AFE Number: AFE No, AFE Number, AFE #, Authorization for Expenditure No
        * Project Type: Platform, Subsea, project type, development type (e.g. "Platform Project")
        * Water Depth: Water Depth, WD, depth, ft, meters
        * Weight Topside: Topside Weight, Deck Weight, Topsides, tons, MT
        * Weight Jacket: Jacket Weight, Substructure Weight, tons, MT
        * Piling Weight: Piling Weight, Piles, tons, MT
        * Number of Legs: Number of Legs, Legs, 4-leg, 8-leg
        * Number of Slots: Number of Slots, Slots, well slots
        * Topside Equipment: equipment, facilities; Wellhead (wellhead, X-mas tree); Processing (separator, process facilities, gas/oil processing); Utilities (power generation, utility systems)
        * Impurities: H2S (hydrogen sulfide), CO2 (carbon dioxide), Hg (mercury), sour gas, contaminants
    * Extraction Rules: If a parameter is explicitly stated, extract the numeric value and its associated unit.
    * Impurity Rule: For H2S, CO2, and Hg, extract the percentage value if stated. If the value is given in a non-percentage form (e.g. ppm, mg/m3, or a qualitative note), record it exactly as written without converting it.
    * Context Requirement: For every extracted value, extract the exact sentence where the data was found to serve as the reference context.
    * Page Requirement: For every extracted value, record the page number(s) of the source document where the value was found. Only use page numbers explicitly present in the provided text (e.g. page markers). If the page cannot be determined, return "Not Found". Do not guess page numbers.
    * Handling Missing Data: If a parameter is not mentioned in the text, return null for the value, "Not Found" for the reference context, and "Not Found" for the pages. Do not infer, guess, or calculate values if they are not explicitly provided in the text.
    * Formatting Constraint: Output the final response strictly in the JSON format provided below. Do not include any conversational text, explanations, or markdown formatting outside of the JSON block.

    4. FORMATTED JSON OUTPUT
    {
    "AFE_Extraction": {
        "AFE_Number": {
        "value": "[Extracted AFE number, or null]",
        "reference_context": "[Exact sentence from text, or 'Not Found']",
        "pages": "[Page number(s), or 'Not Found']"
        },
        "Project_Type": {
        "value": "[Platform / Subsea / etc., or null]",
        "reference_context": "[Exact sentence from text, or 'Not Found']",
        "pages": "[Page number(s), or 'Not Found']"
        },
        "Water_Depth": {
        "value": "[Extracted value and unit, or null]",
        "reference_context": "[Exact sentence from text, or 'Not Found']",
        "pages": "[Page number(s), or 'Not Found']"
        },
        "Weight_Topside": {
        "value": "[Extracted value and unit, or null]",
        "reference_context": "[Exact sentence from text, or 'Not Found']",
        "pages": "[Page number(s), or 'Not Found']"
        },
        "Weight_Jacket": {
        "value": "[Extracted value and unit, or null]",
        "reference_context": "[Exact sentence from text, or 'Not Found']",
        "pages": "[Page number(s), or 'Not Found']"
        },
        "Piling_Weight": {
        "value": "[Extracted value and unit, or null]",
        "reference_context": "[Exact sentence from text, or 'Not Found']",
        "pages": "[Page number(s), or 'Not Found']"
        },
        "Number_of_Legs": {
        "value": "[Extracted integer, or null]",
        "reference_context": "[Exact sentence from text, or 'Not Found']",
        "pages": "[Page number(s), or 'Not Found']"
        },
        "Number_of_Slots": {
        "value": "[Extracted integer, or null]",
        "reference_context": "[Exact sentence from text, or 'Not Found']",
        "pages": "[Page number(s), or 'Not Found']"
        },
        "Topside_Equipment": {
        "Wellhead": {
            "value": "[Extracted description, or null]",
            "reference_context": "[Exact sentence from text, or 'Not Found']",
            "pages": "[Page number(s), or 'Not Found']"
        },
        "Processing": {
            "value": "[Extracted description, or null]",
            "reference_context": "[Exact sentence from text, or 'Not Found']",
            "pages": "[Page number(s), or 'Not Found']"
        },
        "Utilities": {
            "value": "[Extracted description, or null]",
            "reference_context": "[Exact sentence from text, or 'Not Found']",
            "pages": "[Page number(s), or 'Not Found']"
        }
        },
        "Impurities": {
        "H2S": {
            "value": "[Percentage if stated, otherwise raw value, or null]",
            "reference_context": "[Exact sentence from text, or 'Not Found']",
            "pages": "[Page number(s), or 'Not Found']"
        },
        "CO2": {
            "value": "[Percentage if stated, otherwise raw value, or null]",
            "reference_context": "[Exact sentence from text, or 'Not Found']",
            "pages": "[Page number(s), or 'Not Found']"
        },
        "Hg": {
            "value": "[Percentage if stated, otherwise raw value, or null]",
            "reference_context": "[Exact sentence from text, or 'Not Found']",
            "pages": "[Page number(s), or 'Not Found']"
        }
        }
    }
    }
    """
    
    try:
        raw_result = process_pdf_and_ask(pdf_path, user_query, job_id)
        
        clean_json_str = raw_result.strip()
        if clean_json_str.startswith("```json"):
            clean_json_str = clean_json_str[7:]
        if clean_json_str.endswith("```"):
            clean_json_str = clean_json_str[:-3]
        
        # Use repair_json with return_dicts=True to automatically fix LLM typos
        parsed_json = repair_json(clean_json_str.strip(), return_objects=True)
        
        # Add a quick safeguard just in case the LLM outputs complete gibberish
        if not parsed_json:
            raise ValueError("LLM output could not be parsed into valid JSON even after repair.")
        
        # STAGE 3: Done!
        set_job_status(job_id, "done", "Extraction Complete", 100, result=parsed_json)
            
    except Exception as e:
        set_job_status(job_id, "error", "Failed during processing", 0, error=str(e))
    
    finally:
        # Add this to delete the uploaded PDF:
        if os.path.exists(pdf_path):
            os.remove(pdf_path)

# --- API ENDPOINTS ---
@app.post("/api/extract/start")
async def start_extraction(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())
    pdf_path = os.path.join(UPLOAD_DIR, f"{job_id}.pdf")
    
    with open(pdf_path, "wb") as f:
        f.write(await file.read())
        
    # Initialize status immediately
    set_job_status(job_id, "processing", "File uploaded. Starting background worker...", 10)
    
    background_tasks.add_task(run_extraction_job, job_id, pdf_path)
    return {"jobId": job_id, "status": "processing"}

@app.get("/api/extract/status")
async def check_status(jobId: str):
    status_file = os.path.join(UPLOAD_DIR, f"{jobId}_status.json")
    
    if not os.path.exists(status_file):
        return {"status": "queued", "stage": "Waiting in queue...", "progress": 5}
        
    with open(status_file, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    return data