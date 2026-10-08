export {
  ApiError,
  API_KEY_PREFIX,
  DEFAULT_BASE_URL,
  KEY_REQUEST_URL,
  SUPPORTED_EXTENSIONS,
  TrustMyDocsClient,
  looksLikeApiKey,
  toPart,
} from './client.js';
export type { ApiErrorCode, ClientOptions, DocumentInput, KeyRequestResponse, TenantFileInput } from './client.js';

export {
  DOCUMENT_TYPES,
  buildVerdict,
  contentFromAuthenticity,
  latestFromApi,
  signatureFromCertificate,
  toKeyInfo,
  toTenantFileResult,
  toVerificationResult,
} from './result.js';
export type {
  Check,
  DocumentType,
  GenericReading,
  KeyInfo,
  Quota,
  RentalCapacity,
  TenantCheck,
  TenantCheckStatus,
  TenantDocument,
  TenantDocumentVerdict,
  TenantFileResult,
  VerdictInput,
  VerificationResult,
} from './result.js';

export { describeChecks, summariseKeyInfo, summariseTenantFile, summariseVerification } from './summarise.js';
export type { DescribedCheck } from './summarise.js';

export { resolveLang } from './wording.js';
export type {
  AnalysisOutcome,
  AuthenticityDetail,
  CheckKey,
  CheckStatus,
  ContentOutcome,
  Lang,
  LatestOutcome,
  SignatureOutcome,
  Verdict,
} from './wording.js';

export { clearConfig, configPath, readConfig, resolveApiKey, resolveBaseUrl, writeConfig } from './config.js';
export type { KeySource, StoredConfig } from './config.js';

export { PACKAGE_NAME, PACKAGE_VERSION } from './version.js';
