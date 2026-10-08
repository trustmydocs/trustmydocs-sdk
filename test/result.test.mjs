import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toVerificationResult, toTenantFileResult, toKeyInfo, buildVerdict, describeChecks, summariseVerification } from '../dist/index.js';

const taxOk = {
  success: true,
  '2d_doc_results': {
    success: true,
    certificate: { verification: 'OK' },
    fiscal_fields: { nomEtPrenomDuDeclarant1: 'X', revenuFiscalDeReference: '12345', anneeDesRevenus: '2023' },
    'Dernier avis ?': true,
  },
  llm_results: { success: true, extracted_fields: { nom: 'X' } },
  authenticity: true,
};

test('tax notice: valid signature + matching content + latest = authentic', () => {
  const r = toVerificationResult('tax', taxOk);
  assert.equal(r.verdict, 'authentic');
  assert.equal(r.signature, 'valid');
  assert.equal(r.content, 'match');
  assert.equal(r.latest, 'yes');
  assert.equal(r.analysis, 'code_and_ocr');
  assert.equal(r.authenticityDetail, 'signed_and_matching');
  assert.deepEqual(r.checks.map((c) => c.key), ['analysis', 'signature', 'content', 'latest', 'authenticity']);
  assert.equal(Object.keys(r.signedFields).length, 3);
  assert.equal(r.raw, taxOk);
});

test('tax notice: superseded notice stays authentic with a red latest row', () => {
  const r = toVerificationResult('tax', { ...taxOk, '2d_doc_results': { ...taxOk['2d_doc_results'], 'Dernier avis ?': false } });
  assert.equal(r.verdict, 'authentic');
  assert.equal(r.latest, 'no');
  assert.equal(r.checks.find((c) => c.key === 'latest').status, 'ko');
});

test('tax notice: FAILED signature = not authentic', () => {
  const r = toVerificationResult('tax', { ...taxOk, '2d_doc_results': { ...taxOk['2d_doc_results'], certificate: { verification: 'FAILED' } } });
  assert.equal(r.verdict, 'not_authentic');
  assert.equal(r.signature, 'invalid');
  assert.equal(r.authenticityDetail, 'invalid_signature');
});

test('tax notice: certificate ERROR is unverifiable, never not authentic', () => {
  const r = toVerificationResult('tax', {
    ...taxOk,
    '2d_doc_results': { ...taxOk['2d_doc_results'], certificate: { verification: 'ERROR', error: 'Certificate not found' } },
  });
  assert.equal(r.verdict, 'unverifiable');
  assert.equal(r.signature, 'unavailable');
});

test('tax notice: printed data contradicting signed data = not authentic', () => {
  const r = toVerificationResult('tax', { ...taxOk, authenticity: false });
  assert.equal(r.verdict, 'not_authentic');
  assert.equal(r.content, 'mismatch');
  assert.equal(r.authenticityDetail, 'content_mismatch');
});

test('tax notice: authenticity absent (null) is not comparable, verdict follows the signature', () => {
  const { authenticity, ...withoutAuthenticity } = taxOk;
  const r = toVerificationResult('tax', withoutAuthenticity);
  assert.equal(r.content, 'not_comparable');
  assert.equal(r.verdict, 'authentic');
  assert.equal(r.authenticityDetail, 'signed_content_unknown');
});

test('tax notice: no 2D-Doc read = unverifiable with absent signature and no_code latest', () => {
  const r = toVerificationResult('tax', { success: true, '2d_doc_results': { success: false, error: 'not found' }, llm_results: { success: true, extracted_fields: { a: 1 } } });
  assert.equal(r.verdict, 'unverifiable');
  assert.equal(r.signature, 'absent');
  assert.equal(r.content, 'no_signed_data');
  assert.equal(r.latest, 'no_code');
  assert.equal(r.analysis, 'ocr_no_code');
});

test('ID card: no latest check, id_fields are the signed fields', () => {
  const r = toVerificationResult('id', {
    success: true,
    '2d_doc_results': { success: true, certificate: { verification: 'OK', error: null }, id_fields: { nom: 'X' } },
    llm_results: { success: true, extracted_fields: { nom: 'X' } },
    authenticity: true,
  });
  assert.equal(r.verdict, 'authentic');
  assert.equal(r.latest, undefined);
  assert.deepEqual(r.signedFields, { nom: 'X' });
});

