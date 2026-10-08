#!/usr/bin/env node
// Analyse a rental application: one tax notice, payslips, both sides of the ID card.
//   TRUSTMYDOCS_API_KEY=... node examples/node/tenant-file.mjs avis.pdf recto.jpg verso.jpg paie1.pdf paie2.pdf paie3.pdf
import { TrustMyDocsClient, summariseTenantFile } from 'trustmydocs';

const [tax, idFront, idBack, ...payslip] = process.argv.slice(2);
if (!tax || !idFront || !idBack || payslip.length === 0) {
  console.error('usage: tenant-file.mjs <avis.pdf> <cni-recto> <cni-verso> <payslip.pdf>...');
  process.exit(1);
}

const client = new TrustMyDocsClient({ apiKey: process.env.TRUSTMYDOCS_API_KEY });
const report = await client.tenantFile({ tax: [tax], idFront, idBack, payslip });

console.log(summariseTenantFile(report, 'en'));

const allAuthentic = report.documents.every((d) => d.verdict === 'authentic' || d.verdict === 'out_of_scope');
const coherent = report.checks.every((c) => c.status === 'coherent');
console.log({ allAuthentic, coherent, capacity: report.rentalCapacity?.label, quotaUsedToday: report.quota?.usedToday });
