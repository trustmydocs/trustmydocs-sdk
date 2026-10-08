# Command line

```sh
npx trustmydocs <command> [options]
# or
npm install -g trustmydocs && trustmydocs <command>
```

## First run and the key

A free API key is needed. The CLI gets it for you:

```sh
npx trustmydocs login            # asks for your work email, requests the key, waits for you to paste it
npx trustmydocs login you@company.fr
npx trustmydocs login --key tmd_live_...   # you already have one
```

The key arrives by email within seconds (check spam). It is validated with a call to `/me`, then stored in `~/.config/trustmydocs/config.json` with mode 600 (`$XDG_CONFIG_HOME` and `$TRUSTMYDOCS_CONFIG_DIR` are honoured). Running `verify` without a stored key starts the same flow when a terminal is attached.

Non-interactive use (CI, cron, servers): set `TRUSTMYDOCS_API_KEY`. It always wins over the stored key and is never written to disk. `--key` is for a single run.

`npx trustmydocs logout` deletes the stored file.

## Commands

```sh
trustmydocs verify <file> [--type tax|2ddoc|id|old-id|passport|payslip|generic] [--back <file>]
trustmydocs 2ddoc <file>
trustmydocs tenant-file [--tax <f>]... [--payslip <f>]... [--id-front <f>] [--id-back <f>]
                        [--old-id-front <f>] [--old-id-back <f>] [--passport <f>] [--other <f>]...
trustmydocs quota
trustmydocs mcp
```

`--type` defaults to `tax`. Identity cards carry the 2D-Doc on the back: pass `--back`.

## Output

Default: a human-readable summary, then the signed and extracted field values (turn them off with `--no-fields`), then the reminder about what the verdict proves. `--lang fr` for French; the default follows `TRUSTMYDOCS_LANG`, then `LANG`.

`--json`: the normalised result, including `raw`. `--raw`: the API payload only.

```sh
npx trustmydocs verify avis.pdf --json | jq '{verdict, signature, latest}'
```

Exit codes: `0` authentic, `2` not authentic, `3` not verifiable, `1` error. See [verdicts.md](verdicts.md) for the tenant-file rule.

## Scripting

```sh
for f in inbox/*.pdf; do
  if npx trustmydocs verify "$f" --no-fields > /dev/null; then mv "$f" verified/; else mv "$f" review/; fi
done
```

## Other API origin

`--base-url https://...` or `TRUSTMYDOCS_API_BASE` (for a staging instance). Stored with `login --base-url`.
