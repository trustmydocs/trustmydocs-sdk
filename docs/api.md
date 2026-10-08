# API contract (v1)

Base URL: `https://trustmydocs.com/api/v1`. Interactive Swagger: `https://trustmydocs.com/api/docs`. The contract is versioned and frozen: a breaking change goes to `/v2/`.

## Authentication

`Authorization: Bearer tmd_live_...`. Keys are free, requested with an email on `https://trustmydocs.com/fr/api` or with `POST /api/keys/request` (`{"email": "..."}`, neutral answer, key delivered by email). A new request for the same mailbox revokes the previous key. Disposable, placeholder and MX-less domains receive nothing.

## Endpoints

All verifications are `multipart/form-data`; one request per document.

| Endpoint | Parts | What it does |
| --- | --- | --- |
| `POST /verify/tax` | `file` (PDF or image) | Tax notice: 2D-Doc read, signature check, AI extraction, DGFiP "latest notice" check, printed-vs-signed comparison |
| `POST /verify/2ddoc` | `file` (PDF or image) | 2D-Doc code alone: signed fields and issuer certificate check |
| `POST /verify/id` | `front`, `back` (optional; carries the 2D-Doc) | New-format identity card |
| `POST /verify/old-id` | `front`, `back` (optional), images only | Old-format identity card, OCR |
| `POST /verify/passport` | `file` (image) | Passport, OCR |
| `POST /verify/payslip` | `file` (PDF or image) | Payslip, OCR |
| `POST /verify/generic` | `file` | Any other document: classification and extraction |
| `POST /tenant-file` | `tax` (max 2), `payslip` (max 6), `id_front`, `id_back`, `old_id_front`, `old_id_back`, `passport`, `other`; 12 documents, 10 MB each | Whole rental application: authenticity per document, deterministic coherence, rental capacity. Quota: one unit per analysed document |
| `GET /me` | none | Plan and usage of the key; consumes no quota |

Formats: PDF, JPG, PNG, TIFF, BMP. 32 MB per request.

## Status codes

| Code | `error` | Meaning |
| --- | --- | --- |
| 200 | | Answered (the JSON body may still say `success: false` for an unreadable document) |
| 400 | `unsupported_format`, `no_document`, `too_many_documents`, or a plain message | Bad request |
| 401 | `invalid_key` | Missing, malformed, unknown or revoked key |
| 413 | | Request too large |
| 429 | `quota_reached` | Daily quota of the key reached; `Retry-After` header |
| 429 | `service_quota_reached` | Shared beta ceiling reached; `Retry-After` header |
| 429 | `rate_limited`, `service_busy` | Key requests only |
| 503 | `unavailable` | Store or email provider unavailable; nothing was pretended |

## Response bodies

### `/verify/tax` and `/verify/id`

```json
{
  "success": true,
  "2d_doc_results": {
    "success": true,
    "certificate": { "verification": "OK" },
    "fiscal_fields": { "...": "..." },
    "Dernier avis ?": true
  },
  "llm_results": { "success": true, "extracted_fields": { "...": "..." } },
  "authenticity": true
}
```

- `certificate.verification`: `OK` (signature verified), `FAILED` (signature does not verify), `ERROR` with `error` (certificate could not be fetched; nothing was checked).
- `fiscal_fields` (tax) or `id_fields` (id): the data signed in the 2D-Doc.
- `Dernier avis ?` (tax only): `true`, `false`, or absent when the DGFiP could not be asked.
- `authenticity`: `true` when printed data matches signed data, `false` when it contradicts it, absent when nothing could be compared.

### `/verify/2ddoc`

```json
{ "success": true, "certificate": { "verification": "OK" }, "fiscal_fields": { "...": "..." }, "Dernier avis ?": true }
```

`id_fields` instead of `fiscal_fields` for an identity card code. A valid code of a type the service does not exploit yet answers `success: false` with an explanatory `error`.

### `/verify/passport`, `/verify/old-id`, `/verify/payslip`

`{ "success": true, "passport_fields": {...} }`, `{ "success": true, "old_id_fields": {...} }`, `{ "success": true, "extracted_fields": {...} }`. OCR only: nothing is proven.

### `/verify/generic`

`{ "success": true, "document_type": "...", "confidence": "...", "document_summary": "...", "extracted_text": "...", "structured_fields": {...}, "document_specific_fields": {...} }`

### `/tenant-file`

```json
{
  "success": true,
  "version": "1.0",
  "scope": "salaried",
  "documents": [{ "name": "avis.pdf", "kind": "tax", "kind_label": "...", "verdict": "authentic", "verdict_label": "...", "notes": [], "extracted": {} }],
  "checks": [{ "id": "income", "label": "...", "status": "coherent", "detail": "...", "gap_percent": 4 }],
  "rental_capacity": { "label": "..." },
  "reserves": [],
  "quota": { "per_day": 100, "used_today": 3, "service_per_day": 300, "service_used_today": 10 },
  "disclaimer": "..."
}
```

Document verdicts: `authentic`, `not_authentic`, `unverifiable`, `unreadable`, `out_of_scope`. Check statuses: `coherent`, `mismatch`, `not_comparable`.

### `/me`

`{ "email": "a***@example.com", "plan": "free", "quota_per_day": 100, "used_today": 1, "service_quota_per_day": 300, "service_used_today": 12, "usage_total": 40, "created_at": "..." }`

## How this package normalises the above

`toVerificationResult(type, raw)` in `src/result.ts` applies the website's rule and returns `verdict`, `signature`, `content`, `latest`, `checks`, `signedFields`, `extractedFields`, `raw`. See [verdicts.md](verdicts.md).
