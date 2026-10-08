#!/usr/bin/env bash
# Ask for a free key. The answer is neutral by design; the key arrives by email.
set -euo pipefail
EMAIL="${1:?usage: request-key.sh you@company.fr}"
curl -sS -H 'content-type: application/json' -d "{\"email\": \"${EMAIL}\"}" https://trustmydocs.com/api/keys/request
echo
