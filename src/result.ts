/**
 * Turns the raw API payloads into one stable, typed, language-neutral result.
 *
 * The verdict rule is the website's: red on a proven problem (invalid
 * signature or printed data that contradicts the signed data), green only on
 * a valid signature, amber otherwise. "Not the latest notice" is a red row
 * that does not change the verdict: the document is genuine, just superseded.
 *
 * The raw payload is always attached untouched, so nothing the API says is
 * lost behind the normalisation.
 */

import {
  type AnalysisOutcome,
  type AuthenticityDetail,
  type CheckKey,
  type CheckStatus,
  type ContentOutcome,
  type LatestOutcome,
  type SignatureOutcome,
  type Verdict,
  contentStatus,
  latestStatus,
  signatureStatus,
  verdictStatus,
} from './wording.js';

export type DocumentType = 'tax' | '2ddoc' | 'id' | 'old-id' | 'passport' | 'payslip' | 'generic';
export const DOCUMENT_TYPES: readonly DocumentType[] = ['tax', '2ddoc', 'id', 'old-id', 'passport', 'payslip', 'generic'];

export interface Check {
  key: CheckKey;
  status: CheckStatus;
  /** Machine-readable outcome; wording.ts maps it to text. */
  outcome: string;
}

export interface GenericReading {
  documentType: string;
  confidence: string;
  summary: string;
  text: string;
  structuredFields: Record<string, unknown>;
  documentSpecificFields: Record<string, unknown>;
}

export interface VerificationResult {
  type: DocumentType;
  verdict: Verdict;
  signature: SignatureOutcome;
  content: ContentOutcome;
  /** Only for tax notices and 2D-Doc codes of a tax notice. */
  latest?: LatestOutcome;
  analysis: AnalysisOutcome;
  authenticityDetail: AuthenticityDetail;
  checks: Check[];
  /** Fields carried by the 2D-Doc code: signed by the issuer. */
  signedFields: Record<string, unknown>;
  /** Fields read optically (OCR and vision model): not signed. */
  extractedFields: Record<string, unknown>;
  /** Only for the generic type. */
  generic?: GenericReading;
  /** Set when the API answered success:false. */
  error?: string;
  raw: unknown;
}

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const hasKeys = (value: Record<string, unknown>): boolean => Object.keys(value).length > 0;

/**
 * Three outcomes, not two: "OK" is a verified signature, "FAILED" is a
 * signature that does not verify, anything else (ERROR, an error alone, no
 * key) means the certificate could not be consulted and nothing was checked.
 */
export const signatureFromCertificate = (certificate: unknown): 'valid' | 'invalid' | 'unavailable' => {
  const cert = record(certificate);
  if (cert.verification === 'OK') return 'valid';
  if (cert.verification === 'FAILED' && !cert.error) return 'invalid';
  return 'unavailable';
};

export const contentFromAuthenticity = (value: unknown): ContentOutcome =>
  value === true ? 'match' : value === false ? 'mismatch' : 'not_comparable';

export const latestFromApi = (value: unknown): LatestOutcome =>
  value === true ? 'yes' : value === false ? 'no' : 'unavailable';

export interface VerdictInput {
  signature: SignatureOutcome;
  content: ContentOutcome;
  latest?: LatestOutcome;
}

export const buildVerdict = (input: VerdictInput): { verdict: Exclude<Verdict, 'error'>; authenticityDetail: AuthenticityDetail } => {
  const verdict: Exclude<Verdict, 'error'> =
    input.content === 'mismatch' || input.signature === 'invalid'
      ? 'not_authentic'
      : input.signature === 'valid'
        ? 'authentic'
        : 'unverifiable';

  const content = contentStatus[input.content];
  const authenticityDetail: AuthenticityDetail =
    verdict === 'authentic'
      ? content === 'ok'
        ? 'signed_and_matching'
        : content === 'unknown'
          ? 'signed_content_unknown'
          : 'signed_only'
      : verdict === 'not_authentic'
        ? input.signature === 'invalid'
          ? 'invalid_signature'
          : 'content_mismatch'
        : 'unverifiable';

  return { verdict, authenticityDetail };
};

const buildChecks = (input: VerdictInput, analysis: AnalysisOutcome, verdict: Verdict): Check[] => {
  const checks: Check[] = [
    { key: 'analysis', status: 'done', outcome: analysis },
    { key: 'signature', status: signatureStatus[input.signature], outcome: input.signature },
    { key: 'content', status: contentStatus[input.content], outcome: input.content },
  ];
  if (input.latest) checks.push({ key: 'latest', status: latestStatus[input.latest], outcome: input.latest });
  checks.push({ key: 'authenticity', status: verdictStatus[verdict], outcome: verdict });
  return checks;
};

