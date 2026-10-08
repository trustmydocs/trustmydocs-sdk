#!/usr/bin/env bash
# Raw HTTP: verify a tax notice.  TRUSTMYDOCS_API_KEY=... examples/curl/verify-tax.sh avis.pdf
set -euo pipefail
: "${TRUSTMYDOCS_API_KEY:?set TRUSTMYDOCS_API_KEY (free key: https://trustmydocs.com/fr/api)}"
FILE="${1:?usage: verify-tax.sh <avis.pdf>}"

curl -sS --fail-with-body \
  -H "Authorization: Bearer $TRUSTMYDOCS_API_KEY" \
  -F "file=@${FILE}" \
  https://trustmydocs.com/api/v1/verify/tax \
| jq '{
    signature: .["2d_doc_results"].certificate.verification,
    latest:    .["2d_doc_results"]["Dernier avis ?"],
    content:   .authenticity,
    signed:    (.["2d_doc_results"].fiscal_fields // {} | keys)
  }'
