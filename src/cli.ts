#!/usr/bin/env node
/**
 * trustmydocs: the command-line entry point.
 *
 * One instruction verifies a document once a key is stored; the first run
 * walks through getting the free key (it arrives by email) and stores it.
 */

import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { ApiError, TrustMyDocsClient, looksLikeApiKey, KEY_REQUEST_URL } from './client.js';
import { type Command, UsageError, USAGE, parseCli } from './cli-args.js';
import { clearConfig, configPath, readConfig, resolveApiKey, resolveBaseUrl, writeConfig } from './config.js';
import type { TenantFileResult, VerificationResult } from './result.js';
import { summariseKeyInfo, summariseTenantFile, summariseVerification } from './summarise.js';
import { PACKAGE_VERSION } from './version.js';
import { type Lang, resolveLang } from './wording.js';

const EXIT = { ok: 0, error: 1, notAuthentic: 2, unverifiable: 3 } as const;

const out = (text: string) => process.stdout.write(text + '\n');
const err = (text: string) => process.stderr.write(text + '\n');

const t = (lang: Lang, en: string, fr: string) => (lang === 'fr' ? fr : en);

const ask = async (prompt: string, options: { hidden?: boolean } = {}): Promise<string> => {
  if (options.hidden) {
    const muted = new Writable({ write: (_chunk, _encoding, callback) => callback() });
    const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
    process.stdout.write(prompt);
    try {
      return (await rl.question('')).trim();
    } finally {
      process.stdout.write('\n');
      rl.close();
    }
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
};

const explainError = (error: unknown, lang: Lang): string => {
  if (error instanceof ApiError) {
    const retry = error.retryAfterSeconds ? t(lang, ` Retry in ${error.retryAfterSeconds} s.`, ` Réessayez dans ${error.retryAfterSeconds} s.`) : '';
    return `${error.message}${retry}`;
  }
  return error instanceof Error ? error.message : String(error);
};

/** Interactive first run: request the key by email, let the user paste it, store it. */
const login = async (options: { email?: string; key?: string; baseUrl?: string }, lang: Lang): Promise<number> => {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  let key = options.key?.trim();

  if (!key) {
    if (!process.stdin.isTTY) {
      err(t(lang,
        `No API key. Set TRUSTMYDOCS_API_KEY, or run "trustmydocs login" in a terminal. Free key: ${KEY_REQUEST_URL}`,
        `Pas de clé d’API. Définissez TRUSTMYDOCS_API_KEY, ou lancez « trustmydocs login » dans un terminal. Clé gratuite : ${KEY_REQUEST_URL}`));
      return EXIT.error;
    }
    const email = options.email?.trim() || (await ask(t(lang, 'Work email to receive the free key: ', 'Email professionnel qui recevra la clé gratuite : ')));
    if (!email.includes('@')) {
      err(t(lang, 'That does not look like an email address.', 'Cela ne ressemble pas à une adresse email.'));
      return EXIT.error;
    }
    try {
      const answer = await new TrustMyDocsClient({ baseUrl }).requestKey(email);
      out(answer.message || t(lang, 'If the address is valid, the key has just been sent.', 'Si l’adresse est valide, la clé vient d’être envoyée.'));
      out(t(lang,
        'Disposable or placeholder addresses receive nothing. Check the spam folder.',
        'Les adresses jetables ou fictives ne reçoivent rien. Pensez aux indésirables.'));
    } catch (error) {
      err(explainError(error, lang));
      return EXIT.error;
    }
    key = await ask(t(lang, 'Paste the key from the email (tmd_live_...): ', 'Collez la clé reçue par email (tmd_live_...) : '), { hidden: true });
  }

  if (!looksLikeApiKey(key)) {
    err(t(lang, 'That does not look like a Trust My Docs key (tmd_live_...). Nothing stored.', 'Cela ne ressemble pas à une clé Trust My Docs (tmd_live_...). Rien n’a été enregistré.'));
    return EXIT.error;
  }
  try {
    const info = await new TrustMyDocsClient({ apiKey: key, baseUrl }).me();
    const path = writeConfig({ ...readConfig(), apiKey: key, ...(options.baseUrl ? { baseUrl } : {}) });
    out(summariseKeyInfo(info, lang));
    out(t(lang, `Key stored in ${path} (mode 600).`, `Clé enregistrée dans ${path} (mode 600).`));
    return EXIT.ok;
  } catch (error) {
    err(explainError(error, lang));
    return EXIT.error;
  }
};

const clientFor = async (command: { key?: string; baseUrl?: string }, lang: Lang): Promise<TrustMyDocsClient | null> => {
  let { apiKey } = resolveApiKey(command.key);
  if (!apiKey) {
    if (!process.stdin.isTTY) {
      err(t(lang,
        `No API key. Set TRUSTMYDOCS_API_KEY or run "trustmydocs login". Free key: ${KEY_REQUEST_URL}`,
        `Pas de clé d’API. Définissez TRUSTMYDOCS_API_KEY ou lancez « trustmydocs login ». Clé gratuite : ${KEY_REQUEST_URL}`));
      return null;
    }
    out(t(lang, 'No API key stored yet. It is free and takes a minute.', 'Aucune clé d’API enregistrée. C’est gratuit et cela prend une minute.'));
    if ((await login({ baseUrl: command.baseUrl }, lang)) !== EXIT.ok) return null;
    apiKey = resolveApiKey().apiKey;
  }
  return new TrustMyDocsClient({ apiKey, baseUrl: resolveBaseUrl(command.baseUrl) });
};

const exitFor = (verdict: VerificationResult['verdict']): number =>
  verdict === 'authentic' ? EXIT.ok : verdict === 'not_authentic' ? EXIT.notAuthentic : verdict === 'unverifiable' ? EXIT.unverifiable : EXIT.error;

const exitForTenantFile = (result: TenantFileResult): number => {
  if (!result.success) return EXIT.error;
  const doubt = result.documents.some((d) => d.verdict === 'not_authentic') || result.checks.some((c) => c.status === 'mismatch');
  if (doubt) return EXIT.notAuthentic;
  const unsure = result.documents.some((d) => d.verdict !== 'authentic' && d.verdict !== 'out_of_scope') || result.checks.some((c) => c.status !== 'coherent');
  return unsure ? EXIT.unverifiable : EXIT.ok;
};

const run = async (command: Command): Promise<number> => {
  const lang = resolveLang('lang' in command ? command.lang : undefined);
  switch (command.kind) {
    case 'help':
      out(USAGE);
      return EXIT.ok;
    case 'version':
      out(PACKAGE_VERSION);
      return EXIT.ok;
    case 'login':
      return login(command, lang);
    case 'logout': {
      const removed = clearConfig();
      out(removed ? t(lang, `Removed ${configPath()}.`, `${configPath()} supprimé.`) : t(lang, 'No stored key.', 'Aucune clé enregistrée.'));
      return EXIT.ok;
    }
    case 'mcp': {
      const { startMcpServer } = await import('./mcp-server.js');
      await startMcpServer({ apiKey: resolveApiKey(command.key).apiKey, baseUrl: resolveBaseUrl(command.baseUrl), lang });
      return EXIT.ok;
    }
    case 'quota': {
      const client = await clientFor(command, lang);
      if (!client) return EXIT.error;
      const info = await client.me();
      out(command.json || command.raw ? JSON.stringify(command.raw ? info.raw : info, null, 2) : summariseKeyInfo(info, lang));
      return EXIT.ok;
    }
    case 'verify': {
      const client = await clientFor(command, lang);
      if (!client) return EXIT.error;
      const input = command.type === 'id' || command.type === 'old-id' ? { front: command.file, back: command.back } : command.file;
      const result = await client.verify(command.type, input);
      if (command.raw) out(JSON.stringify(result.raw, null, 2));
      else if (command.json) out(JSON.stringify(result, null, 2));
      else out(`${command.file}\n${summariseVerification(result, lang, { fields: command.fields })}`);
      return exitFor(result.verdict);
    }
    case 'tenant-file': {
      const client = await clientFor(command, lang);
      if (!client) return EXIT.error;
      const result = await client.tenantFile({
        tax: command.tax,
        payslip: command.payslip,
        idFront: command.idFront,
        idBack: command.idBack,
        oldIdFront: command.oldIdFront,
        oldIdBack: command.oldIdBack,
        passport: command.passport,
        other: command.other,
      });
      if (command.raw) out(JSON.stringify(result.raw, null, 2));
      else if (command.json) out(JSON.stringify(result, null, 2));
      else out(summariseTenantFile(result, lang));
      return exitForTenantFile(result);
    }
  }
};

const main = async (): Promise<void> => {
  let command: Command;
  try {
    command = parseCli(process.argv.slice(2));
  } catch (error) {
    err(error instanceof UsageError || (error instanceof Error && error.name === 'TypeError') ? `${error.message}\n\nRun trustmydocs --help.` : String(error));
    process.exitCode = EXIT.error;
    return;
  }
  try {
    process.exitCode = await run(command);
  } catch (error) {
    err(explainError(error, resolveLang('lang' in command ? command.lang : undefined)));
    process.exitCode = EXIT.error;
  }
};

await main();
