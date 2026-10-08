# Examples

Runnable scripts that call the Trust My Docs API. Bring your own documents: none are committed here, because every tax notice, identity card or payslip carries personal data, and a 2D-Doc signature covers the content, so a document cannot be redacted and stay verifiable.

All examples read the key from `TRUSTMYDOCS_API_KEY` (free: `npx trustmydocs login` or https://trustmydocs.com/fr/api).

| Folder | What | Run |
| --- | --- | --- |
| `node/` | Plain JavaScript with the `trustmydocs` package | `node examples/node/verify-tax.mjs ./avis.pdf` |
| `typescript/` | Typed usage, custom handling per verdict | `npx tsx examples/typescript/verify.ts ./avis.pdf` |
| `python/` | Standalone client (no dependency beyond `requests`) | `python examples/python/verify_tax.py ./avis.pdf` |
| `curl/` | Raw HTTP | `examples/curl/verify-tax.sh ./avis.pdf` |
| `github-actions/` | Verify documents uploaded to a repository or an issue flow | copy the workflow |
| `no-code/` | Make and n8n HTTP module settings | read |
| `expected-output/` | Redacted, hand-edited payloads showing each shape | read |

Quota note: each verification costs one unit of the key's daily quota (100) and of the shared beta ceiling (300). `GET /me` is free.
