/**
 * HTTP client for the Trust My Docs API (https://trustmydocs.com/api/v1).
 *
 * Documents are sent as multipart/form-data over HTTPS, analysed in memory on
 * the service's European servers, and deleted once the response is written.
 * The API keeps no document. See docs/api.md for the contract.
 */

import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import {
  type DocumentType,
  type KeyInfo,
  type TenantFileResult,
  type VerificationResult,
  DOCUMENT_TYPES,
  toKeyInfo,
  toTenantFileResult,
  toVerificationResult,
} from './result.js';
import { USER_AGENT } from './version.js';

export const DEFAULT_BASE_URL = 'https://trustmydocs.com';
export const API_KEY_PREFIX = 'tmd_live_';
export const KEY_REQUEST_URL = 'https://trustmydocs.com/fr/api';

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.bmp': 'image/bmp',
};

export const SUPPORTED_EXTENSIONS: readonly string[] = Object.keys(MIME);

/** Error codes the API returns in its JSON body, plus the client's own. */
export type ApiErrorCode =
  | 'invalid_key'
  | 'quota_reached'
  | 'service_quota_reached'
  | 'rate_limited'
  | 'service_busy'
  | 'invalid_email'
  | 'unavailable'
  | 'unsupported_format'
  | 'no_document'
  | 'too_many_documents'
  | 'payload_too_large'
  | 'bad_request'
  | 'network'
  | 'timeout'
  | 'missing_key'
  | 'unknown';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryAfterSeconds?: number;

  constructor(message: string, status: number, code: ApiErrorCode = 'unknown', retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * A document to send: a path on disk, raw bytes (then give a filename so the
 * API can tell the format), or a Blob/File from any runtime.
 */
export type DocumentInput =
  | string
  | Blob
  | { data: Uint8Array | Blob; filename: string; contentType?: string };

export interface ClientOptions {
  /** `tmd_live_…`, obtained for free by email on https://trustmydocs.com/fr/api */
  apiKey?: string;
  /** Defaults to https://trustmydocs.com */
  baseUrl?: string;
  /** Per-request timeout. Verifications take 5 to 30 s; a full tenant file can take minutes. */
  timeoutMs?: number;
  /** Injectable for tests. */
  fetch?: typeof fetch;
}

export interface TenantFileInput {
  /** Tax notices, 2 at most. */
  tax?: DocumentInput[];
  /** Payslips, 6 at most. */
  payslip?: DocumentInput[];
  idFront?: DocumentInput;
  idBack?: DocumentInput;
  oldIdFront?: DocumentInput;
  oldIdBack?: DocumentInput;
  passport?: DocumentInput;
  /** Documents listed in the report as out of scope, not analysed. */
  other?: DocumentInput[];
}

export interface KeyRequestResponse {
  /** Deliberately neutral: it does not reveal whether the address is known. */
  message: string;
}

const contentTypeFor = (filename: string): string | undefined => MIME[extname(filename).toLowerCase()];

/** Copies the bytes into a fresh ArrayBuffer-backed view, which Blob accepts in every runtime typing. */
const toBlob = (bytes: Uint8Array, type: string): Blob => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type });
};

/** Turns any accepted input into the (blob, filename) pair FormData expects. */
export const toPart = async (input: DocumentInput): Promise<[Blob, string]> => {
  if (typeof input === 'string') {
    const type = contentTypeFor(input);
    if (!type) {
      throw new ApiError(
        `Unsupported format: ${basename(input)}. Accepted: ${SUPPORTED_EXTENSIONS.join(', ')}.`,
        400,
        'unsupported_format',
      );
    }
    let bytes: Uint8Array;
    try {
      bytes = await readFile(input);
    } catch {
      throw new ApiError(`File not found or unreadable: ${input}`, 400, 'bad_request');
    }
    return [toBlob(bytes, type), basename(input)];
  }
  if (input instanceof Blob) {
    const name = 'name' in input && typeof (input as { name?: unknown }).name === 'string' ? (input as { name: string }).name : 'document';
    return [input, name];
  }
  const type = input.contentType ?? contentTypeFor(input.filename);
  if (!type) {
    throw new ApiError(
      `Unsupported format: ${input.filename}. Accepted: ${SUPPORTED_EXTENSIONS.join(', ')}.`,
      400,
      'unsupported_format',
    );
  }
  const blob = input.data instanceof Blob ? input.data : toBlob(input.data, type);
  return [blob, input.filename];
};

const codeFromBody = (status: number, body: Record<string, unknown>): ApiErrorCode => {
  const code = typeof body.error === 'string' ? body.error : '';
  switch (code) {
    case 'invalid_key':
    case 'quota_reached':
    case 'service_quota_reached':
    case 'rate_limited':
    case 'service_busy':
    case 'invalid_email':
    case 'unavailable':
    case 'unsupported_format':
    case 'no_document':
    case 'too_many_documents':
      return code;
  }
  if (status === 401) return 'invalid_key';
  if (status === 413) return 'payload_too_large';
  if (status === 429) return 'rate_limited';
  if (status === 400) return 'bad_request';
  if (status === 503) return 'unavailable';
  return 'unknown';
};

