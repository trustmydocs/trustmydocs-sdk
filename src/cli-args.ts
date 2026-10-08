/**
 * Command-line parsing, kept free of I/O so it can be unit tested.
 */

import { parseArgs } from 'node:util';
import { type DocumentType, DOCUMENT_TYPES } from './result.js';

interface Common {
  json: boolean;
  raw: boolean;
  fields: boolean;
  lang?: string;
  key?: string;
  baseUrl?: string;
}

export type Command =
  | { kind: 'help' }
  | { kind: 'version' }
  | ({ kind: 'verify'; file: string; type: DocumentType; back?: string } & Common)
  | ({
      kind: 'tenant-file';
      tax: string[];
      payslip: string[];
      idFront?: string;
      idBack?: string;
      oldIdFront?: string;
      oldIdBack?: string;
      passport?: string;
      other: string[];
    } & Common)
  | { kind: 'login'; email?: string; key?: string; baseUrl?: string; lang?: string }
  | { kind: 'logout'; lang?: string }
  | ({ kind: 'quota' } & Common)
  | { kind: 'mcp'; key?: string; baseUrl?: string; lang?: string };

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export const USAGE = `trustmydocs: verify French official documents from the command line.

Usage
  trustmydocs verify <file> [--type <type>] [--back <file>]   verify one document (default type: tax)
  trustmydocs 2ddoc <file>                                     read a 2D-Doc code and check its signature
  trustmydocs tenant-file [--tax <f>]... [--payslip <f>]...    whole rental application in one call
                          [--id-front <f>] [--id-back <f>] [--old-id-front <f>] [--old-id-back <f>]
                          [--passport <f>] [--other <f>]...
  trustmydocs login [email] [--key <tmd_live_...>]             get a free key by email and store it
  trustmydocs logout                                           forget the stored key
  trustmydocs quota                                            plan and usage of the stored key
  trustmydocs mcp                                              run the MCP server (stdio)

Types: ${DOCUMENT_TYPES.join(', ')}. ID cards: pass the back with --back (the 2D-Doc is on the back).
Formats: PDF, JPG, PNG, TIFF, BMP (32 MB per request).

Options
  --json          machine-readable normalised result (verdict, checks, fields, raw payload)
  --raw           the API payload only, untouched
  --no-fields     do not print the extracted field values
  --lang en|fr    wording language (default: $TRUSTMYDOCS_LANG, then $LANG, then en)
  --key <key>     API key for this run (default: $TRUSTMYDOCS_API_KEY, then the stored key)
  --base-url <u>  another API origin (default: https://trustmydocs.com)
  -h, --help      this text
  -V, --version   package version

Exit codes
  0 authentic (or success)   2 not authentic   3 not verifiable   1 error (usage, network, API)

The key is free: https://trustmydocs.com/fr/api. Documents are analysed, then deleted; nothing is stored.`;

export const parseCli = (argv: string[]): Command => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'V' },
      type: { type: 'string', short: 't' },
      back: { type: 'string' },
      tax: { type: 'string', multiple: true },
      payslip: { type: 'string', multiple: true },
      'id-front': { type: 'string' },
      'id-back': { type: 'string' },
      'old-id-front': { type: 'string' },
      'old-id-back': { type: 'string' },
      passport: { type: 'string' },
      other: { type: 'string', multiple: true },
      json: { type: 'boolean' },
      raw: { type: 'boolean' },
      fields: { type: 'boolean', default: true },
      'no-fields': { type: 'boolean' },
      lang: { type: 'string' },
      key: { type: 'string' },
      'base-url': { type: 'string' },
    },
  });

  if (values.help) return { kind: 'help' };
  if (values.version) return { kind: 'version' };

  const common: Common = {
    json: Boolean(values.json),
    raw: Boolean(values.raw),
    fields: !values['no-fields'],
    lang: values.lang,
    key: values.key,
    baseUrl: values['base-url'],
  };

  const [command, ...rest] = positionals;
  switch (command) {
    case undefined:
      return { kind: 'help' };
    case 'verify': {
      const [file] = rest;
      if (!file) throw new UsageError('verify: a document path is required.');
      if (rest.length > 1) throw new UsageError('verify: one document per call (use --back for the back of an ID card).');
      const type = (values.type ?? 'tax') as DocumentType;
      if (!DOCUMENT_TYPES.includes(type)) {
        throw new UsageError(`verify: unknown type "${values.type}". Expected one of: ${DOCUMENT_TYPES.join(', ')}.`);
      }
      if (values.back && type !== 'id' && type !== 'old-id') throw new UsageError('verify: --back only applies to id and old-id.');
      return { kind: 'verify', file, type, back: values.back, ...common };
    }
    case '2ddoc': {
      const [file] = rest;
      if (!file) throw new UsageError('2ddoc: a document path is required.');
      return { kind: 'verify', file, type: '2ddoc', ...common };
    }
    case 'tenant-file': {
      if (rest.length) throw new UsageError('tenant-file: documents are passed with --tax, --payslip, --id-front, ... not as positionals.');
      const command: Command = {
        kind: 'tenant-file',
        tax: values.tax ?? [],
        payslip: values.payslip ?? [],
        idFront: values['id-front'],
        idBack: values['id-back'],
        oldIdFront: values['old-id-front'],
        oldIdBack: values['old-id-back'],
        passport: values.passport,
        other: values.other ?? [],
        ...common,
      };
      const count = command.tax.length + command.payslip.length + (command.idFront ? 1 : 0) + (command.oldIdFront ? 1 : 0) + (command.passport ? 1 : 0);
      if (count === 0) throw new UsageError('tenant-file: at least one of --tax, --payslip, --id-front, --old-id-front or --passport is required.');
      if (command.tax.length > 2) throw new UsageError('tenant-file: 2 tax notices at most.');
      if (command.payslip.length > 6) throw new UsageError('tenant-file: 6 payslips at most.');
      return command;
    }
    case 'login':
      if (rest.length > 1) throw new UsageError('login: one email at most.');
      return { kind: 'login', email: rest[0], key: values.key, baseUrl: values['base-url'], lang: values.lang };
    case 'logout':
      return { kind: 'logout', lang: values.lang };
    case 'quota':
    case 'whoami':
    case 'me':
      return { kind: 'quota', ...common };
    case 'mcp':
      return { kind: 'mcp', key: values.key, baseUrl: values['base-url'], lang: values.lang };
    default:
      throw new UsageError(`Unknown command "${command}". Run trustmydocs --help.`);
  }
};
