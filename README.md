# Vérifier un avis d'imposition et des documents officiels français (2D-Doc) : SDK, CLI et serveur MCP

[![npm](https://img.shields.io/npm/v/trustmydocs.svg)](https://www.npmjs.com/package/trustmydocs)
[![CI](https://github.com/trustmydocs/trustmydocs-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/trustmydocs/trustmydocs-sdk/actions/workflows/ci.yml)
[![Licence](https://img.shields.io/badge/licence-Apache--2.0-blue.svg)](LICENSE)

**Site : [trustmydocs.com](https://trustmydocs.com)** · [Vérifier un avis d'imposition en ligne, gratuit, sans compte](https://trustmydocs.com/fr) · [API de vérification de documents et clé gratuite](https://trustmydocs.com/fr/api) · [Connecteur MCP pour Claude et ChatGPT](https://trustmydocs.com/fr/connecteur-mcp) · [Automatiser avec Make et n8n](https://trustmydocs.com/fr/automatisation-make) · [Vérifier un dossier locataire](https://trustmydocs.com/fr/dossier-locataire) · [Blog : 2D-Doc, faux documents, dossiers de location](https://trustmydocs.com/fr/blog)

`trustmydocs` est le client open source de l'API [Trust My Docs](https://trustmydocs.com), un service français de **vérification de documents officiels** : avis d'imposition, cartes nationales d'identité, passeports, bulletins de paie et dossiers de location complets. Il lit le **code 2D-Doc** imprimé sur les avis d'impôt et les cartes d'identité, **vérifie la signature électronique** auprès de l'autorité de certification de l'émetteur (liste de confiance ANTS), demande à la **DGFiP** si l'avis est le dernier connu, et compare le texte imprimé aux données signées pour repérer un **faux avis d'imposition** ou un document retouché.

Un seul paquet npm, trois usages : un **SDK TypeScript / Node.js**, une **ligne de commande** et un **serveur MCP** pour Claude, Cursor, ChatGPT et les autres assistants. Les documents sont envoyés en HTTPS, analysés en mémoire sur des serveurs européens, puis supprimés. Rien n'est conservé.

*English summary at the end of this page.*

## Vérifier un avis d'imposition en une commande

```sh
npx trustmydocs verify avis-imposition.pdf
```

Au premier lancement, la commande demande votre email professionnel, obtient une **clé d'API gratuite** (elle arrive par email en quelques secondes) et la conserve dans `~/.config/trustmydocs/config.json` (mode 600). Ensuite, une seule ligne suffit, pour un avis d'imposition comme pour tout autre document.

```text
avis-imposition.pdf
Authenticité vérifiée (avis d'imposition)
  .   Analyse : Terminée. Code 2D-Doc lu et lecture optique effectuée.
  OK  Signature 2D-Doc : Valide. Signature vérifiée auprès de l'autorité de certification : les données signées proviennent bien de l'émetteur.
  OK  Concordance des données visibles avec les données signées : Oui. Les données imprimées correspondent aux données signées.
  OK  Dernier avis connu de la DGFiP : Oui. Confirmé par la DGFiP comme le dernier avis connu.
  OK  Authenticité : Vérifiée. Signature 2D-Doc valide et données visibles conformes aux données signées.
Champs signés : 7
Champs lus optiquement : 12
Rappel : une signature valide prouve l'origine et l'intégrité du code, pas que le document soit le plus récent, ni que son porteur en soit le titulaire. ...
```

Le code de sortie dit le verdict : `0` authentique, `2` authenticité mise en doute, `3` non vérifiable, `1` erreur. `--json` donne le résultat normalisé, `--raw` la réponse brute de l'API, `--lang en` l'anglais.

Autres commandes :

```sh
npx trustmydocs 2ddoc photo-du-code.png                          # lire un 2D-Doc et vérifier sa signature
npx trustmydocs verify cni-recto.jpg --type id --back cni-verso.jpg   # carte d'identité (le 2D-Doc est au verso)
npx trustmydocs verify fiche-de-paie.pdf --type payslip
npx trustmydocs tenant-file --tax avis.pdf --payslip p1.pdf --payslip p2.pdf --id-front recto.jpg --id-back verso.jpg
npx trustmydocs quota                                              # consommation de votre clé
npx trustmydocs --help
```

Sur un serveur ou en intégration continue, définissez `TRUSTMYDOCS_API_KEY` au lieu de lancer `login`. Guide complet : [docs/cli.md](docs/cli.md).

## Détecter un faux avis d'imposition : ce que prouve le 2D-Doc

Le service distingue trois contrôles et ne les confond jamais ; ce paquet non plus.

| Contrôle | Ce qu'il prouve | Nature |
| --- | --- | --- |
| Signature 2D-Doc | Le code a été produit par l'émetteur (DGFiP, ANTS...) et n'a pas été modifié | Cryptographique (ECDSA, certificat de l'émetteur issu de la liste de confiance ANTS) |
| Concordance texte imprimé / données signées | Le texte visible n'a pas été retouché après impression | Comparaison déterministe, à partir d'une lecture optique (OCR et modèle de vision) |
| Dernier avis connu (avis d'imposition) | La DGFiP considère toujours cet avis comme le plus récent | Interrogation du service de la DGFiP |

Règle du verdict : **authenticité mise en doute** si la signature est invalide ou si le texte imprimé contredit les données signées ; **authenticité vérifiée** si la signature est valide ; **non vérifiable** sinon (code illisible, certificat inaccessible, document sans 2D-Doc comme un passeport ou un bulletin de paie). Un avis d'imposition remplacé par un avis plus récent reste authentique, avec une ligne rouge « dernier avis ».

Seule la vérification de signature est une preuve. L'extraction et la comparaison reposent sur des modèles probabilistes : une aide à la décision, pas une expertise. Une signature valide ne dit pas que la personne qui présente le document en est le titulaire. Détails : [docs/verdicts.md](docs/verdicts.md) et l'article [le 2D-Doc expliqué](https://trustmydocs.com/fr/blog/2d-doc-comment-ca-marche).

## Vérifier un dossier locataire complet

Avis d'imposition, bulletins de salaire et pièce d'identité en un seul appel : authenticité de chaque pièce, même identité sur tous les documents, salaires annualisés comparés au revenu fiscal de référence signé, capacité locative. Les comparaisons sont déterministes, sans intelligence artificielle. Version actuelle : locataires salariés.

```sh
npx trustmydocs tenant-file --tax avis-2025.pdf --payslip paie-07.pdf --payslip paie-08.pdf --payslip paie-09.pdf --id-front cni-recto.jpg --id-back cni-verso.jpg
```

La même analyse existe sans code sur la page [Dossier locataire](https://trustmydocs.com/fr/dossier-locataire) du site, et par l'API (`POST /api/v1/tenant-file`).

## API de vérification de documents : SDK TypeScript et Node.js

```sh
npm install trustmydocs
```

```ts
import { TrustMyDocsClient } from 'trustmydocs';

const client = new TrustMyDocsClient({ apiKey: process.env.TRUSTMYDOCS_API_KEY });

const result = await client.verify('tax', './avis-imposition.pdf');
console.log(result.verdict);        // 'authentic' | 'not_authentic' | 'unverifiable' | 'error'
console.log(result.signature);      // 'valid' | 'invalid' | 'absent' | 'unavailable' | 'not_applicable'
console.log(result.latest);         // 'yes' | 'no' | 'unavailable' | 'no_code'   (avis d'imposition)
console.log(result.signedFields);   // ce que l'émetteur a signé dans le 2D-Doc
console.log(result.raw);            // la réponse de l'API, intacte
```

Types de documents : `tax` (avis d'imposition), `2ddoc` (code seul), `id` (CNI nouveau format), `old-id` (CNI ancien format), `passport`, `payslip` (bulletin de paie), `generic`. Entrées acceptées : chemin de fichier, `Blob`/`File`, ou `{ data: Uint8Array, filename }`. Formats : PDF, JPG, PNG, TIFF, BMP.

Guides : [intégration TypeScript](docs/integrate-typescript.md), [intégration Python](docs/integrate-python.md) (HTTP simple avec `requests`, sans paquet), [contrat d'API v1](docs/api.md), [documentation interactive Swagger](https://trustmydocs.com/api/docs), [exemples exécutables](examples/) en Node, TypeScript, Python, curl, GitHub Actions, Make et n8n.

## Serveur MCP : vérifier des documents depuis Claude, Cursor ou ChatGPT

Donnez à un assistant la capacité de vérifier les documents présents sur votre disque :

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

Outils : `verify_document`, `verify_tenant_file`, `read_2ddoc`, `check_quota`. La clé peut aussi venir de `npx trustmydocs login`. Détails : [docs/mcp.md](docs/mcp.md). Pour les clients qui ne lancent pas de serveur local, le site propose un [connecteur MCP distant sans clé](https://trustmydocs.com/fr/connecteur-mcp), avec une zone de dépôt dans la conversation.

## Questions fréquentes

**Comment vérifier qu'un avis d'imposition est vrai ?** Lisez son code 2D-Doc et vérifiez la signature auprès de l'autorité de certification : `npx trustmydocs verify avis.pdf`, ou déposez le PDF sur [trustmydocs.com](https://trustmydocs.com/fr). Une signature valide prouve que les données du code viennent de la DGFiP et n'ont pas été modifiées. Comparez ensuite le texte imprimé aux données signées, et vérifiez qu'il s'agit du dernier avis connu.

**Qu'est-ce qu'un 2D-Doc ?** Un code-barres Data Matrix normalisé par l'ANTS, imprimé sur les avis d'imposition, les cartes d'identité, certains justificatifs de domicile et attestations. Il contient des champs choisis par l'émetteur et une signature électronique qui les couvre.

**Peut-on vérifier un bulletin de paie ou un passeport ?** Ils ne portent pas de 2D-Doc : le service les lit optiquement et en extrait les champs, mais ne peut pas en prouver l'authenticité. Le verdict est alors « non vérifiable ». Dans un dossier locataire, les salaires lus sont comparés au revenu fiscal de référence signé de l'avis d'imposition, ce qui donne un contrôle de cohérence.

**L'API est-elle gratuite ?** Oui, en bêta : clé gratuite par email, 100 vérifications par jour et par clé, plafond partagé de 300 vérifications par jour pour l'ensemble des clés, 20 clés délivrées par jour. Au-delà, l'API répond 429 avec `Retry-After`. Le site reste ouvert et sans compte.

**Que devient le document envoyé ?** Il est analysé en mémoire sur des serveurs européens, transmis le temps de l'analyse au fournisseur de modèle de vision décrit dans la [politique de confidentialité](https://trustmydocs.com/fr/politique-confidentialite), puis supprimé. Les journaux techniques ne contiennent aucune donnée de document. Ce client n'écrit rien sur le disque, à part la clé si vous choisissez de la conserver.

**Puis-je automatiser sans coder ?** Oui, avec le module HTTP de Make ou n8n : [tutoriel pas à pas](https://trustmydocs.com/fr/automatisation-make) et réglages dans [examples/no-code](examples/no-code/README.md).

## Limites de la bêta gratuite

| Limite | Valeur |
| --- | --- |
| Vérifications par clé et par jour | 100 |
| Vérifications par jour, toutes clés confondues | 300 |
| Clés délivrées par jour | 20 (3 par heure et par IP, 3 par boîte, 3 par domaine) |
| Taille d'une requête | 32 Mo |
| Formats | PDF, JPG, PNG, TIFF, BMP |

Les adresses jetables ou fictives ne reçoivent aucune clé. Une clé est stable ; une nouvelle demande pour la même boîte révoque la précédente.

## Le dépôt

- `src/` le paquet : SDK (`index.ts`), ligne de commande (`cli.ts`), serveur MCP (`mcp.ts`)
- `docs/` guides d'intégration, contrat d'API, sémantique des verdicts, publication
- `examples/` scripts exécutables en Node, TypeScript, Python, curl, GitHub Actions, avec des réponses attendues anonymisées
- `test/` tests unitaires (`npm test`), sans réseau

Le service lui-même, ses [conditions d'utilisation](https://trustmydocs.com/fr/cgu), sa [politique de confidentialité](https://trustmydocs.com/fr/politique-confidentialite) et ses [mentions légales](https://trustmydocs.com/fr/mentions-legales) sont sur [trustmydocs.com](https://trustmydocs.com). Questions techniques : contact@trustmydocs.com.

Contribuer : [CONTRIBUTING.md](CONTRIBUTING.md). Sécurité : [SECURITY.md](SECURITY.md). Licence Apache-2.0 ; « Trust My Docs » est un nom commercial de l'opérateur du service, la licence n'accorde aucun droit sur ce nom.

---

## In English

`trustmydocs` is the open-source client of [Trust My Docs](https://trustmydocs.com), a French service that verifies official documents: it reads the **2D-Doc** code printed on tax notices (avis d'imposition) and identity cards, checks its **electronic signature against the issuer's certificate authority**, asks the DGFiP whether a tax notice is the **latest known**, and compares the printed text with the signed data. It also reads passports, old-format identity cards and payslips, and analyses a whole **rental application** in one call. One npm package: a TypeScript SDK, a CLI and an MCP server for Claude, Cursor and ChatGPT.

```sh
npx trustmydocs verify avis-imposition.pdf --lang en     # first run requests a free key by email, then one line
claude mcp add trustmydocs -- npx -y trustmydocs mcp      # MCP server
npm install trustmydocs                                   # SDK
```

Verdict rule: **not authentic** on an invalid signature or printed data contradicting the signed data; **authentic** on a valid signature; **not verifiable** otherwise. Only the signature check is cryptographic; extraction and comparison are an aid, not evidence. Documents are analysed in memory on European servers and deleted; nothing is stored.

English documentation: [CLI](docs/cli.md), [TypeScript](docs/integrate-typescript.md), [Python](docs/integrate-python.md), [API contract](docs/api.md), [verdict semantics](docs/verdicts.md), [MCP](docs/mcp.md), [publishing](docs/publishing.md). Examples in [examples/](examples/).
