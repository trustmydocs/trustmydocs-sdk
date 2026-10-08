import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearConfig, configPath, readConfig, resolveApiKey, resolveBaseUrl, writeConfig } from '../dist/index.js';

const env = () => ({ TRUSTMYDOCS_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'tmd-cfg-')) });

test('config is written 0600 and read back', () => {
  const e = env();
  const path = writeConfig({ apiKey: 'tmd_live_stored' }, e);
  assert.equal(path, configPath(e));
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.deepEqual(readConfig(e), { apiKey: 'tmd_live_stored' });
  assert.equal(clearConfig(e), true);
  assert.equal(clearConfig(e), false);
  assert.deepEqual(readConfig(e), {});
});

test('key resolution order: flag, env, config, none', () => {
  const e = env();
  assert.deepEqual(resolveApiKey(undefined, e), { apiKey: '', source: 'none' });
  writeConfig({ apiKey: 'from-config' }, e);
  assert.deepEqual(resolveApiKey(undefined, e), { apiKey: 'from-config', source: 'config' });
  assert.deepEqual(resolveApiKey(undefined, { ...e, TRUSTMYDOCS_API_KEY: 'from-env' }), { apiKey: 'from-env', source: 'env' });
  assert.deepEqual(resolveApiKey(' from-flag ', { ...e, TRUSTMYDOCS_API_KEY: 'from-env' }), { apiKey: 'from-flag', source: 'flag' });
});

test('XDG and home fallbacks', () => {
  assert.equal(configPath({ XDG_CONFIG_HOME: '/x' }), '/x/trustmydocs/config.json');
  assert.match(configPath({}), /\.config\/trustmydocs\/config\.json$/);
});

test('base url resolution', () => {
  const e = env();
  assert.equal(resolveBaseUrl(undefined, e), undefined);
  writeConfig({ baseUrl: 'https://cfg.test' }, e);
  assert.equal(resolveBaseUrl(undefined, e), 'https://cfg.test');
  assert.equal(resolveBaseUrl(undefined, { ...e, TRUSTMYDOCS_API_BASE: 'https://env.test' }), 'https://env.test');
  assert.equal(resolveBaseUrl('https://flag.test', e), 'https://flag.test');
});
