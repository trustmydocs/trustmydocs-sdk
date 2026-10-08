#!/usr/bin/env bash
# Whole rental application in one request. Quota: one unit per analysed document.
set -euo pipefail
: "${TRUSTMYDOCS_API_KEY:?set TRUSTMYDOCS_API_KEY}"
curl -sS --fail-with-body -H "Authorization: Bearer $TRUSTMYDOCS_API_KEY" \
  -F "tax=@avis.pdf" \
  -F "payslip=@paie-07.pdf" -F "payslip=@paie-08.pdf" -F "payslip=@paie-09.pdf" \
  -F "id_front=@cni-recto.jpg" -F "id_back=@cni-verso.jpg" \
  https://trustmydocs.com/api/v1/tenant-file \
| jq '{documents: [.documents[] | {name, verdict}], checks: [.checks[] | {id, status}], capacity: .rental_capacity.label, quota}'
