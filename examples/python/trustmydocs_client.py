"""Minimal Trust My Docs client for Python, with the same verdict rule as the Node package.

Dependency: requests. Copy this file into your project.

    from trustmydocs_client import TrustMyDocs
    client = TrustMyDocs(api_key=os.environ["TRUSTMYDOCS_API_KEY"])
    result = client.verify("tax", "avis.pdf")
    print(result["verdict"], result["signature"], result["latest"])
"""

from __future__ import annotations

import mimetypes
import os
from dataclasses import dataclass
from typing import Any, Iterable

import requests

DEFAULT_BASE_URL = "https://trustmydocs.com"
DOCUMENT_TYPES = ("tax", "2ddoc", "id", "old-id", "passport", "payslip", "generic")
ACCEPTED = {".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"}


@dataclass
class ApiError(Exception):
    message: str
    status: int
    code: str = "unknown"
    retry_after: int | None = None

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.code} ({self.status}): {self.message}"


def _part(path: str) -> tuple[str, bytes, str]:
    ext = os.path.splitext(path)[1].lower()
    if ext not in ACCEPTED:
        raise ApiError(f"Unsupported format: {path}", 400, "unsupported_format")
    with open(path, "rb") as handle:
        data = handle.read()
    return os.path.basename(path), data, mimetypes.guess_type(path)[0] or "application/octet-stream"


def _signature(certificate: dict[str, Any] | None, signed: dict[str, Any]) -> str:
    cert = certificate or {}
    if cert.get("verification") == "OK":
        return "valid"
    if cert.get("verification") == "FAILED" and not cert.get("error"):
        return "invalid"
    return "unavailable" if signed else "absent"


def _verdict(signature: str, content: str) -> str:
    if content == "mismatch" or signature == "invalid":
        return "not_authentic"
    if signature == "valid":
        return "authentic"
    return "unverifiable"


def normalise(doc_type: str, raw: dict[str, Any]) -> dict[str, Any]:
    """Language-neutral result: verdict, signature, content, latest, fields, raw."""
    if raw.get("success") is False:
        return {"type": doc_type, "verdict": "error", "error": raw.get("message") or raw.get("error"), "raw": raw}

    if doc_type in ("tax", "id"):
        two_doc = raw.get("2d_doc_results") or {}
        signed = (two_doc.get("fiscal_fields") if doc_type == "tax" else two_doc.get("id_fields")) or {}
        read = bool(two_doc.get("success")) and bool(signed)
        llm = raw.get("llm_results") or {}
        extracted = llm.get("extracted_fields") or {}
        llm_read = bool(llm.get("success")) and bool(extracted)
        signature = _signature(two_doc.get("certificate"), signed) if read else "absent"
        if not read:
            content = "no_signed_data"
        elif not llm_read:
            content = "not_comparable"
        else:
            content = {True: "match", False: "mismatch"}.get(raw.get("authenticity"), "not_comparable")
        latest = None
        if doc_type == "tax":
            latest = {True: "yes", False: "no"}.get(two_doc.get("Dernier avis ?"), "unavailable") if read else "no_code"
    elif doc_type == "2ddoc":
        signed = raw.get("fiscal_fields") or raw.get("id_fields") or {}
        extracted = {}
        signature = _signature(raw.get("certificate"), signed)
        content = "code_only"
        latest = {True: "yes", False: "no"}.get(raw.get("Dernier avis ?"), "unavailable") if raw.get("fiscal_fields") else None
    else:
        key = {"passport": "passport_fields", "old-id": "old_id_fields", "payslip": "extracted_fields", "generic": "structured_fields"}[doc_type]
        signed, extracted = {}, raw.get(key) or {}
        signature, content, latest = "not_applicable", "not_applicable", None

    return {
        "type": doc_type,
        "verdict": _verdict(signature, content),
        "signature": signature,
        "content": content,
        "latest": latest,
        "signed_fields": signed,
        "extracted_fields": extracted,
        "raw": raw,
    }


class TrustMyDocs:
    def __init__(self, api_key: str | None = None, base_url: str = DEFAULT_BASE_URL, timeout: int = 300) -> None:
        self.api_key = api_key or os.environ.get("TRUSTMYDOCS_API_KEY", "")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers["User-Agent"] = "trustmydocs-python-example/0.1"

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        if not self.api_key:
            raise ApiError("No API key. Free key: https://trustmydocs.com/fr/api", 0, "missing_key")
        headers = {"Authorization": f"Bearer {self.api_key}"}
        response = self.session.request(method, f"{self.base_url}{path}", headers=headers, timeout=self.timeout, **kwargs)
        if response.ok:
            return response.json()
        try:
            body = response.json()
        except ValueError:
            body = {}
        code = body.get("error") or {401: "invalid_key", 413: "payload_too_large", 429: "rate_limited", 503: "unavailable"}.get(response.status_code, "unknown")
        retry = response.headers.get("Retry-After")
        raise ApiError(body.get("message") or body.get("error") or f"HTTP {response.status_code}", response.status_code, str(code), int(retry) if retry and retry.isdigit() else None)

    def verify_raw(self, doc_type: str, path: str, back: str | None = None) -> dict[str, Any]:
        if doc_type not in DOCUMENT_TYPES:
            raise ApiError(f"Unknown type {doc_type}", 400, "bad_request")
        if doc_type in ("id", "old-id"):
            files = {"front": _part(path)}
            if back:
                files["back"] = _part(back)
        else:
            files = {"file": _part(path)}
        return self._request("POST", f"/api/v1/verify/{doc_type}", files=files)

    def verify(self, doc_type: str, path: str, back: str | None = None) -> dict[str, Any]:
        return normalise(doc_type, self.verify_raw(doc_type, path, back))

    def tenant_file(self, tax: Iterable[str] = (), payslip: Iterable[str] = (), id_front: str | None = None, id_back: str | None = None,
                    old_id_front: str | None = None, old_id_back: str | None = None, passport: str | None = None) -> dict[str, Any]:
        files: list[tuple[str, tuple[str, bytes, str]]] = []
        files += [("tax", _part(p)) for p in tax]
        files += [("payslip", _part(p)) for p in payslip]
        for field, path in (("id_front", id_front), ("id_back", id_back), ("old_id_front", old_id_front), ("old_id_back", old_id_back), ("passport", passport)):
            if path:
                files.append((field, _part(path)))
        return self._request("POST", "/api/v1/tenant-file", files=files)

    def me(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/me")

    def request_key(self, email: str) -> dict[str, Any]:
        """No key needed. The key arrives by email; the answer is neutral by design."""
        response = self.session.post(f"{self.base_url}/api/keys/request", json={"email": email}, timeout=30)
        response.raise_for_status()
        return response.json()
