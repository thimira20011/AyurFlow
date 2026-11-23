import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { connection, fingerprint, query } from './common.mjs';

export function verificationSQL(expected) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const field of ['patientId', 'batchId', 'invoiceId']) {
    if (typeof expected[field] !== 'string' || !uuid.test(expected[field]) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(expected[field])) {
      throw new Error('Three nonzero synthetic record UUIDs are required.');
    }
  }
  if (typeof expected.batchGrams !== 'string' || !/^\d{1,9}\.\d{3}$/.test(expected.batchGrams) ||
      !/[1-9]/.test(expected.batchGrams) || !Number.isSafeInteger(expected.invoiceTotalMinor) || expected.invoiceTotalMinor <= 0) {
    throw new Error('Supply positive fixed-precision batch grams and safe integer invoice minor units.');
  }
  return `SELECT json_build_object(
    'patient', EXISTS(SELECT 1 FROM patients WHERE id='${expected.patientId}'),
    'batch', EXISTS(SELECT 1 FROM stock_batches b JOIN botanical_items i ON i.id=b.item_id
      WHERE b.id='${expected.batchId}' AND b.received_grams=${expected.batchGrams} AND b.remaining_grams=${expected.batchGrams}),
    'invoice', EXISTS(SELECT 1 FROM invoices WHERE id='${expected.invoiceId}' AND patient_id='${expected.patientId}'
      AND status='issued' AND total_minor_units=${expected.invoiceTotalMinor}),
    'patientAudit', EXISTS(SELECT 1 FROM audit_events a JOIN patients p ON a.object_id=p.id::text
      JOIN staff_accounts s ON s.id=a.actor_id WHERE p.id='${expected.patientId}' AND a.actor_id=p.created_by AND a.action='patient.created'),
    'batchAudit', EXISTS(SELECT 1 FROM audit_events a JOIN stock_batches b ON a.object_id=b.id::text
      JOIN staff_accounts s ON s.id=a.actor_id WHERE b.id='${expected.batchId}' AND a.actor_id=b.received_by AND a.action='stock_batch.received'),
    'invoiceAudit', EXISTS(SELECT 1 FROM audit_events a JOIN invoices i ON a.object_id=i.id::text
      JOIN staff_accounts s ON s.id=a.actor_id WHERE i.id='${expected.invoiceId}' AND a.actor_id=i.issued_by AND a.action='invoice.issued'))`;
}

async function main() {
  const target = connection(process.env.RESTORE_DATABASE_URL);
  const database = decodeURIComponent(target.pathname.slice(1));
  if (!/^ayurflow_restore_[a-z0-9_]+$/.test(database) || process.env.RESTORE_CONFIRM_DATABASE !== database) {
    throw new Error('Use an explicitly confirmed isolated recovery database.');
  }
  const expected = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const sql = verificationSQL(expected);
  const restore = JSON.parse(await readFile(process.argv[3], 'utf8'));
  if (restore.target !== fingerprint(target) || !restore.allCategoriesPopulated) {
    throw new Error('Restore evidence must match this target and contain all four nonempty categories.');
  }
  const checks = JSON.parse(await query(target.href, sql));
  const passed = Object.values(checks).every(value => value === true);
  await writeFile(process.argv[4], JSON.stringify({ verifiedAt: new Date().toISOString(), target: restore.target, checks, passed }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  if (!passed) throw new Error('Restored synthetic record or audit relationship mismatch.');
  console.log('PASS: restored patient, batch quantity/item, issued invoice/patient/total and all three audit actor relationships.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Record verification failed; private details omitted.'); process.exitCode = 1; });
}
