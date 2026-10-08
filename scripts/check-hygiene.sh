#!/usr/bin/env bash
# Repository hygiene, runnable in CI and before publish (bash 3.2 compatible).
#
#   - no live API key anywhere in the tree;
#   - no document files committed (they always hold personal data);
#   - the history follows the one-line, no-attribution rule.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
STATUS=0

FILES=$(git ls-files)
if [ -n "$FILES" ] && printf '%s\n' "$FILES" | tr '\n' '\0' | xargs -0 grep -nIE 'tmd_live_[A-Za-z0-9_-]{24,}' 2>/dev/null; then
  echo "hygiene: a value shaped like a live API key is committed." >&2; STATUS=1
fi

DOCS=$(git ls-files | grep -iE '\.(pdf|jpe?g|png|tiff?|bmp)$' || true)
if [ -n "$DOCS" ]; then
  echo "hygiene: document files are committed:" >&2; echo "$DOCS" >&2; STATUS=1
fi

# Every commit: exactly one line, no attribution.
if git rev-parse --verify -q HEAD >/dev/null; then
BAD=$(git log --format='%H%x09%B%x00' | tr -d '\r' | awk 'BEGIN{RS="\0"} { n=split($0, l, "\n"); h=substr(l[1],1,40); s=substr(l[1],42); body=""; for(i=2;i<=n;i++){ if (l[i] ~ /[^ \t]/) body="x" } if (body!="" || tolower(s) ~ /claude|anthropic|co-authored-by|generated with/) print h }')
if [ -n "$BAD" ]; then
  echo "hygiene: commits with a body or an attribution:" >&2; echo "$BAD" >&2; STATUS=1
fi
fi

exit $STATUS
