/**
 * MCP server exposing the verifications as tools.
 *
 * It runs on the user's machine precisely so that it can read local files:
 * each document is sent over HTTPS to the API, analysed, and deleted. The
 * server holds no logic of its own; every verdict comes from the API.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ApiError, DEFAULT_BASE_URL, KEY_REQUEST_URL, SUPPORTED_EXTENSIONS, TrustMyDocsClient } from './client.js';
import { DOCUMENT_TYPES } from './result.js';
import { summariseKeyInfo, summariseTenantFile, summariseVerification } from './summarise.js';
import { PACKAGE_VERSION } from './version.js';
import type { Lang } from './wording.js';

export interface McpOptions {
  apiKey: string;
  baseUrl?: string;
  lang: Lang;
}

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

export const startMcpServer = async (options: McpOptions): Promise<void> => {
  const client = new TrustMyDocsClient({ apiKey: options.apiKey, baseUrl: options.baseUrl ?? DEFAULT_BASE_URL });
  const lang = options.lang;

  const reply = (summary: string, payload: unknown): ToolResult => ({
    content: [
      { type: 'text', text: summary },
      { type: 'text', text: '```json\n' + JSON.stringify(payload, null, 2) + '\n```' },
    ],
  });

  const failure = (error: unknown): ToolResult => {
    let message = error instanceof Error ? error.message : String(error);
    if (error instanceof ApiError) {
      if (error.code === 'missing_key') {
        message =
          `No API key configured. The user can get a free one in a minute: run "npx trustmydocs login" in a terminal, ` +
          `or set TRUSTMYDOCS_API_KEY in this server's environment. Keys are requested on ${KEY_REQUEST_URL} and arrive by email.`;
      } else if (error.retryAfterSeconds) {
        message += ` Retry in ${error.retryAfterSeconds} s.`;
      }
    }
    return { content: [{ type: 'text', text: message }], isError: true };
  };

  const server = new McpServer({ name: 'trustmydocs', version: PACKAGE_VERSION });

  server.registerTool(
    'verify_document',
    {
      title: 'Verify a French official document',
      description:
        'Verifies a French official document: reads its 2D-Doc code if it carries one, checks the electronic signature against the certificate authority, and extracts the fields. ' +
        'For a tax notice, also asks the DGFiP whether it is the latest notice. ' +
        `Types: tax (avis d'imposition), 2ddoc (code alone), id (new-format CNI), old-id (old-format CNI), passport, payslip (bulletin de paie), generic. ` +
        `Formats: ${SUPPORTED_EXTENSIONS.join(', ')}. The file is sent to the Trust My Docs API for analysis, then deleted. ` +
        'The answer keeps three controls apart: signature, printed-versus-signed data, latest notice. A valid signature proves origin and integrity of the code, not that the document is genuine or current.',
      inputSchema: {
        path: z.string().describe('Absolute path of the document on this machine.'),
        type: z.enum(DOCUMENT_TYPES as [string, ...string[]]).describe('Document type.'),
        back_path: z.string().optional().describe('Back side, for an identity card (the 2D-Doc of a CNI is on the back).'),
      },
    },
    async ({ path, type, back_path: backPath }) => {
      try {
        const kind = type as (typeof DOCUMENT_TYPES)[number];
        const input = kind === 'id' || kind === 'old-id' ? { front: path, back: backPath } : path;
        const result = await client.verify(kind, input);
        return reply(summariseVerification(result, lang, { fields: true }), result);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'verify_tenant_file',
    {
      title: 'Verify a rental application (dossier locataire)',
      description:
        'Analyses a whole rental application in one call: authenticity of each document, then coherence of the set (same first and last name on every document, annualised salaries compared with the signed revenu fiscal de référence, rental capacity). ' +
        'Comparisons are deterministic. Current scope: salaried tenants. Quota: one unit per analysed document.',
      inputSchema: {
        tax: z.array(z.string()).optional().describe('Tax notices (2 at most).'),
        payslips: z.array(z.string()).optional().describe('Payslips (6 at most).'),
        id_front: z.string().optional().describe('Front of a new-format identity card.'),
        id_back: z.string().optional().describe('Back of a new-format identity card (carries the 2D-Doc).'),
        old_id_front: z.string().optional().describe('Front of an old-format identity card.'),
        old_id_back: z.string().optional().describe('Back of an old-format identity card.'),
        passport: z.string().optional().describe('Passport.'),
      },
    },
    async ({ tax, payslips, id_front, id_back, old_id_front, old_id_back, passport }) => {
      try {
        const result = await client.tenantFile({
          tax,
          payslip: payslips,
          idFront: id_front,
          idBack: id_back,
          oldIdFront: old_id_front,
          oldIdBack: old_id_back,
          passport,
        });
        return reply(summariseTenantFile(result, lang), result);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'read_2ddoc',
    {
      title: 'Read a 2D-Doc code',
      description:
        'Decodes the 2D-Doc code of a document and verifies its electronic signature, without reading the rest of the page. ' +
        'Answers what the issuer signed: fields, certificate authority, signature validity.',
      inputSchema: { path: z.string().describe('Absolute path of the document carrying the code.') },
    },
    async ({ path }) => {
      try {
        const result = await client.read2DDoc(path);
        return reply(summariseVerification(result, lang, { fields: true }), result);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'check_quota',
    {
      title: 'API key usage',
      description: 'Plan, daily quota and usage of the configured API key. Does not consume quota.',
      inputSchema: {},
    },
    async () => {
      try {
        const info = await client.me();
        return reply(summariseKeyInfo(info, lang), info);
      } catch (error) {
        return failure(error);
      }
    },
  );

  await server.connect(new StdioServerTransport());
};
