import { shapeEtlRecords, type BulkCuratedData, type RawCuratedRecord, type RawDlqRecord } from './etlOutput'

/**
 * Base URL for Izzafi's Validation-Aware ETL API (the izzafi_etl_api package).
 * Override with the ETL_API_BASE_URL env var in production; defaults to the
 * local dev server started via `./run_api.sh` (uvicorn on 127.0.0.1:8000, per
 * that project's README/API_INTEGRATION_GUIDE_FOR_ANAS.md).
 */
const ETL_API_BASE_URL = (process.env.ETL_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
const ETL_ENDPOINT = `${ETL_API_BASE_URL}/api/v1/etl/process`

export interface EtlDocumentInput {
  source_filename: string
  payload: Record<string, unknown>
}

interface EtlApiResponse {
  run_info: {
    run_id: string
    timestamp: string
    pipeline_version: string
    contract_version: string
    processing_mode: string
    source_filename?: string
  }
  validation_summary: Record<string, unknown>
  curated_records: RawCuratedRecord[]
  dlq_records: RawDlqRecord[]
}

export interface EtlDocumentError {
  source_filename: string
  status: number | null
  message: string
}

/**
 * Calls the live ETL API once per document — its contract is one document
 * per request (see API_INTEGRATION_GUIDE_FOR_ANAS.md: "Send a single JSON
 * document payload per request"), unlike the old integration_output.json
 * file which had every document pre-aggregated. Every document's
 * curated_records/dlq_records get combined into that same aggregated shape
 * before handing off to shapeEtlRecords() — the actual pivoting/grouping
 * logic doesn't change regardless of where the raw records came from.
 *
 * A failure on one document (malformed payload -> 400, unexpected ETL
 * exception -> 500, or the API being unreachable entirely) does not abort
 * the whole import: it's collected in `errors` and every other document
 * still gets processed, so one bad file doesn't block importing the rest
 * of a batch upload.
 */
export async function fetchEtlDataFromApi(
  documents: EtlDocumentInput[]
): Promise<BulkCuratedData & { errors: EtlDocumentError[] }> {
  const allCurated: RawCuratedRecord[] = []
  const allDlq: RawDlqRecord[] = []
  const errors: EtlDocumentError[] = []

  for (const doc of documents) {
    try {
      const response = await $fetch<EtlApiResponse>(ETL_ENDPOINT, {
        method: 'POST',
        body: {
          source_filename: doc.source_filename,
          payload: doc.payload,
        },
      })
      allCurated.push(...(response.curated_records ?? []))
      allDlq.push(...(response.dlq_records ?? []))
    } catch (err: any) {
      // Covers three distinct failure modes the ETL API's own docs call out:
      // 400 (malformed payload), 500 (unexpected technical exception), and
      // the API not being reachable at all (connection refused / DNS/etc,
      // which ofetch/$fetch surfaces without a .response at all).
      errors.push({
        source_filename: doc.source_filename,
        status: err?.response?.status ?? err?.statusCode ?? null,
        message: err?.data?.detail ?? err?.message ?? 'Failed to reach the ETL API',
      })
    }
  }

  const shaped = shapeEtlRecords(allCurated, allDlq)
  return { ...shaped, errors }
}
