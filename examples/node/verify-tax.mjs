#!/usr/bin/env node
// Verify a tax notice and act on the verdict.
//   TRUSTMYDOCS_API_KEY=tmd_live_... node examples/node/verify-tax.mjs ./avis.pdf
import { TrustMyDocsClient, ApiError, summariseVerification } from 'trustmydocs';

const [file] = process.argv.slice(2);
if (!file) {
  console.error('usage: verify-tax.mjs <avis.pdf>');
  process.exit(1);
}

const client = new TrustMyDocsClient({ apiKey: process.env.TRUSTMYDOCS_API_KEY });

try {
  const result = await client.verify('tax', file);
  console.log(summariseVerification(result, 'en', { fields: false }));

  // Three separate facts, one decision that is yours to make:
  const signed = result.signature === 'valid';
  const consistent = result.content !== 'mismatch';
  const current = result.latest === 'yes';
  console.log({ verdict: result.verdict, signed, consistent, current, year: result.signedFields.anneeDesRevenus });

  process.exitCode = result.verdict === 'authentic' ? 0 : result.verdict === 'not_authentic' ? 2 : 3;
} catch (error) {
  if (error instanceof ApiError && error.code === 'quota_reached') {
    console.error(`Quota reached, retry in ${error.retryAfterSeconds} s`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
}
