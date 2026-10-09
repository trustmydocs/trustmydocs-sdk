# trustmydocs

[![npm](https://img.shields.io/npm/v/trustmydocs.svg)](https://www.npmjs.com/package/trustmydocs)
[![CI](https://github.com/trustmydocs/trustmydocs-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/trustmydocs/trustmydocs-sdk/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

**Website: [trustmydocs.com](https://trustmydocs.com)** · [Verify a document online, free, no account](https://trustmydocs.com/fr) · [API and free key](https://trustmydocs.com/fr/api) · [Swagger](https://trustmydocs.com/api/docs) · [MCP connector for Claude and ChatGPT](https://trustmydocs.com/fr/connecteur-mcp) · [Make and n8n tutorial](https://trustmydocs.com/fr/automatisation-make) · [Rental application check](https://trustmydocs.com/fr/dossier-locataire) · [Blog](https://trustmydocs.com/fr/blog)

Verify French official documents from Node.js, the command line, or any MCP client (Claude, Cursor, ChatGPT and others).

Reads the **2D-Doc** code printed on tax notices (avis d'imposition) and identity cards, checks its **electronic signature against the issuer's certificate authority**, asks the DGFiP whether a tax notice is the **latest one known**, and compares the **printed text with the signed data**. Also reads passports, old-format identity cards and payslips, and analyses a whole **rental application** (dossier locataire) in one call.

The package is a thin client for the [Trust My Docs](https://trustmydocs.com) API. Documents are sent over HTTPS, analysed in memory on European servers, and deleted when the response is written. Nothing is stored.

*Version française plus bas.*

## One instruction

```sh
npx trustmydocs verify avis-imposition.pdf
```

The first run asks for your work email, requests a **free API key** (it arrives by email within seconds), and stores it in `~/.config/trustmydocs/config.json` (mode 600). Every later run is the single line above.

```text
avis-imposition.pdf
Authenticity verified (tax notice)
  .   Analysis: Done. 2D-Doc code read and optical reading performed.
  OK  2D-Doc signature: Valid. Signature verified against the certificate authority: the signed data does come from the issuer.
  OK  Printed data vs signed data: Yes. The printed data matches the signed data.
  OK  Latest notice known to the DGFiP: Yes. Confirmed by the DGFiP as the latest known notice.
  OK  Authenticity: Verified. Valid 2D-Doc signature and printed data consistent with the signed data.
Signed fields: 7
Optically read fields: 12
Signed data (2D-Doc):
  ...
Reminder: a valid signature proves the origin and integrity of the code, not that the document is the most recent, nor that its bearer is its holder. ...
```

Exit code `0` means authentic, `2` not authentic, `3` not verifiable, `1` an error. Add `--json` for the normalised result or `--raw` for the API payload.

More commands:

```sh
npx trustmydocs 2ddoc photo-of-the-code.png                  # decode a 2D-Doc and check its signature
npx trustmydocs verify cni-front.jpg --type id --back cni-back.jpg
npx trustmydocs verify fiche-de-paie.pdf --type payslip
npx trustmydocs tenant-file --tax avis.pdf --payslip p1.pdf --payslip p2.pdf --id-front f.jpg --id-back b.jpg
npx trustmydocs quota                                          # usage of your key
npx trustmydocs --help
```

Non-interactive environments (CI, servers) set `TRUSTMYDOCS_API_KEY` instead of running `login`. See [docs/cli.md](docs/cli.md).

## In Node.js / TypeScript

```sh
npm install trustmydocs
```

```ts
import { TrustMyDocsClient } from 'trustmydocs';

const client = new TrustMyDocsClient({ apiKey: process.env.TRUSTMYDOCS_API_KEY });

const result = await client.verify('tax', './avis-imposition.pdf');
console.log(result.verdict);        // 'authentic' | 'not_authentic' | 'unverifiable' | 'error'
console.log(result.signature);      // 'valid' | 'invalid' | 'absent' | 'unavailable' | 'not_applicable'
console.log(result.latest);         // 'yes' | 'no' | 'unavailable' | 'no_code'   (tax notices only)
console.log(result.signedFields);   // what the issuer signed in the 2D-Doc
console.log(result.raw);            // the untouched API payload
```

Inputs can be a file path, a `Blob`/`File`, or `{ data: Uint8Array, filename }`. Full guide: [docs/integrate-typescript.md](docs/integrate-typescript.md). Python: [docs/integrate-python.md](docs/integrate-python.md) (plain HTTP, no package needed).

## As an MCP server

Give an assistant the power to verify documents on your disk:

```sh
claude mcp add trustmydocs -- npx -y trustmydocs mcp
```

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

Tools: `verify_document`, `verify_tenant_file`, `read_2ddoc`, `check_quota`. The key can also come from `npx trustmydocs login`. Details: [docs/mcp.md](docs/mcp.md). A keyless remote connector with a drop zone also exists at `https://trustmydocs.com/mcp` for clients that cannot run local servers.

## What a verdict means

The service keeps three controls apart, and so does this package:

| Control | What it proves | Nature |
| --- | --- | --- |
| 2D-Doc signature | The code was produced by the issuer and not altered | Cryptographic (ECDSA, issuer certificate from the ANTS trust list) |
| Printed vs signed data | The visible text was not edited after printing | Deterministic comparison, OCR and vision model as input |
| Latest notice (tax) | The DGFiP still considers this notice current | Query to the DGFiP service |

Verdict rule: **not authentic** on an invalid signature or on printed data that contradicts the signed data; **authentic** on a valid signature; **not verifiable** otherwise (no readable code, certificate unreachable, OCR-only document types). A superseded tax notice stays authentic with a red "latest" row.

Only the signature check is a proof. Extraction and comparison come from probabilistic models: treat them as an aid, not as evidence. A valid signature does not tell you that the bearer is the holder.

## Limits of the free beta

| Limit | Value |
| --- | --- |
| Verifications per key per day | 100 |
| Verifications per day across all keys | 300 |
| Keys issued per day | 20 (3 per hour per IP, 3 per mailbox, 3 per custom domain) |
| Request size | 32 MB |
| Formats | PDF, JPG, PNG, TIFF, BMP |

Reaching 429 with `Retry-After` is expected at the ceiling. Disposable or placeholder addresses never receive a key. Keys are stable; a new request for the same mailbox revokes the previous key.

## Repository

- `src/` the package: SDK (`index.ts`), CLI (`cli.ts`), MCP server (`mcp.ts`)
- `docs/` integration guides, API contract, verdict semantics
- `examples/` runnable scripts in Node, TypeScript, Python, curl, GitHub Actions, with redacted expected outputs
- `test/` unit tests (`npm test`), no network needed

The service itself, its privacy policy and terms live on [trustmydocs.com](https://trustmydocs.com): [privacy](https://trustmydocs.com/fr/politique-confidentialite), [terms](https://trustmydocs.com/fr/cgu), [legal notice](https://trustmydocs.com/fr/mentions-legales). Questions: contact@trustmydocs.com.

Contributions: see [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md). License: Apache-2.0. "Trust My Docs" is a trade name of the service operator; the license grants no right to use it.

---

## En français

**Site : [trustmydocs.com](https://trustmydocs.com)** · [Vérifier un document en ligne, gratuit, sans compte](https://trustmydocs.com/fr) · [API et clé gratuite](https://trustmydocs.com/fr/api) · [Connecteur MCP pour Claude et ChatGPT](https://trustmydocs.com/fr/connecteur-mcp) · [Tutoriel Make et n8n](https://trustmydocs.com/fr/automatisation-make) · [Dossier locataire](https://trustmydocs.com/fr/dossier-locataire) · [Blog](https://trustmydocs.com/fr/blog)

Vérifiez des documents officiels français depuis Node.js, la ligne de commande ou un client MCP (Claude, Cursor, ChatGPT...). Le paquet lit le **code 2D-Doc** d'un avis d'imposition ou d'une carte d'identité, **vérifie sa signature électronique** auprès de l'autorité de certification de l'émetteur, demande à la DGFiP s'il s'agit du **dernier avis connu**, et compare le **texte imprimé aux données signées**. Il lit aussi passeports, anciennes CNI et bulletins de paie, et analyse un **dossier locataire** complet en un appel.

```sh
npx trustmydocs verify avis-imposition.pdf --lang fr
```

Au premier lancement, la commande demande votre email professionnel, obtient une **clé gratuite** (reçue par email en quelques secondes) et la conserve dans `~/.config/trustmydocs/config.json`. Ensuite, une seule ligne suffit. Les documents sont analysés en mémoire sur des serveurs européens puis supprimés ; rien n'est conservé.

Trois contrôles distincts, jamais confondus : la **signature 2D-Doc** (preuve cryptographique de l'origine et de l'intégrité du code), la **concordance** entre texte imprimé et données signées (comparaison déterministe sur une lecture optique), et pour un avis d'imposition le **dernier avis connu** de la DGFiP. Verdict : *mise en doute* si la signature est invalide ou si le texte contredit les données signées ; *vérifiée* si la signature est valide ; *non vérifiable* sinon. Une signature valide ne prouve ni que le document est le plus récent, ni que son porteur en est le titulaire.

Guides : [CLI](docs/cli.md), [TypeScript](docs/integrate-typescript.md), [Python](docs/integrate-python.md), [MCP](docs/mcp.md), [contrat d'API](docs/api.md). Exemples exécutables dans `examples/`. Licence Apache-2.0.
