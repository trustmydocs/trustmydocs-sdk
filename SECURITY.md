# Security

## Reporting

Email **contact@trustmydocs.com** with a description, the affected version, and steps to reproduce. Please do not open a public issue for a vulnerability. We acknowledge reports within five working days.

## Scope

This repository contains the client: SDK, CLI and MCP server. The service behind `https://trustmydocs.com/api` is operated separately; reports about it are welcome at the same address.

## What the client does with your data

- Documents are read from the path you give and sent once, over HTTPS, to the API origin (`https://trustmydocs.com` unless `--base-url` or `TRUSTMYDOCS_API_BASE` says otherwise). Nothing is written to disk by the client, except the configuration file below.
- The API key is stored by `trustmydocs login` in `~/.config/trustmydocs/config.json` (directory 0700, file 0600). `trustmydocs logout` deletes it. `TRUSTMYDOCS_API_KEY` always takes precedence and is never written.
- The client logs nothing. The CLI prints extracted field values on purpose (`--no-fields` turns that off); pipe with care.
- The MCP server runs locally on stdio and only reads the files a tool call names.

## Supply chain

Releases are built and published by GitHub Actions with npm trusted publishing and provenance attestations; there is no long-lived npm token. Verify with `npm audit signatures` in a project that depends on the package.
