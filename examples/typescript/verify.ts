// Typed usage: exhaustive handling of the verdict and of the API errors.
//   TRUSTMYDOCS_API_KEY=... npx tsx examples/typescript/verify.ts ./avis.pdf [type]
import { ApiError, DOCUMENT_TYPES, TrustMyDocsClient, type DocumentType, type VerificationResult } from 'trustmydocs';

const [file, typeArg = 'tax'] = process.argv.slice(2);
if (!file || !DOCUMENT_TYPES.includes(typeArg as DocumentType)) {
  console.error(`usage: verify.ts <file> [${DOCUMENT_TYPES.join('|')}]`);
  process.exit(1);
}
const type = typeArg as DocumentType;

const decide = (result: VerificationResult): string => {
  switch (result.verdict) {
    case 'authentic':
      return result.latest === 'no' ? 'genuine but superseded: ask for the latest notice' : 'accept';
    case 'not_authentic':
      return result.signature === 'invalid' ? 'reject: forged or altered code' : 'reject: printed text differs from signed data';
    case 'unverifiable':
      return result.signature === 'unavailable' ? 'retry later: issuer certificate unreachable' : 'manual review: no cryptographic proof';
    case 'error':
      return `could not process: ${result.error}`;
  }
};

const client = new TrustMyDocsClient({ apiKey: process.env.TRUSTMYDOCS_API_KEY, timeoutMs: 120_000 });

try {
  const result = await client.verify(type, type === 'id' || type === 'old-id' ? { front: file } : file);
  console.log(decide(result));
  console.table(result.checks.map(({ key, status, outcome }) => ({ key, status, outcome })));
} catch (error) {
  if (error instanceof ApiError) {
    const action: Record<string, string> = {
      invalid_key: 'get a key: npx trustmydocs login',
      quota_reached: `wait ${error.retryAfterSeconds ?? '?'} s`,
      service_quota_reached: 'shared beta ceiling reached, try tomorrow',
      payload_too_large: 'compress or split the file (32 MB max)',
    };
    console.error(error.code, action[error.code] ?? error.message);
  } else {
    throw error;
  }
  process.exitCode = 1;
}