const describeFailure = async (response: Response): Promise<ApiError> => {
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
  } catch {
    /* not JSON: the status alone will have to do */
  }
  const code = codeFromBody(response.status, body);
  let message = String(body.message ?? body.error ?? `HTTP ${response.status}`);
  if (code === 'invalid_key') {
    message = `API key refused (${message}). Check the key, or request a free one on ${KEY_REQUEST_URL}`;
  } else if (code === 'payload_too_large') {
    message = 'Document too large to be analysed (32 MB per request).';
  }
  const retry = Number(response.headers.get('retry-after') ?? '') || undefined;
  return new ApiError(message, response.status, code, retry);
};

export class TrustMyDocsClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ClientOptions = {}) {
    this.apiKey = options.apiKey ?? '';
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 300_000;
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async request(path: string, init: { method: 'GET' | 'POST'; body?: FormData | string; json?: boolean; auth?: boolean }): Promise<unknown> {
    const headers: Record<string, string> = { 'user-agent': USER_AGENT, accept: 'application/json' };
    if (init.auth !== false) {
      if (!this.apiKey) {
        throw new ApiError(`No API key configured. Request a free one on ${KEY_REQUEST_URL}`, 0, 'missing_key');
      }
      headers.authorization = `Bearer ${this.apiKey}`;
    }
    if (init.json) headers['content-type'] = 'application/json';

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: init.method,
        headers,
        body: init.body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new ApiError(`No answer after ${Math.round(this.timeoutMs / 1000)} s.`, 0, 'timeout');
      }
      throw new ApiError(`Network error: ${error instanceof Error ? error.message : String(error)}`, 0, 'network');
    }
    if (!response.ok) throw await describeFailure(response);
    return response.json();
  }

  private async form(parts: Record<string, DocumentInput | DocumentInput[] | undefined>): Promise<FormData> {
    const form = new FormData();
    for (const [field, value] of Object.entries(parts)) {
      if (value === undefined) continue;
      for (const input of Array.isArray(value) ? value : [value]) {
        const [blob, name] = await toPart(input);
        form.append(field, blob, name);
      }
    }
    return form;
  }

  /** POST /api/v1/verify/<type>, raw JSON body. ID cards take `{ front, back? }`. */
  async verifyRaw(type: DocumentType, input: DocumentInput | { front: DocumentInput; back?: DocumentInput }): Promise<unknown> {
    if (!DOCUMENT_TYPES.includes(type)) {
      throw new ApiError(`Unknown document type "${type}". Expected one of: ${DOCUMENT_TYPES.join(', ')}.`, 400, 'bad_request');
    }
    const parts =
      typeof input === 'object' && input !== null && 'front' in input
        ? { front: input.front, back: input.back }
        : type === 'id' || type === 'old-id'
          ? { front: input as DocumentInput }
          : { file: input as DocumentInput };
    return this.request(`/api/v1/verify/${type}`, { method: 'POST', body: await this.form(parts) });
  }

  /** Same call, normalised into a stable verdict with the raw payload attached. */
  async verify(type: DocumentType, input: DocumentInput | { front: DocumentInput; back?: DocumentInput }): Promise<VerificationResult> {
    return toVerificationResult(type, await this.verifyRaw(type, input));
  }

  /** Shortcut: decode a 2D-Doc code and check its signature, nothing else. */
  async read2DDoc(input: DocumentInput): Promise<VerificationResult> {
    return this.verify('2ddoc', input);
  }

  /** POST /api/v1/tenant-file, raw JSON body. Quota: one unit per analysed document. */
  async tenantFileRaw(input: TenantFileInput): Promise<unknown> {
    const body = await this.form({
      tax: input.tax,
      payslip: input.payslip,
      id_front: input.idFront,
      id_back: input.idBack,
      old_id_front: input.oldIdFront,
      old_id_back: input.oldIdBack,
      passport: input.passport,
      other: input.other,
    });
    return this.request('/api/v1/tenant-file', { method: 'POST', body });
  }

  /** Same call, normalised. */
  async tenantFile(input: TenantFileInput): Promise<TenantFileResult> {
    return toTenantFileResult(await this.tenantFileRaw(input));
  }

  /** GET /api/v1/me: plan and consumption of the key. Does not consume quota. */
  async me(): Promise<KeyInfo> {
    return toKeyInfo(await this.request('/api/v1/me', { method: 'GET' }));
  }

  /**
   * POST /api/keys/request: asks for a free key, delivered by email. Needs no
   * key. The answer is neutral by design; the key never transits here.
   */
  async requestKey(email: string): Promise<KeyRequestResponse> {
    const body = (await this.request('/api/keys/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
      json: true,
      auth: false,
    })) as Record<string, unknown>;
    return { message: String(body.message ?? '') };
  }
}

export const looksLikeApiKey = (value: string): boolean => /^tmd_live_[A-Za-z0-9_-]{20,}$/.test(value.trim());
