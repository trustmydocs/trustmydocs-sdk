# Make, n8n, Zapier: the HTTP module is enough

The full tutorial with screenshots is on the website: https://trustmydocs.com/fr/automatisation-make

## Make (ex-Integromat)

HTTP module, *Make a request*:

| Setting | Value |
| --- | --- |
| URL | `https://trustmydocs.com/api/v1/verify/tax` (or another type, see `docs/api.md`) |
| Method | POST |
| Headers | `Authorization` : `Bearer tmd_live_...` |
| Body type | Multipart/form-data |
| Field | key `file`, type *File*, data = the binary from the previous module (Gmail attachment, Drive file, webhook upload), file name with its extension |
| Parse response | Yes |

Then a *Router* on:

- `2d_doc_results.certificate.verification` = `OK` and `authenticity` ≠ `false` → accepted path;
- `verification` = `FAILED` or `authenticity` = `false` → rejected path;
- anything else → manual review (not verifiable).

For a tax notice also test `2d_doc_results["Dernier avis ?"]`: `false` means genuine but superseded.

## n8n

*HTTP Request* node:

- Method `POST`, URL as above, Authentication *Generic, Header Auth*: name `Authorization`, value `Bearer tmd_live_...`;
- Body content type *Form-Data*, parameter type *n8n Binary File*, name `file`, input data field `data` (the binary property from the previous node);
- *IF* node on `{{$json["2d_doc_results"]["certificate"]["verification"]}}` and `{{$json["authenticity"]}}` as above.

## Identity cards

Two file fields on `/verify/id`: `front` and `back` (the 2D-Doc is on the back).

## Rental application

One request to `/verify/../tenant-file` is not possible: use `https://trustmydocs.com/api/v1/tenant-file` with repeated `payslip` fields and `tax`, `id_front`, `id_back`. The response lists `documents[].verdict` and `checks[].status`.

## Limits

100 verifications per key per day, 300 per day for all keys during the beta, 32 MB per request. On HTTP 429 read the `Retry-After` header and delay the scenario.
