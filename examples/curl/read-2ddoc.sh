#!/usr/bin/env bash
# Decode a 2D-Doc code and check its signature (image or PDF).
set -euo pipefail
: "${TRUSTMYDOCS_API_KEY:?set TRUSTMYDOCS_API_KEY}"
FILE="${1:?usage: read-2ddoc.sh <file>}"
curl -sS --fail-with-body -H "Authorization: Bearer $TRUSTMYDOCS_API_KEY" -F "file=@${FILE}" https://trustmydocs.com/api/v1/verify/2ddoc | jq .
