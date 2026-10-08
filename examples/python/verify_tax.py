#!/usr/bin/env python3
"""Verify a tax notice.  TRUSTMYDOCS_API_KEY=... python examples/python/verify_tax.py avis.pdf"""

import sys

from trustmydocs_client import ApiError, TrustMyDocs

if len(sys.argv) != 2:
    sys.exit("usage: verify_tax.py <avis.pdf>")

try:
    result = TrustMyDocs().verify("tax", sys.argv[1])
except ApiError as error:
    sys.exit(f"{error.code}: {error.message}" + (f" (retry in {error.retry_after} s)" if error.retry_after else ""))

print("verdict:  ", result["verdict"])
print("signature:", result["signature"], " content:", result["content"], " latest:", result["latest"])
print("signed fields:", len(result.get("signed_fields", {})), " extracted fields:", len(result.get("extracted_fields", {})))
print("Reminder: a valid signature proves the origin and integrity of the code, not that the document is current or that the bearer is its holder.")
sys.exit({"authentic": 0, "not_authentic": 2, "unverifiable": 3}.get(result["verdict"], 1))
