import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCli, UsageError } from '../dist/cli-args.js';

test('verify defaults to the tax type and keeps common flags', () => {
  const c = parseCli(['verify', 'avis.pdf', '--json', '--lang', 'fr']);
  assert.equal(c.kind, 'verify');
  assert.equal(c.type, 'tax');
  assert.equal(c.file, 'avis.pdf');
  assert.equal(c.json, true);
  assert.equal(c.fields, true);
  assert.equal(c.lang, 'fr');
});

test('2ddoc is a shortcut for verify --type 2ddoc', () => {
  const c = parseCli(['2ddoc', 'photo.png']);
  assert.equal(c.kind, 'verify');
  assert.equal(c.type, '2ddoc');
});

test('id card takes a back side; other types refuse it', () => {
  const c = parseCli(['verify', 'front.jpg', '--type', 'id', '--back', 'back.jpg']);
  assert.equal(c.back, 'back.jpg');
  assert.throws(() => parseCli(['verify', 'avis.pdf', '--back', 'x.jpg']), UsageError);
});

test('tenant-file collects repeatable documents and enforces the API limits', () => {
  const c = parseCli(['tenant-file', '--tax', 'a.pdf', '--payslip', 'p1.pdf', '--payslip', 'p2.pdf', '--id-front', 'f.jpg', '--id-back', 'b.jpg']);
  assert.equal(c.kind, 'tenant-file');
  assert.deepEqual(c.tax, ['a.pdf']);
  assert.deepEqual(c.payslip, ['p1.pdf', 'p2.pdf']);
  assert.equal(c.idFront, 'f.jpg');
  assert.throws(() => parseCli(['tenant-file']), UsageError);
  assert.throws(() => parseCli(['tenant-file', '--tax', '1', '--tax', '2', '--tax', '3']), UsageError);
  assert.throws(() => parseCli(['tenant-file', 'stray.pdf', '--tax', 'a.pdf']), UsageError);
});

test('login, logout, quota, mcp, help and version', () => {
  assert.deepEqual(parseCli(['login', 'me@example.com']).email, 'me@example.com');
  assert.equal(parseCli(['login', '--key', 'tmd_live_x']).key, 'tmd_live_x');
  assert.equal(parseCli(['logout']).kind, 'logout');
  assert.equal(parseCli(['quota']).kind, 'quota');
  assert.equal(parseCli(['whoami']).kind, 'quota');
  assert.equal(parseCli(['mcp']).kind, 'mcp');
  assert.equal(parseCli([]).kind, 'help');
  assert.equal(parseCli(['--help']).kind, 'help');
  assert.equal(parseCli(['-V']).kind, 'version');
});

test('unknown command or type is a usage error', () => {
  assert.throws(() => parseCli(['frobnicate']), UsageError);
  assert.throws(() => parseCli(['verify', 'x.pdf', '--type', 'nope']), UsageError);
  assert.throws(() => parseCli(['verify']), UsageError);
});

test('--no-fields turns field printing off', () => {
  assert.equal(parseCli(['verify', 'a.pdf', '--no-fields']).fields, false);
});
