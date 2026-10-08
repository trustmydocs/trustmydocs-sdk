# Publishing (maintainers)

The package is published from GitHub Actions only, with **npm trusted publishing**. No npm token is created or stored.

## One-time setup

1. On npmjs.com, create the package the first time by hand from a maintainer machine, or publish `0.1.0` once with `npm publish --access public` after `npm login` as the package owner. Trusted publishers can only be configured on an existing package.
2. Package settings on npmjs.com, section *Trusted Publisher*: provider **GitHub Actions**, repository owner `trustmydocs`, repository `trustmydocs-sdk`, workflow filename `publish.yml`, no environment.
3. Package settings: require two-factor authentication for publishing by people, and disallow tokens. Trusted publishing is unaffected.
4. In the GitHub repository: *Settings, Actions, General*, workflow permissions read-only (the workflow requests `id-token: write` itself). Protect `main` (pull requests only, CI required).

## Each release

1. Update `CHANGELOG.md` and bump `version` in `package.json` (one commit, one line: `Release 0.2.0`).
2. Tag `v0.2.0` and create a GitHub release from that tag. The `Publish` workflow checks the tag against `package.json`, runs the tests, and publishes with provenance.
3. Verify: the version page on npmjs.com shows the provenance badge; `npm audit signatures` passes in a project that depends on `trustmydocs`.

`workflow_dispatch` with `dry_run` (the default) runs everything except the publish.

## Requirements

- npm 11.5.1 or newer on the runner (Node 24 ships it).
- GitHub-hosted runner.
- Public repository: provenance is not generated for private ones.
