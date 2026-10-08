# Contributing

Thank you for helping. This repository holds the open-source client of the Trust My Docs API: SDK, CLI, MCP server, documentation and examples. The verification service itself (2D-Doc detection, signature checks, extraction) is not in this repository.

## Setup

```sh
git clone https://github.com/GITHUB_OWNER/trustmydocs-sdk.git
cd trustmydocs-sdk
npm install          # also enables the repository git hooks
npm test             # builds, then runs the unit tests (no network)
```

Node 20 or newer. The tests never call the real API; use a key of your own to try things end to end:

```sh
node dist/cli.js login            # or TRUSTMYDOCS_API_KEY=... for one run
node dist/cli.js verify ~/some-notice.pdf
```

## Rules

- **Never commit a document.** Tax notices, ID cards, payslips and photos of 2D-Doc codes carry personal data, even "test" ones. `.gitignore` refuses the common extensions and `scripts/check-hygiene.sh` fails CI if one slips through. Expected outputs in `examples/expected-output/` are redacted by hand.
- **Never commit a key.** `tmd_live_...` values are caught by the pre-commit hook and CI.
- **Commit messages are one line**, 72 characters at most, no body, no trailer, no tooling attribution. The `commit-msg` hook enforces it; `npm install` enables the hooks (`git config core.hooksPath .githooks`).
- **Verdict semantics are the service's.** The rule in `src/result.ts` mirrors the website: do not relax it, do not paint an unverifiable result green. If the API changes its contract, the change lands here with a test.
- **Keep the three controls apart** in every wording (signature, printed-versus-signed data, latest notice).
- English first in code, docs and CLI output, French alongside where users read it (`--lang fr`, README).
- No new runtime dependency without a reason written in the pull request.

## Pull requests

1. Open an issue first for anything beyond a fix.
2. Add or update a unit test.
3. `npm test` and `npm run check:hygiene` pass locally.
4. Describe what changes for a user of the CLI, the SDK or the MCP server.

## Release (maintainers)

Releases are published to npm by GitHub Actions through npm trusted publishing (OIDC, no token in the repository). See `docs/publishing.md`.
