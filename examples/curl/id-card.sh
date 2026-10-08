#!/usr/bin/env bash
# New-format identity card: the 2D-Doc is on the back, send both sides.
set -euo pipefail
: "${TRUSTMYDOCS_API_KEY:?set TRUSTMYDOCS_API_KEY}"
FRONT="${1:?usage: id-card.sh <front.jpg> <back.jpg>}"; BACK="${2:?usage: id-card.sh <front.jpg> <back.jpg>}"
curl -sS --fail-with-body -H "Authorization: Bearer $TRUSTMYDOCS_API_KEY" -F "front=@${FRONT}" -F "back=@${BACK}" https://trustmydocs.com/api/v1/verify/id | jq '{verdict_inputs: {signature: .["2d_doc_results"].certificate.verification, content: .authenticity}}'