test('2D-Doc alone: code_only content, latest only for fiscal codes', () => {
  const fiscal = toVerificationResult('2ddoc', { success: true, certificate: { verification: 'OK' }, fiscal_fields: { a: '1' }, 'Dernier avis ?': true });
  assert.equal(fiscal.verdict, 'authentic');
  assert.equal(fiscal.content, 'code_only');
  assert.equal(fiscal.latest, 'yes');
  const id = toVerificationResult('2ddoc', { success: true, certificate: { verification: 'OK' }, id_fields: { a: '1' } });
  assert.equal(id.latest, undefined);
  assert.equal(id.verdict, 'authentic');
});

test('OCR-only documents are unverifiable with not_applicable controls', () => {
  const passport = toVerificationResult('passport', { success: true, passport_fields: { surname: 'X' } });
  assert.equal(passport.verdict, 'unverifiable');
  assert.equal(passport.signature, 'not_applicable');
  assert.deepEqual(passport.extractedFields, { surname: 'X' });
  const oldId = toVerificationResult('old-id', { success: true, old_id_fields: { nom: 'X' } });
  assert.equal(oldId.analysis, 'old_id');
  const payslip = toVerificationResult('payslip', { success: true, extracted_fields: { net: '1' } });
  assert.equal(payslip.analysis, 'payslip');
});

test('generic document exposes the classification', () => {
  const r = toVerificationResult('generic', { success: true, document_type: 'Facture', confidence: 'haute', document_summary: 's', extracted_text: 't', structured_fields: { a: 1 } });
  assert.equal(r.verdict, 'unverifiable');
  assert.equal(r.generic.documentType, 'Facture');
  const described = describeChecks(r, 'en');
  assert.match(described[0].detail, /Facture/);
});

test('API failure payload becomes an error verdict', () => {
  const r = toVerificationResult('tax', { success: false, error: 'No file selected' });
  assert.equal(r.verdict, 'error');
  assert.equal(r.error, 'No file selected');
  assert.deepEqual(r.checks, []);
});

test('verdict rule table', () => {
  assert.equal(buildVerdict({ signature: 'valid', content: 'match' }).verdict, 'authentic');
  assert.equal(buildVerdict({ signature: 'valid', content: 'mismatch' }).verdict, 'not_authentic');
  assert.equal(buildVerdict({ signature: 'invalid', content: 'match' }).verdict, 'not_authentic');
  assert.equal(buildVerdict({ signature: 'unavailable', content: 'match' }).verdict, 'unverifiable');
  assert.equal(buildVerdict({ signature: 'absent', content: 'no_signed_data' }).verdict, 'unverifiable');
  assert.equal(buildVerdict({ signature: 'not_applicable', content: 'not_applicable' }).verdict, 'unverifiable');
});

test('summaries exist in both languages and keep the three controls apart', () => {
  const r = toVerificationResult('tax', taxOk);
  const en = summariseVerification(r, 'en');
  const fr = summariseVerification(r, 'fr');
  assert.match(en, /Authenticity verified/);
  assert.match(en, /2D-Doc signature: Valid/);
  assert.match(en, /Latest notice known to the DGFiP: Yes/);
  assert.match(fr, /Authenticité vérifiée/);
  assert.match(fr, /Dernier avis connu de la DGFiP : Oui|Dernier avis connu de la DGFiP: Oui/);
  assert.doesNotMatch(en, /tmd_live_/);
});

test('tenant file normalisation', () => {
  const r = toTenantFileResult({
    success: true,
    version: '1.0',
    scope: 'salaried',
    documents: [{ name: 'avis.pdf', kind: 'tax', kind_label: 'Avis', verdict: 'authentic', verdict_label: 'Authentique', notes: [], extracted: {} }],
    checks: [{ id: 'income', label: 'Revenus', status: 'coherent', detail: 'ok', gap_percent: 4 }],
    rental_capacity: { label: '1 200 €' },
    reserves: ['r'],
    quota: { per_day: 100, used_today: 3, service_per_day: 300, service_used_today: 10 },
    disclaimer: 'd',
  });
  assert.equal(r.success, true);
  assert.equal(r.documents[0].verdict, 'authentic');
  assert.equal(r.checks[0].gapPercent, 4);
  assert.equal(r.quota.usedToday, 3);
  assert.equal(r.rentalCapacity.label, '1 200 €');
  const failed = toTenantFileResult({ success: false, error: 'no_document', message: 'none' });
  assert.equal(failed.success, false);
  assert.equal(failed.error, 'none');
});

test('key info normalisation', () => {
  const info = toKeyInfo({ email: 'a***@x.fr', plan: 'free', quota_per_day: 100, used_today: 1, service_quota_per_day: 300, service_used_today: 2, usage_total: 9, created_at: '2026-10-08' });
  assert.equal(info.quotaPerDay, 100);
  assert.equal(info.usageTotal, 9);
});
