# Changelog

## 0.1.1

- README en français, orienté recherche, avec liens vers le site.
- `mcpName` et `server.json` pour la publication dans le MCP Registry (`io.github.trustmydocs/trustmydocs`), avec le connecteur distant `https://trustmydocs.com/mcp`.
- Description et mots-clés npm en français.

## 0.1.0

First public release.

- SDK: `TrustMyDocsClient` with `verify`, `read2DDoc`, `tenantFile`, `me`, `requestKey`; normalised results (`verdict`, `signature`, `content`, `latest`, `checks`, `signedFields`, `extractedFields`, `raw`).
- CLI: `verify`, `2ddoc`, `tenant-file`, `login`, `logout`, `quota`, `mcp`; interactive first run that requests the free key; exit codes by verdict; English and French wording.
- MCP server (stdio): `verify_document`, `verify_tenant_file`, `read_2ddoc`, `check_quota`.
- Documentation and examples for Node, TypeScript, Python, curl and GitHub Actions.
