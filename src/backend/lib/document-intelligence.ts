import type { InvoiceOcr, OcrField, OcrResult } from './intake-field-mapping'

/**
 * Azure Document Intelligence, prebuilt-invoice model, over plain `fetch`.
 *
 * Call shape verified against Microsoft Learn on 2026-07-29 (api-version
 * 2024-11-30):
 * - `POST {endpoint}/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30`
 *   with an `Ocp-Apim-Subscription-Key` header and a JSON body carrying
 *   `base64Source`. The reply is `202 Accepted` with an `Operation-Location`
 *   header.
 * - Poll that URL until `status` leaves `notStarted` and `running`; the
 *   terminal values are `succeeded` and `failed`.
 * - Results arrive as `analyzeResult.documents[].fields`, each field carrying a
 *   `confidence` between 0 and 1 and one of `valueString`, `valueNumber`,
 *   `valueDate`, `valueCurrency` (`{amount, currencyCode}`), `valueAddress`,
 *   plus the raw `content` it was read from.
 *
 * Header fields only. The model also returns line items and they are ignored:
 * coders enter the GL account and amount for each line themselves.
 */

export type DocumentIntelligenceConfig = {
  endpoint: string
  apiKey: string
}

const API_VERSION = '2024-11-30'
const MODEL_ID = 'prebuilt-invoice'

/** Ceiling on polling. A scan that has not been read by now is a failed scan. */
const MAX_POLL_MS = 120_000
const POLL_INTERVAL_MS = 2_000

export function readDocumentIntelligenceConfig(
  env: NodeJS.ProcessEnv = process.env,
): DocumentIntelligenceConfig {
  const missing = (['AZURE_DI_ENDPOINT', 'AZURE_DI_KEY'] as const).filter(
    (name) => !env[name] || env[name]?.trim() === '',
  )
  if (missing.length > 0) {
    throw new Error(`Invoice reading is not configured. Missing: ${missing.join(', ')}`)
  }
  return {
    endpoint: (env.AZURE_DI_ENDPOINT as string).replace(/\/+$/, ''),
    apiKey: env.AZURE_DI_KEY as string,
  }
}

export function isDocumentIntelligenceConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    readDocumentIntelligenceConfig(env)
    return true
  } catch {
    return false
  }
}

type AnalyzedField = {
  type?: string
  content?: string
  confidence?: number
  valueString?: string
  valueNumber?: number
  valueDate?: string
  valueCurrency?: { amount?: number; currencyCode?: string }
  valueAddress?: Record<string, string>
  valueTime?: string
  valueInteger?: number
}

type AnalyzeResponse = {
  status: 'notStarted' | 'running' | 'succeeded' | 'failed'
  error?: { code?: string; message?: string }
  analyzeResult?: {
    pages?: unknown[]
    documents?: Array<{ fields?: Record<string, AnalyzedField> }>
  }
}

export function createDocumentIntelligenceOcr(config: DocumentIntelligenceConfig): InvoiceOcr {
  return {
    async extract(file) {
      const operationUrl = await startAnalysis(config, file)
      const result = await pollAnalysis(config, operationUrl)
      return toOcrResult(result)
    },
  }
}

async function startAnalysis(
  config: DocumentIntelligenceConfig,
  file: { buffer: Buffer; contentType: string },
): Promise<string> {
  const url = `${config.endpoint}/documentintelligence/documentModels/${MODEL_ID}:analyze?api-version=${API_VERSION}`
  const response = await requestWithBackoff(url, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': config.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Source: file.buffer.toString('base64') }),
  })

  const operationUrl = response.headers.get('Operation-Location')
  if (!operationUrl) {
    console.error('[intake] the reading service accepted a file but gave no result address', {
      status: response.status,
      contentType: file.contentType,
      bytes: file.buffer.length,
    })
    throw new Error('The invoice reading service did not start a job.')
  }
  return operationUrl
}

async function pollAnalysis(config: DocumentIntelligenceConfig, operationUrl: string): Promise<AnalyzeResponse> {
  const deadline = Date.now() + MAX_POLL_MS

  while (Date.now() < deadline) {
    const response = await requestWithBackoff(operationUrl, {
      method: 'GET',
      headers: { 'Ocp-Apim-Subscription-Key': config.apiKey },
    })
    const body = (await response.json()) as AnalyzeResponse

    if (body.status === 'succeeded') return body
    if (body.status === 'failed') {
      console.error('[intake] the reading service could not read a file', {
        code: body.error?.code ?? null,
      })
      throw new Error('The invoice could not be read.')
    }
    await sleep(POLL_INTERVAL_MS)
  }

  console.error('[intake] the reading service did not finish in time', { limitMs: MAX_POLL_MS })
  throw new Error('The invoice could not be read in time.')
}

/**
 * One shared request path so throttling is handled the same way everywhere.
 * Document Intelligence answers `429` with a `Retry-After` header in seconds.
 */
async function requestWithBackoff(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  const response = await fetch(url, init)

  if (response.status === 429 && attempt < 4) {
    const header = Number(response.headers.get('Retry-After') ?? '')
    const wait = Number.isFinite(header) && header > 0 ? header * 1000 : 2 ** attempt * 1000
    await sleep(wait)
    return requestWithBackoff(url, init, attempt + 1)
  }
  if (!response.ok && response.status !== 202) {
    const detail = (await response.json().catch(() => ({}))) as { error?: { code?: string } }
    console.error('[intake] the reading service refused a request', {
      status: response.status,
      code: detail.error?.code ?? null,
    })
    throw new Error('The invoice reading service could not be reached.')
  }
  return response
}

/**
 * Flattens the model's typed values into the plain `{ value, confidence }`
 * shape the rest of the app works in. Everything becomes text; the field
 * mapping and the amount parser turn it back into dates and money, so there is
 * one place that decides what "4,861.00" means.
 */
export function toOcrResult(response: AnalyzeResponse): OcrResult {
  const document = response.analyzeResult?.documents?.[0]
  const fields: Record<string, OcrField> = {}

  for (const [name, field] of Object.entries(document?.fields ?? {})) {
    // Line items arrive as an array-valued field. Deliberately dropped.
    const value = readValue(field)
    if (value === null) continue
    fields[name] = { value, confidence: typeof field.confidence === 'number' ? field.confidence : 0 }
  }

  return { fields, pages: response.analyzeResult?.pages?.length ?? 0 }
}

function readValue(field: AnalyzedField): string | null {
  if (typeof field.valueString === 'string') return field.valueString
  if (typeof field.valueDate === 'string') return field.valueDate
  if (typeof field.valueNumber === 'number') return String(field.valueNumber)
  if (typeof field.valueInteger === 'number') return String(field.valueInteger)
  if (field.valueCurrency && typeof field.valueCurrency.amount === 'number') {
    return String(field.valueCurrency.amount)
  }
  if (field.valueAddress) return Object.values(field.valueAddress).filter(Boolean).join(', ')
  if (typeof field.content === 'string' && field.content.trim() !== '') return field.content
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
