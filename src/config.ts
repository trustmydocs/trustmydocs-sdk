/**
 * Where the CLI and the MCP server keep the API key between runs.
 *
 *   $TRUSTMYDOCS_API_KEY                      (wins, never written)
 *   $TRUSTMYDOCS_CONFIG_DIR/config.json
 *   $XDG_CONFIG_HOME/trustmydocs/config.json
 *   ~/.config/trustmydocs/config.json
 *
 * The file is created 0600 in a 0700 directory: a key is a credential.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface StoredConfig {
  apiKey?: string;
  baseUrl?: string;
}

export const configDir = (env: NodeJS.ProcessEnv = process.env): string =>
  env.TRUSTMYDOCS_CONFIG_DIR ?? join(env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'trustmydocs');

export const configPath = (env: NodeJS.ProcessEnv = process.env): string => join(configDir(env), 'config.json');

export const readConfig = (env: NodeJS.ProcessEnv = process.env): StoredConfig => {
  const path = configPath(env);
  if (!existsSync(path)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as StoredConfig) : {};
  } catch {
    return {};
  }
};

export const writeConfig = (config: StoredConfig, env: NodeJS.ProcessEnv = process.env): string => {
  const dir = configDir(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = configPath(env);
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
};

export const clearConfig = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const path = configPath(env);
  if (!existsSync(path)) return false;
  rmSync(path);
  return true;
};

export type KeySource = 'flag' | 'env' | 'config' | 'none';

/** Resolution order: explicit value, environment, config file. */
export const resolveApiKey = (explicit?: string, env: NodeJS.ProcessEnv = process.env): { apiKey: string; source: KeySource } => {
  if (explicit?.trim()) return { apiKey: explicit.trim(), source: 'flag' };
  if (env.TRUSTMYDOCS_API_KEY?.trim()) return { apiKey: env.TRUSTMYDOCS_API_KEY.trim(), source: 'env' };
  const stored = readConfig(env).apiKey?.trim();
  if (stored) return { apiKey: stored, source: 'config' };
  return { apiKey: '', source: 'none' };
};

export const resolveBaseUrl = (explicit?: string, env: NodeJS.ProcessEnv = process.env): string | undefined =>
  explicit?.trim() || env.TRUSTMYDOCS_API_BASE?.trim() || readConfig(env).baseUrl?.trim() || undefined;
