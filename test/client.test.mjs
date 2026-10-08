import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiError, TrustMyDocsClient, toPart } from '../dist/index.js';

const fakeFetch = (handler) => {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { impl, calls };
};

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

test('verify sends a bearer token and a multipart "file" part, then normalises', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tmd-'));
  const file = join(dir, 'avis.pdf');
  writeFileSync(file, '%PDF-1.4 fake');
  const { impl, calls } = fakeFetch(async () => json(200, { success: true, certificate: { verification: 'OK' }, fiscal_fields: { a: '1' }, 'Dernier avis ?': true }));
  const client = new TrustMyDocsClient({ apiKey: 'tmd_live_test', fetch: impl });
  const result = await client.verify('2ddoc', file);
  assert.equal(result.verdict, 'authentic');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://trustmydocs.com/api/v1/verify/2ddoc');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.authorization, 'Bearer tmd_live_test');
  assert.match(calls[0].init.headers['user-agent'], /^trustmydocs\//);
  const part = calls[0].init.body.get('file');
  assert.equal(part.name, 'avis.pdf');
  assert.equal(part.type, 'application/pdf');
});

test('ID cards go as front/back parts', async () => {
  const { impl, calls } = fakeFetch(async () => json(200, { success: true, '2d_doc_results': { success: false }, llm_results: { success: false } }));
  const client = new TrustMyDocsClient({ apiKey: 'k', fetch: impl });
  await client.verify('id', { front: { data: new Uint8Array([1]), filename: 'front.jpg' }, back: { data: new Uint8Array([2]), filename: 'back.jpg' } });
  assert.equal(calls[0].url, 'https://trustmydocs.com/api/v1/verify/id');
  assert.ok(calls[0].init.body.get('front'));
  assert.ok(calls[0].init.body.get('back'));
});

test('tenant file maps camelCase inputs to the API field names', async () => {
  const { impl, calls } = fakeFetch(async () => json(200, { success: true, documents: [], checks: [], reserves: [] }));
  const client = new TrustMyDocsClient({ apiKey: 'k', fetch: impl });
  await client.tenantFile({
    tax: [{ data: new Uint8Array([1]), filename: 'a.pdf' }],
    payslip: [{ data: new Uint8Array([1]), filename: 'p1.pdf' }, { data: new Uint8Array([1]), filename: 'p2.pdf' }],
    idBack: { data: new Uint8Array([1]), filename: 'b.png' },
  });
  const body = calls[0].init.body;
  assert.equal(calls[0].url, 'https://trustmydocs.com/api/v1/tenant-file');
  assert.equal(body.getAll('payslip').length, 2);
  assert.ok(body.get('id_back'));
  assert.equal(body.get('tax').name, 'a.pdf');
});

test('me and requestKey', async () => {
  const { impl, calls } = fakeFetch(async (url) =>
    url.endsWith('/me') ? json(200, { email: 'a***@x', plan: 'free', quota_per_day: 100, used_today: 2 }) : json(200, { message: 'neutral' }),
  );
  const client = new TrustMyDocsClient({ apiKey: 'k', fetch: impl, baseUrl: 'https://example.test/' });
  const info = await client.me();
  assert.equal(info.usedToday, 2);
  assert.equal(calls[0].url, 'https://example.test/api/v1/me');
  const answer = await client.requestKey('me@example.com');
  assert.equal(answer.message, 'neutral');
  assert.equal(calls[1].init.headers.authorization, undefined);
  assert.equal(JSON.parse(calls[1].init.body).email, 'me@example.com');
});

test('missing key is refused before any network call', async () => {
  const { impl, calls } = fakeFetch(async () => json(200, {}));
  const client = new TrustMyDocsClient({ fetch: impl });
  await assert.rejects(client.me(), (e) => e instanceof ApiError && e.code === 'missing_key');
  assert.equal(calls.length, 0);
});

test('HTTP errors become ApiError with code and Retry-After', async () => {
  const cases = [
    [json(401, { error: 'invalid_key', message: 'Unknown or revoked API key.' }), 'invalid_key', undefined],
    [json(429, { error: 'quota_reached', message: 'Daily quota reached.' }, { 'retry-after': '3600' }), 'quota_reached', 3600],
    [json(429, { error: 'service_quota_reached' }, { 'retry-after': '60' }), 'service_quota_reached', 60],
    [new Response('too big', { status: 413 }), 'payload_too_large', undefined],
    [json(503, { error: 'unavailable' }), 'unavailable', undefined],
    [new Response('<html>', { status: 502 }), 'unknown', undefined],
  ];
  for (const [response, code, retry] of cases) {
    const client = new TrustMyDocsClient({ apiKey: 'k', fetch: async () => response });
    await assert.rejects(client.me(), (e) => {
      assert.ok(e instanceof ApiError);
      assert.equal(e.code, code);
      assert.equal(e.retryAfterSeconds, retry);
      return true;
    });
  }
});

test('network failures are wrapped', async () => {
  const client = new TrustMyDocsClient({ apiKey: 'k', fetch: async () => { throw new TypeError('fetch failed'); } });
  await assert.rejects(client.me(), (e) => e instanceof ApiError && e.code === 'network');
});

test('unsupported extensions and unknown types are rejected locally', async () => {
  await assert.rejects(toPart('notes.txt'), (e) => e.code === 'unsupported_format');
  await assert.rejects(toPart('/definitely/missing.pdf'), (e) => e.code === 'bad_request');
  const client = new TrustMyDocsClient({ apiKey: 'k', fetch: async () => json(200, {}) });
  await assert.rejects(client.verifyRaw('nope', 'a.pdf'), (e) => e.code === 'bad_request');
});
