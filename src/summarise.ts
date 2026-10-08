/**
 * Renders a normalised result as a few lines a person or a model can act on.
 */

import type { TenantFileResult, VerificationResult, Check, KeyInfo } from './result.js';
import {
  type Lang,
  type AnalysisOutcome,
  type ContentOutcome,
  type LatestOutcome,
  type SignatureOutcome,
  analysisWording,
  authenticityDetails,
  authenticityValue,
  checkLabels,
  contentWording,
  documentTypeLabels,
  latestWording,
  reminders,
  signatureWording,
  verdictHeadlines,
} from './wording.js';

export interface DescribedCheck {
  key: Check['key'];
  status: Check['status'];
  label: string;
  value: string;
  detail: string;
}

/** The check grid with wording, as the website displays it. */
export const describeChecks = (result: VerificationResult, lang: Lang): DescribedCheck[] =>
  result.checks.map((check) => {
    const label = checkLabels[lang][check.key];
    switch (check.key) {
      case 'analysis': {
        let detail = analysisWording[lang][check.outcome as AnalysisOutcome];
        if (result.generic && (result.generic.documentType || result.generic.confidence)) {
          detail += lang === 'fr'
            ? ` Type détecté : ${result.generic.documentType || 'non détecté'} (confiance : ${result.generic.confidence || 'non définie'}).`
            : ` Detected type: ${result.generic.documentType || 'not detected'} (confidence: ${result.generic.confidence || 'undefined'}).`;
        }
        return { key: check.key, status: check.status, label, value: lang === 'fr' ? 'Terminée' : 'Done', detail };
      }
      case 'signature': {
        const w = signatureWording[lang][check.outcome as SignatureOutcome];
        return { key: check.key, status: check.status, label, value: w.value, detail: w.detail };
      }
      case 'content': {
        const w = contentWording[lang][check.outcome as ContentOutcome];
        return { key: check.key, status: check.status, label, value: w.value, detail: w.detail };
      }
      case 'latest': {
        const w = latestWording[lang][check.outcome as LatestOutcome];
        return { key: check.key, status: check.status, label, value: w.value, detail: w.detail };
      }
      case 'authenticity':
        return {
          key: check.key,
          status: check.status,
          label,
          value: authenticityValue[lang][result.verdict],
          detail: authenticityDetails[lang][result.authenticityDetail],
        };
    }
  });

const STATUS_MARK: Record<Check['status'], string> = { ok: 'OK ', ko: 'KO ', unknown: '?  ', na: '-  ', done: '.  ' };

export const summariseVerification = (result: VerificationResult, lang: Lang = 'en', options: { fields?: boolean } = {}): string => {
  const lines: string[] = [];
  const typeLabel = documentTypeLabels[lang][result.type] ?? result.type;
  if (result.verdict === 'error') {
    lines.push(`${verdictHeadlines[lang].error} (${typeLabel}): ${result.error ?? ''}`.trim());
    return lines.join('\n');
  }
  lines.push(`${verdictHeadlines[lang][result.verdict]} (${typeLabel})`);
  for (const check of describeChecks(result, lang)) {
    lines.push(`  ${STATUS_MARK[check.status]} ${check.label}: ${check.value}. ${check.detail}`);
  }
  const signed = Object.keys(result.signedFields).length;
  const extracted = Object.keys(result.extractedFields).length;
  if (signed) lines.push(lang === 'fr' ? `Champs signés : ${signed}` : `Signed fields: ${signed}`);
  if (extracted) lines.push(lang === 'fr' ? `Champs lus optiquement : ${extracted}` : `Optically read fields: ${extracted}`);
  if (options.fields) {
    if (signed) {
      lines.push(lang === 'fr' ? 'Données signées (2D-Doc) :' : 'Signed data (2D-Doc):');
      for (const [key, value] of Object.entries(result.signedFields)) lines.push(`  ${key}: ${String(value)}`);
    }
    if (extracted) {
      lines.push(lang === 'fr' ? 'Données lues optiquement :' : 'Optically read data:');
      for (const [key, value] of Object.entries(result.extractedFields)) {
        lines.push(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
      }
    }
    if (result.generic?.summary) lines.push((lang === 'fr' ? 'Résumé : ' : 'Summary: ') + result.generic.summary);
  }
  lines.push(reminders[lang].verification);
  return lines.join('\n');
};

export const summariseTenantFile = (result: TenantFileResult, lang: Lang = 'en'): string => {
  if (!result.success) {
    return `${lang === 'fr' ? 'Échec' : 'Failed'}: ${result.error ?? ''}`.trim();
  }
  const lines: string[] = [];
  lines.push(lang === 'fr' ? `${result.documents.length} document(s) analysé(s).` : `${result.documents.length} document(s) analysed.`);
  for (const doc of result.documents) {
    lines.push(`  · ${doc.name} (${doc.kindLabel}): ${doc.verdictLabel || doc.verdict}`);
    for (const note of doc.notes) lines.push(`      ${note}`);
  }
  for (const check of result.checks) {
    const gap = check.gapPercent !== undefined ? ` (${check.gapPercent} %)` : '';
    lines.push(`  ${check.status}: ${check.label}${gap}. ${check.detail}`.trimEnd());
  }
  if (result.rentalCapacity?.label) {
    lines.push((lang === 'fr' ? 'Capacité locative : ' : 'Rental capacity: ') + String(result.rentalCapacity.label));
  }
  if (result.reserves.length) {
    lines.push(lang === 'fr' ? 'Réserves :' : 'Reserves:');
    for (const reserve of result.reserves) lines.push(`  · ${reserve}`);
  }
  if (result.quota) {
    lines.push(
      lang === 'fr'
        ? `Quota : ${result.quota.usedToday}/${result.quota.perDay} aujourd’hui pour cette clé.`
        : `Quota: ${result.quota.usedToday}/${result.quota.perDay} used today for this key.`,
    );
  }
  lines.push(reminders[lang].tenantFile);
  return lines.join('\n');
};

export const summariseKeyInfo = (info: KeyInfo, lang: Lang = 'en'): string =>
  lang === 'fr'
    ? `Clé ${info.email} (plan ${info.plan}) : ${info.usedToday}/${info.quotaPerDay} vérifications aujourd’hui, ${info.usageTotal} au total. Plafond partagé du service : ${info.serviceUsedToday}/${info.serviceQuotaPerDay}.`
    : `Key ${info.email} (plan ${info.plan}): ${info.usedToday}/${info.quotaPerDay} verifications today, ${info.usageTotal} in total. Shared service ceiling: ${info.serviceUsedToday}/${info.serviceQuotaPerDay}.`;
