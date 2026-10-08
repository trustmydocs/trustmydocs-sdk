# Integrate in TypeScript / Node.js

```sh
npm install trustmydocs
```

Node 20 or newer, ESM. Types are included.

## Verify one document

```ts
import { TrustMyDocsClient, ApiError } from 'trustmydocs';

const client = new TrustMyDocsClient({ apiKey: process.env.TRUSTMYDOCS_API_KEY });

try {
  const result = await client.verify('tax', './avis-imposition.pdf');

  switch (result.verdict) {
    case 'authentic':      // valid signature; see result.content and result.latest for the rest
    case 'not_authentic':  // invalid signature or printed data contradicting the signed data
    case 'unverifiable':   // no readable code, certificate unreachable, OCR-only type
    case 'error':          // the API could not process the file: result.error
  }

  console.log(result.signature, result.content, result.latest);
  console.log(result.signedFields);     // what the issuer signed
  console.log(result.extractedFields);  // what OCR and the vision model read (not signed)
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.code, error.status, error.message, error.retryAfterSeconds);
  }
}
```

Document types: `tax`, `2ddoc`, `id`, `old-id`, `passport`, `payslip`, `generic`. Identity cards take both sides:

```ts
await client.verify('id', { front: './cni-recto.jpg', back: './cni-verso.jpg' });
```

## Inputs

A path, a `Blob`/`File`, or bytes with a filename (the extension tells the API the format):

```ts
await client.verify('payslip', { data: new Uint8Array(buffer), filename: 'fiche.pdf' });
await client.verify('2ddoc', fileFromAnUploadForm);  // File or Blob
```

Accepted: `.pdf .jpg .jpeg .png .tif .tiff .bmp`, 32 MB per request.

## Rental application in one call

```ts
const report = await client.tenantFile({
  tax: ['./avis-2025.pdf'],
  payslip: ['./paie-07.pdf', './paie-08.pdf', './paie-09.pdf'],
  idFront: './cni-recto.jpg',
  idBack: './cni-verso.jpg',
});

for (const doc of report.documents) console.log(doc.name, doc.verdict);
for (const check of report.checks) console.log(check.id, check.status, check.detail);
console.log(report.rentalCapacity?.label, report.reserves, report.quota);
```

Quota: one unit per analysed document. Limits: 2 tax notices, 6 payslips, 12 documents, 10 MB each.

## Raw payloads and the checks grid

```ts
const raw = await client.verifyRaw('tax', './avis.pdf');       // untouched JSON
const result = toVerificationResult('tax', raw);               // normalise later, or elsewhere
const grid = describeChecks(result, 'fr');                      // labels and sentences as the website shows them
console.log(summariseVerification(result, 'en', { fields: false }));
```

`result.raw` is always attached, so nothing the API says is hidden.

## Errors

`ApiError.code`: `invalid_key`, `quota_reached`, `service_quota_reached` (shared beta ceiling), `rate_limited`, `payload_too_large`, `unsupported_format`, `unavailable`, `timeout`, `network`, `missing_key`, `bad_request`, `unknown`. `retryAfterSeconds` is set on 429.

## Key management

```ts
await new TrustMyDocsClient().requestKey('you@company.fr');  // key arrives by email; the answer is neutral
const info = await client.me();                               // quotaPerDay, usedToday, serviceUsedToday...
```

Helpers used by the CLI are exported too: `resolveApiKey()`, `readConfig()`, `writeConfig()`.

## Options

```ts
new TrustMyDocsClient({
  apiKey: 'tmd_live_...',
  baseUrl: 'https://trustmydocs.com',  // default
  timeoutMs: 300_000,                   // default; a full tenant file can take minutes
  fetch: customFetch,                   // tests, proxies
});
```

## Serverless and edge runtimes

The client uses `fetch`, `FormData` and `Blob` only. Reading a path uses `node:fs`; pass bytes or a `Blob` where there is no filesystem.
