/**
 * Human wording of a verification, in English and French.
 *
 * The result itself is language neutral (see result.ts); this module turns
 * it into labels and sentences. The three controls the service distinguishes
 * (signature, printed-versus-signed content, latest notice) are kept apart on
 * purpose: a valid signature proves the origin and integrity of the code, not
 * that the document is genuine, current, or carried by its holder.
 */

export type Lang = 'en' | 'fr';

export type Verdict = 'authentic' | 'not_authentic' | 'unverifiable' | 'error';
export type CheckKey = 'analysis' | 'signature' | 'content' | 'latest' | 'authenticity';
export type CheckStatus = 'ok' | 'ko' | 'na' | 'unknown' | 'done';

export type SignatureOutcome = 'valid' | 'invalid' | 'absent' | 'unavailable' | 'not_applicable';
export type ContentOutcome = 'match' | 'mismatch' | 'not_comparable' | 'no_signed_data' | 'not_applicable' | 'code_only';
export type LatestOutcome = 'yes' | 'no' | 'unavailable' | 'no_code';
export type AnalysisOutcome = 'code_and_ocr' | 'ocr_no_code' | 'passport' | 'old_id' | 'payslip' | 'code_only' | 'generic';

type Wording = { value: string; detail: string };
type Table<K extends string> = Record<Lang, Record<K, Wording>>;

export const checkLabels: Record<Lang, Record<CheckKey, string>> = {
  en: {
    analysis: 'Analysis',
    signature: '2D-Doc signature',
    content: 'Printed data vs signed data',
    latest: 'Latest notice known to the DGFiP',
    authenticity: 'Authenticity',
  },
  fr: {
    analysis: 'Analyse',
    signature: 'Signature 2D-Doc',
    content: 'Concordance des données visibles avec les données signées',
    latest: 'Dernier avis connu de la DGFiP',
    authenticity: 'Authenticité',
  },
};

export const verdictHeadlines: Record<Lang, Record<Verdict, string>> = {
  en: {
    authentic: 'Authenticity verified',
    not_authentic: 'Authenticity in doubt',
    unverifiable: 'Authenticity not verifiable',
    error: 'Verification failed',
  },
  fr: {
    authentic: 'Authenticité vérifiée',
    not_authentic: 'Authenticité mise en doute',
    unverifiable: 'Authenticité non vérifiable',
    error: 'Échec de la vérification',
  },
};

export const signatureStatus: Record<SignatureOutcome, CheckStatus> = {
  valid: 'ok',
  invalid: 'ko',
  absent: 'unknown',
  unavailable: 'unknown',
  not_applicable: 'na',
};

export const contentStatus: Record<ContentOutcome, CheckStatus> = {
  match: 'ok',
  mismatch: 'ko',
  not_comparable: 'unknown',
  no_signed_data: 'unknown',
  not_applicable: 'na',
  code_only: 'na',
};

export const latestStatus: Record<LatestOutcome, CheckStatus> = {
  yes: 'ok',
  no: 'ko',
  unavailable: 'unknown',
  no_code: 'unknown',
};

export const verdictStatus: Record<Verdict, CheckStatus> = {
  authentic: 'ok',
  not_authentic: 'ko',
  unverifiable: 'unknown',
  error: 'ko',
};

