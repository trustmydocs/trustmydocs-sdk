# Integrate in Python

The API is plain HTTPS with multipart uploads: `requests` (or `httpx`) is all you need. A small ready-to-use client with the same verdict rule as the Node package lives in [`examples/python/trustmydocs_client.py`](../examples/python/trustmydocs_client.py); copy it into your project.

## Minimal call

```python
import os
import requests

API = "https://trustmydocs.com/api/v1"
HEADERS = {"Authorization": f"Bearer {os.environ['TRUSTMYDOCS_API_KEY']}"}

with open("avis-imposition.pdf", "rb") as f:
    r = requests.post(f"{API}/verify/tax", headers=HEADERS, files={"file": ("avis.pdf", f, "application/pdf")}, timeout=300)
r.raise_for_status()
data = r.json()
```

Identity cards: `files={"front": ..., "back": ...}` on `/verify/id`. Other types: `/verify/2ddoc`, `/verify/old-id`, `/verify/passport`, `/verify/payslip`, `/verify/generic`.

## Reading the answer

```python
two_doc = data.get("2d_doc_results") or {}
signed = two_doc.get("fiscal_fields") or two_doc.get("id_fields") or {}
cert = two_doc.get("certificate") or {}

if cert.get("verification") == "OK":
    signature = "valid"
elif cert.get("verification") == "FAILED" and not cert.get("error"):
    signature = "invalid"
elif signed:
    signature = "unavailable"      # certificate not fetched: nothing was checked
else:
    signature = "absent"           # no readable 2D-Doc

content = {True: "match", False: "mismatch"}.get(data.get("authenticity"), "not_comparable")
latest = {True: "yes", False: "no"}.get(two_doc.get("Dernier avis ?"), "unavailable")

if content == "mismatch" or signature == "invalid":
    verdict = "not_authentic"
elif signature == "valid":
    verdict = "authentic"
else:
    verdict = "unverifiable"
```

Keep the three controls apart in what you show users; see [verdicts.md](verdicts.md).

## Errors

| HTTP | `error` | What to do |
| --- | --- | --- |
| 401 | `invalid_key` | Check the key; request one on https://trustmydocs.com/fr/api |
| 429 | `quota_reached`, `service_quota_reached` | Read `Retry-After`, back off |
| 413 | | Document larger than 32 MB |
| 503 | `unavailable` | Retry later |

## Rental application

```python
files = [
    ("tax", ("avis.pdf", open("avis.pdf", "rb"), "application/pdf")),
    ("payslip", ("p1.pdf", open("p1.pdf", "rb"), "application/pdf")),
    ("payslip", ("p2.pdf", open("p2.pdf", "rb"), "application/pdf")),
    ("id_front", ("recto.jpg", open("recto.jpg", "rb"), "image/jpeg")),
    ("id_back", ("verso.jpg", open("verso.jpg", "rb"), "image/jpeg")),
]
report = requests.post(f"{API}/tenant-file", headers=HEADERS, files=files, timeout=600).json()
for doc in report["documents"]:
    print(doc["name"], doc["verdict"])
for check in report["checks"]:
    print(check["id"], check["status"], check["detail"])
```

## Getting a key from code

`POST https://trustmydocs.com/api/keys/request` with `{"email": "you@company.fr"}`. The answer is deliberately neutral; the key arrives by email. Store it in a secret manager or an environment variable, never in source.

## Full example

[`examples/python/verify_tax.py`](../examples/python/verify_tax.py) and [`examples/python/tenant_file.py`](../examples/python/tenant_file.py) are runnable with `TRUSTMYDOCS_API_KEY` set.
