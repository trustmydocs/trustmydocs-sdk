# Verdict semantics

The service runs up to three independent controls and never merges them. This package exposes each one as an outcome, then applies one rule.

## Outcomes

| Field | Values | Source |
| --- | --- | --- |
| `signature` | `valid`, `invalid`, `absent` (no readable code), `unavailable` (certificate not fetched), `not_applicable` (document type without 2D-Doc) | `certificate.verification` |
| `content` | `match`, `mismatch`, `not_comparable` (no comparable field), `no_signed_data`, `not_applicable`, `code_only` | `authenticity` |
| `latest` | `yes`, `no`, `unavailable` (DGFiP did not answer), `no_code`; only for tax notices | `Dernier avis ?` |
| `analysis` | `code_and_ocr`, `ocr_no_code`, `code_only`, `passport`, `old_id`, `payslip`, `generic` | what was actually done |

## The rule

```text
content == mismatch  or  signature == invalid   ->  not_authentic
signature == valid                               ->  authentic
otherwise                                        ->  unverifiable
```

`latest == no` does not change the verdict: the notice is genuine, just superseded. It shows as a red row in `checks`.

`verdict == 'error'` means the API answered `success: false` (unreadable file, unsupported code type); `result.error` carries its message and `checks` is empty.

## Why `unavailable` is not `invalid`

A certificate that could not be fetched means nothing was checked. Reporting it as a forgery told users their document was fake when the network had failed. Only `FAILED` without an `error` is an invalid signature.

## What a valid signature does not prove

- that the bearer is the holder of the document;
- that the document is the most recent (see `latest`);
- that the printed text matches the signed data (see `content`): a genuine code can be glued onto an edited page;
- anything about documents without a 2D-Doc (passport, old identity card, payslip): their verdict is always `unverifiable`.

Only the signature check is cryptographic. Extraction and comparison come from OCR and a vision model and are an aid, not evidence.

## `checks`

`result.checks` is the grid the website displays: `analysis`, `signature`, `content`, `latest` (tax only), `authenticity`, each with a `status` (`ok`, `ko`, `unknown`, `na`, `done`) and the machine `outcome`. `describeChecks(result, lang)` adds the labels and sentences in English or French.

## Exit codes of the CLI

| Verdict | Exit code |
| --- | --- |
| `authentic` | 0 |
| `not_authentic` | 2 |
| `unverifiable` | 3 |
| `error`, usage or network failure | 1 |

For `tenant-file`: 0 when every analysed document is authentic and every check coherent; 2 when a document is not authentic or a check is a mismatch; 3 otherwise.