export const signatureWording: Table<SignatureOutcome> = {
  en: {
    valid: { value: 'Valid', detail: 'Signature verified against the certificate authority: the signed data does come from the issuer.' },
    invalid: { value: 'Invalid', detail: 'The signature does not match the issuer certificate: the code may have been altered or fabricated.' },
    absent: { value: 'Absent', detail: 'No usable 2D-Doc code: optical reading only, no cryptographic proof.' },
    unavailable: { value: 'Not verifiable', detail: 'The issuer certificate could not be fetched: the signature was not checked. Try again later.' },
    not_applicable: { value: 'Not applicable', detail: 'This type of document carries no 2D-Doc code.' },
  },
  fr: {
    valid: { value: 'Valide', detail: 'Signature vérifiée auprès de l’autorité de certification : les données signées proviennent bien de l’émetteur.' },
    invalid: { value: 'Invalide', detail: 'La signature ne correspond pas au certificat de l’émetteur : le code a pu être altéré ou fabriqué.' },
    absent: { value: 'Absente', detail: 'Aucun code 2D-Doc exploitable : lecture optique seule, pas de preuve cryptographique.' },
    unavailable: { value: 'Non vérifiable', detail: 'Le certificat de l’émetteur n’a pas pu être consulté : la signature n’a pas été contrôlée. Réessayez plus tard.' },
    not_applicable: { value: 'Sans objet', detail: 'Ce type de document ne comporte pas de code 2D-Doc.' },
  },
};

export const contentWording: Table<ContentOutcome> = {
  en: {
    match: { value: 'Yes', detail: 'The printed data matches the signed data.' },
    mismatch: { value: 'No', detail: 'The printed data differs from the signed data: review it.' },
    not_comparable: { value: 'Not verifiable', detail: 'No field could be compared between the 2D-Doc code and the optical reading.' },
    no_signed_data: { value: 'Not verifiable', detail: 'No signed data to compare against.' },
    not_applicable: { value: 'Not applicable', detail: 'No signed data on this type of document.' },
    code_only: { value: 'Not applicable', detail: 'Code read alone, without optical reading of the document.' },
  },
  fr: {
    match: { value: 'Oui', detail: 'Les données imprimées correspondent aux données signées.' },
    mismatch: { value: 'Non', detail: 'Les données imprimées diffèrent des données signées : à contrôler.' },
    not_comparable: { value: 'Non vérifiable', detail: 'Aucun champ comparable entre le code 2D-Doc et la lecture optique.' },
    no_signed_data: { value: 'Non vérifiable', detail: 'Pas de données signées à comparer.' },
    not_applicable: { value: 'Sans objet', detail: 'Aucune donnée signée sur ce type de document.' },
    code_only: { value: 'Sans objet', detail: 'Lecture du code seul, sans lecture optique du document.' },
  },
};

export const latestWording: Table<LatestOutcome> = {
  en: {
    yes: { value: 'Yes', detail: 'Confirmed by the DGFiP as the latest known notice.' },
    no: { value: 'No', detail: 'Not the latest notice known to the DGFiP: ask for an up-to-date notice.' },
    unavailable: { value: 'Not verifiable', detail: 'The DGFiP service did not answer.' },
    no_code: { value: 'Not verifiable', detail: 'Impossible to check without a readable 2D-Doc code.' },
  },
  fr: {
    yes: { value: 'Oui', detail: 'Confirmé par la DGFiP comme le dernier avis connu.' },
    no: { value: 'Non', detail: 'Ce n’est pas le dernier avis connu de la DGFiP : demandez un avis à jour.' },
    unavailable: { value: 'Non vérifiable', detail: 'Le service de la DGFiP n’a pas répondu.' },
    no_code: { value: 'Non vérifiable', detail: 'Contrôle impossible sans code 2D-Doc lisible.' },
  },
};

export const authenticityValue: Record<Lang, Record<Verdict, string>> = {
  en: { authentic: 'Verified', not_authentic: 'In doubt', unverifiable: 'Not verifiable', error: 'Failed' },
  fr: { authentic: 'Vérifiée', not_authentic: 'Mise en doute', unverifiable: 'Non vérifiable', error: 'Échec' },
};

export type AuthenticityDetail =
  | 'signed_and_matching'
  | 'signed_content_unknown'
  | 'signed_only'
  | 'invalid_signature'
  | 'content_mismatch'
  | 'unverifiable';