const assemble = (
  type: DocumentType,
  input: VerdictInput,
  analysis: AnalysisOutcome,
  signedFields: Record<string, unknown>,
  extractedFields: Record<string, unknown>,
  raw: unknown,
  generic?: GenericReading,
): VerificationResult => {
  const { verdict, authenticityDetail } = buildVerdict(input);
  return {
    type,
    verdict,
    signature: input.signature,
    content: input.content,
    latest: input.latest,
    analysis,
    authenticityDetail,
    checks: buildChecks(input, analysis, verdict),
    signedFields,
    extractedFields,
    generic,
    raw,
  };
};

const failure = (type: DocumentType, raw: unknown, message: string): VerificationResult => ({
  type,
  verdict: 'error',
  signature: 'absent',
  content: 'no_signed_data',
  analysis: 'ocr_no_code',
  authenticityDetail: 'unverifiable',
  checks: [],
  signedFields: {},
  extractedFields: {},
  error: message,
  raw,
});

const errorMessage = (data: Record<string, unknown>): string =>
  String(data.message ?? data.error ?? 'unspecified error');

/** Tax notice or new-format ID card: 2D-Doc plus optical reading, cross-checked. */
const signedDocument = (type: 'tax' | 'id', raw: unknown): VerificationResult => {
  const data = record(raw);
  const twoDoc = record(data['2d_doc_results']);
  const signedFields = record(type === 'tax' ? twoDoc.fiscal_fields : twoDoc.id_fields);
  const twoDocRead = twoDoc.success === true && hasKeys(signedFields);
  const llm = record(data.llm_results);
  const extractedFields = record(llm.extracted_fields);
  const llmRead = llm.success === true && hasKeys(extractedFields);

  const signature: SignatureOutcome = twoDocRead ? signatureFromCertificate(twoDoc.certificate) : 'absent';
  const content: ContentOutcome = twoDocRead ? (llmRead ? contentFromAuthenticity(data.authenticity) : 'not_comparable') : 'no_signed_data';
  const latest: LatestOutcome | undefined = type === 'tax' ? (twoDocRead ? latestFromApi(twoDoc['Dernier avis ?']) : 'no_code') : undefined;

  return assemble(type, { signature, content, latest }, twoDocRead ? 'code_and_ocr' : 'ocr_no_code', signedFields, extractedFields, raw);
};

/** Standalone 2D-Doc reading: signature only, no optical reading to compare with. */
const codeOnly = (raw: unknown): VerificationResult => {
  const data = record(raw);
  const isFiscal = hasKeys(record(data.fiscal_fields));
  const signedFields = record(data.fiscal_fields ?? data.id_fields);
  const signature = signatureFromCertificate(data.certificate);
  const latest = isFiscal ? latestFromApi(data['Dernier avis ?']) : undefined;
  return assemble('2ddoc', { signature, content: 'code_only', latest }, 'code_only', signedFields, {}, raw);
};

/** Passport, old-format ID card, payslip: optical reading only, nothing can be proven. */
const ocrOnly = (type: 'passport' | 'old-id' | 'payslip', raw: unknown, key: string, analysis: AnalysisOutcome): VerificationResult => {
  const fields = record(record(raw)[key]);
  return assemble(type, { signature: 'not_applicable', content: 'not_applicable' }, analysis, {}, fields, raw);
};

const generic = (raw: unknown): VerificationResult => {
  const data = record(raw);
  const reading: GenericReading = {
    documentType: String(data.document_type ?? ''),
    confidence: String(data.confidence ?? ''),
    summary: String(data.document_summary ?? ''),
    text: String(data.extracted_text ?? ''),
    structuredFields: record(data.structured_fields),
    documentSpecificFields: record(data.document_specific_fields),
  };
  return assemble('generic', { signature: 'not_applicable', content: 'not_applicable' }, 'generic', {}, reading.structuredFields, raw, reading);
};

