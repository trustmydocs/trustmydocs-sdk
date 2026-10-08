# MCP server

The package ships a [Model Context Protocol](https://modelcontextprotocol.io) server over stdio. It runs on your machine so that an assistant can verify files on your disk; it holds no logic, every verdict comes from the API.

## Configure

Claude Code:

```sh
claude mcp add trustmydocs -- npx -y trustmydocs mcp
```

Claude Desktop, Cursor, Windsurf, and other clients that read a JSON configuration:

```json
{
  "mcpServers": {
    "trustmydocs": {
      "command": "npx",
      "args": ["-y", "trustmydocs", "mcp"],
      "env": { "TRUSTMYDOCS_API_KEY": "tmd_live_..." }
    }
  }
}
```

The `env` block is optional once `npx trustmydocs login` has stored a key. Without any key the server still starts and each tool answers with the instruction to get one. `TRUSTMYDOCS_LANG=fr` switches the summaries to French. `trustmydocs-mcp` is also installed as a direct binary.

## Tools

| Tool | Input | Output |
| --- | --- | --- |
| `verify_document` | `path`, `type` (tax, 2ddoc, id, old-id, passport, payslip, generic), `back_path` (ID cards) | summary with the three controls kept apart, then the normalised JSON (with the raw payload) |
| `read_2ddoc` | `path` | decoded 2D-Doc, signer, signature validity |
| `verify_tenant_file` | `tax[]`, `payslips[]`, `id_front`, `id_back`, `old_id_front`, `old_id_back`, `passport` | per-document verdicts, coherence checks, rental capacity, reserves |
| `check_quota` | none | plan and usage of the key |

Example prompts: "Verify the tax notice in ~/Downloads/avis.pdf", "Is this rental application coherent? avis.pdf, three payslips and both sides of the ID card", "Read the 2D-Doc on this photo and tell me who signed it".

## Without a local server

For clients that cannot run local processes, the service exposes a keyless remote connector at `https://trustmydocs.com/mcp` (Streamable HTTP) with a drop zone rendered in the conversation and a shared quota. Documentation: `https://trustmydocs.com/fr/connecteur-mcp`.

## Privacy

Each tool call reads exactly the files named, sends them once over HTTPS, and returns. The API analyses in memory and deletes. Nothing is cached locally.