export const authenticityDetails: Record<Lang, Record<AuthenticityDetail, string>> = {
  en: {
    signed_and_matching: 'Valid 2D-Doc signature and printed data consistent with the signed data.',
    signed_content_unknown: 'Valid 2D-Doc signature; the content comparison could not be performed.',
    signed_only: 'Valid 2D-Doc signature.',
    invalid_signature: 'The 2D-Doc signature is invalid.',
    content_mismatch: 'The printed data differs from the signed data.',
    unverifiable: 'No cryptographic proof: the authenticity of this document could not be established.',
  },
  fr: {
    signed_and_matching: 'Signature 2D-Doc valide et données visibles conformes aux données signées.',
    signed_content_unknown: 'Signature 2D-Doc valide ; la concordance du contenu n’a pas pu être contrôlée.',
    signed_only: 'Signature 2D-Doc valide.',
    invalid_signature: 'La signature 2D-Doc est invalide.',
    content_mismatch: 'Les données visibles diffèrent des données signées.',
    unverifiable: 'Aucune preuve cryptographique : l’authenticité de ce document n’a pas pu être établie.',
  },
};

export const analysisWording: Record<Lang, Record<AnalysisOutcome, string>> = {
  en: {
    code_and_ocr: '2D-Doc code read and optical reading performed.',
    ocr_no_code: 'Optical reading performed, no 2D-Doc code read.',
    passport: 'Optical reading of the passport performed.',
    old_id: 'Optical reading of the identity card performed.',
    payslip: 'Optical reading of the payslip performed.',
    code_only: '2D-Doc code read and signed fields extracted.',
    generic: 'Optical reading performed.',
  },
  fr: {
    code_and_ocr: 'Code 2D-Doc lu et lecture optique effectuée.',
    ocr_no_code: 'Lecture optique effectuée, aucun code 2D-Doc lu.',
    passport: 'Lecture optique du passeport effectuée.',
    old_id: 'Lecture optique de la carte d’identité effectuée.',
    payslip: 'Lecture optique de la fiche de paie effectuée.',
    code_only: 'Code 2D-Doc lu et champs signés extraits.',
    generic: 'Lecture optique effectuée.',
  },
};

export const reminders: Record<Lang, { verification: string; tenantFile: string }> = {
  en: {
    verification:
      'Reminder: a valid signature proves the origin and integrity of the code, not that the document is the most recent, nor that its bearer is its holder. Only the signature check is cryptographic; extraction and comparison come from probabilistic models.',
    tenantFile:
      'Reminder: this report is a decision aid, not a proof. A flagged gap calls for an explanation, not an automatic conclusion.',
  },
  fr: {
    verification:
      'Rappel : une signature valide prouve l’origine et l’intégrité du code, pas que le document soit le plus récent, ni que son porteur en soit le titulaire. Seule la vérification de signature est cryptographique ; extraction et comparaison proviennent de modèles probabilistes.',
    tenantFile:
      'Rappel : ce rapport est une aide à la décision, pas une preuve. Un écart signalé appelle une explication, pas une conclusion automatique.',
  },
};

export const documentTypeLabels: Record<Lang, Record<string, string>> = {
  en: {
    tax: 'tax notice',
    '2ddoc': '2D-Doc code',
    id: 'identity card (new format)',
    'old-id': 'identity card (old format)',
    passport: 'passport',
    payslip: 'payslip',
    generic: 'document',
  },
  fr: {
    tax: 'avis d’imposition',
    '2ddoc': 'code 2D-Doc',
    id: 'carte d’identité (nouveau format)',
    'old-id': 'carte d’identité (ancien format)',
    passport: 'passeport',
    payslip: 'bulletin de paie',
    generic: 'document',
  },
};

/** Picks the language from an explicit value, then the environment, then English. */
export const resolveLang = (explicit?: string, env: NodeJS.ProcessEnv = process.env): Lang => {
  const candidate = (explicit ?? env.TRUSTMYDOCS_LANG ?? env.LC_ALL ?? env.LC_MESSAGES ?? env.LANG ?? '').toLowerCase();
  return candidate.startsWith('fr') ? 'fr' : 'en';
};