/** Normalises the JSON body of POST /api/v1/verify/<type>. */
export const toVerificationResult = (type: DocumentType, raw: unknown): VerificationResult => {
  const data = record(raw);
  if (data.success === false) return failure(type, raw, errorMessage(data));
  switch (type) {
    case 'tax':
      return signedDocument('tax', raw);
    case 'id':
      return signedDocument('id', raw);
    case '2ddoc':
      return codeOnly(raw);
    case 'passport':
      return ocrOnly('passport', raw, 'passport_fields', 'passport');
    case 'old-id':
      return ocrOnly('old-id', raw, 'old_id_fields', 'old_id');
    case 'payslip':
      return ocrOnly('payslip', raw, 'extracted_fields', 'payslip');
    case 'generic':
      return generic(raw);
  }
};

// ------------------------------------------------------------ tenant file

export type TenantDocumentVerdict = 'authentic' | 'not_authentic' | 'unverifiable' | 'unreadable' | 'out_of_scope' | string;
export type TenantCheckStatus = 'coherent' | 'mismatch' | 'not_comparable' | string;

export interface TenantDocument {
  name: string;
  kind: string;
  kindLabel: string;
  verdict: TenantDocumentVerdict;
  verdictLabel: string;
  notes: string[];
  extracted: Record<string, unknown>;
}

export interface TenantCheck {
  id: string;
  label: string;
  status: TenantCheckStatus;
  detail: string;
  gapPercent?: number;
}

export interface RentalCapacity {
  label?: string;
  [key: string]: unknown;
}

export interface Quota {
  perDay: number;
  usedToday: number;
  servicePerDay: number;
  serviceUsedToday: number;
}

export interface TenantFileResult {
  success: boolean;
  version: string;
  scope: string;
  documents: TenantDocument[];
  checks: TenantCheck[];
  rentalCapacity: RentalCapacity | null;
  reserves: string[];
  quota?: Quota;
  disclaimer: string;
  error?: string;
  raw: unknown;
}

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Normalises the JSON body of POST /api/v1/tenant-file. */
export const toTenantFileResult = (raw: unknown): TenantFileResult => {
  const data = record(raw);
  const quota = record(data.quota);
  return {
    success: data.success === true,
    version: String(data.version ?? ''),
    scope: String(data.scope ?? ''),
    documents: list(data.documents).map((entry) => {
      const item = record(entry);
      return {
        name: String(item.name ?? ''),
        kind: String(item.kind ?? ''),
        kindLabel: String(item.kind_label ?? item.kind ?? ''),
        verdict: String(item.verdict ?? 'unverifiable'),
        verdictLabel: String(item.verdict_label ?? item.verdict ?? ''),
        notes: list(item.notes).map(String),
        extracted: record(item.extracted),
      };
    }),
    checks: list(data.checks).map((entry) => {
      const item = record(entry);
      const check: TenantCheck = {
        id: String(item.id ?? ''),
        label: String(item.label ?? ''),
        status: String(item.status ?? ''),
        detail: String(item.detail ?? ''),
      };
      if (typeof item.gap_percent === 'number') check.gapPercent = item.gap_percent;
      return check;
    }),
    rentalCapacity: data.rental_capacity && typeof data.rental_capacity === 'object' ? (data.rental_capacity as RentalCapacity) : null,
    reserves: list(data.reserves).map(String),
    quota: hasKeys(quota)
      ? {
          perDay: Number(quota.per_day ?? 0),
          usedToday: Number(quota.used_today ?? 0),
          servicePerDay: Number(quota.service_per_day ?? 0),
          serviceUsedToday: Number(quota.service_used_today ?? 0),
        }
      : undefined,
    disclaimer: String(data.disclaimer ?? ''),
    error: data.success === false ? errorMessage(data) : undefined,
    raw,
  };
};

// ------------------------------------------------------------ key info

export interface KeyInfo {
  /** Masked by the API. */
  email: string;
  plan: string;
  quotaPerDay: number;
  usedToday: number;
  serviceQuotaPerDay: number;
  serviceUsedToday: number;
  usageTotal: number;
  createdAt: string;
  raw: unknown;
}

/** Normalises the JSON body of GET /api/v1/me. */
export const toKeyInfo = (raw: unknown): KeyInfo => {
  const data = record(raw);
  return {
    email: String(data.email ?? ''),
    plan: String(data.plan ?? ''),
    quotaPerDay: Number(data.quota_per_day ?? 0),
    usedToday: Number(data.used_today ?? 0),
    serviceQuotaPerDay: Number(data.service_quota_per_day ?? 0),
    serviceUsedToday: Number(data.service_used_today ?? 0),
    usageTotal: Number(data.usage_total ?? 0),
    createdAt: String(data.created_at ?? ''),
    raw,
  };
};
