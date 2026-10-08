#!/usr/bin/env python3
"""Rental application in one call.
TRUSTMYDOCS_API_KEY=... python examples/python/tenant_file.py avis.pdf recto.jpg verso.jpg paie1.pdf paie2.pdf paie3.pdf
"""

import sys

from trustmydocs_client import ApiError, TrustMyDocs

if len(sys.argv) < 5:
    sys.exit("usage: tenant_file.py <avis.pdf> <cni-recto> <cni-verso> <payslip.pdf>...")

tax, front, back, *payslips = sys.argv[1:]
try:
    report = TrustMyDocs().tenant_file(tax=[tax], payslip=payslips, id_front=front, id_back=back)
except ApiError as error:
    sys.exit(f"{error.code}: {error.message}")

for doc in report["documents"]:
    print(f"{doc['name']:30} {doc['kind']:8} {doc['verdict']}")
for check in report["checks"]:
    gap = f" ({check['gap_percent']} %)" if "gap_percent" in check else ""
    print(f"{check['status']:14} {check['label']}{gap}: {check['detail']}")
if report.get("rental_capacity"):
    print("rental capacity:", report["rental_capacity"].get("label"))
for reserve in report.get("reserves", []):
    print("reserve:", reserve)
print(report["disclaimer"])
