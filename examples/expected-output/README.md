# Expected outputs (redacted)

Hand-edited payloads showing the shape of each answer. Every personal value is replaced by a placeholder in angle brackets; counts and structure are real. They are illustrative, not fixtures: the service may add fields, never remove or rename one within v1.

| File | Call | Shows |
| --- | --- | --- |
| `tax-authentic.json` | `/verify/tax` | valid signature, matching content, latest notice |
| `tax-superseded.json` | `/verify/tax` | valid signature, but not the latest notice |
| `tax-no-code.json` | `/verify/tax` | no readable 2D-Doc: OCR only, unverifiable |
| `tax-certificate-error.json` | `/verify/tax` | issuer certificate unreachable: unverifiable, not a forgery |
| `2ddoc-only.json` | `/verify/2ddoc` | signed fields of a tax-notice code |
| `id-authentic.json` | `/verify/id` | identity card, both sides |
| `passport.json` | `/verify/passport` | OCR only |
| `tenant-file.json` | `/tenant-file` | per-document verdicts, coherence checks, rental capacity |
| `me.json` | `/me` | key usage |
| `errors.json` | any | 401, 429, 413, 503 bodies |
| `normalised-tax-authentic.json` | package | what `client.verify('tax', ...)` returns for `tax-authentic.json` (without `raw`) |
