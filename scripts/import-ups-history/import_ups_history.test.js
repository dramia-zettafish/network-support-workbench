const assert = require('node:assert/strict');
const test = require('node:test');

const {
  analyzeRows,
  getImportIdentity,
  parseCsv,
  planImportRows,
  resolveMode
} = require('./import_ups_history');

function csv(rows) {
  return [
    'Footprints,Defective UPS,Defective BP,TEA#,School Name,RM#,IDF,Install Scheduled,Asset Tag#,Replacement UPS SN#,PO#,SNMPWEBCARD SERIAL,SNMP MAC,IP Address,SNMP NAME,New BP SN,BP Asset Tag#,BP PO#,_original_excel_row',
    ...rows
  ].join('\n');
}

test('dry-run is the default and execute/commit both enable writes', () => {
  assert.equal(resolveMode(['node', 'import_ups_history.js']), 'dry-run');
  assert.equal(resolveMode(['node', 'import_ups_history.js', '--dry-run']), 'dry-run');
  assert.equal(resolveMode(['node', 'import_ups_history.js', '--execute']), 'execute');
  assert.equal(resolveMode(['node', 'import_ups_history.js', '--commit']), 'execute');
});

test('same Footprints ticket can produce distinct UPS import rows', () => {
  const rows = parseCsv(csv([
    '900001,,,101,Alpha ES,,IDF-A,2026-01-05,,UPS-A,,,,10.0.0.1,alpha-a,,,,10',
    '900001,,,101,Alpha ES,,IDF-B,2026-01-05,,UPS-B,,,,10.0.0.2,alpha-b,,,,11'
  ]));

  const analysis = analyzeRows(rows);

  assert.equal(analysis.validRows.length, 2);
  assert.equal(analysis.skippedRows.length, 0);
  assert.deepEqual(analysis.duplicateExternalTicketNumbers, ['900001']);
  assert.equal(analysis.validRows[0].import_identity.key, 'external+serial:900001|ups-a');
  assert.equal(analysis.validRows[1].import_identity.key, 'external+serial:900001|ups-b');
});

test('exact duplicate import identities are skipped before insert planning', () => {
  const rows = parseCsv(csv([
    '900002,,,102,Beta MS,,IDF-C,2026-02-06,,UPS-C,,,,10.0.0.3,beta-c,,,,20',
    '900002,,,102,Beta MS,,IDF-C,2026-02-06,,UPS-C,,,,10.0.0.3,beta-c,,,,21'
  ]));

  const analysis = analyzeRows(rows);
  const plan = planImportRows(analysis.validRows, []);

  assert.equal(analysis.validRows.length, 1);
  assert.equal(analysis.skippedRows.length, 1);
  assert.equal(analysis.duplicateImportIdentity, 1);
  assert.match(analysis.skippedRows[0].reason, /duplicate import identity/);
  assert.equal(plan.summary.insert, 1);
  assert.equal(plan.summary.update, 0);
});

test('existing matched UPS rows are planned as updates, not inserts', () => {
  const rows = parseCsv(csv([
    '900003,,,103,Gamma HS,,IDF-D,2026-03-07,,UPS-D,,,,10.0.0.4,gamma-d,,,,30'
  ]));
  const analysis = analyzeRows(rows);
  const existingRow = {
    ups_installation_id: 42,
    external_ticket_number: '900003',
    school_name: 'Gamma HS',
    idf: 'IDF-D',
    proposed_install_date: '2026-03-07',
    new_serial_number: 'UPS-D',
    snmp_ip: '10.0.0.4'
  };
  const plan = planImportRows(analysis.validRows, [existingRow]);

  assert.equal(getImportIdentity(existingRow).key, analysis.validRows[0].import_identity.key);
  assert.equal(plan.summary.insert, 0);
  assert.equal(plan.summary.update, 1);
  assert.equal(plan.actions[0].action, 'update');
  assert.equal(plan.actions[0].existing.ups_installation_id, 42);
});

test('existing rows are matched by fallback identities when primary fields differ', () => {
  const rows = parseCsv(csv([
    ',,,104,Delta ES,,IDF-E,2026-04-08,,UPS-E,,,,10.0.0.5,delta-e,,,,40'
  ]));
  const analysis = analyzeRows(rows);
  const existingRow = {
    ups_installation_id: 43,
    external_ticket_number: '900004',
    school_name: 'Delta ES',
    idf: 'IDF-E',
    proposed_install_date: '2026-04-08',
    new_serial_number: 'UPS-E',
    snmp_ip: '10.0.0.5'
  };
  const plan = planImportRows(analysis.validRows, [existingRow]);

  assert.equal(analysis.validRows[0].import_identity.key, 'serial:ups-e');
  assert.equal(plan.summary.insert, 0);
  assert.equal(plan.summary.update, 1);
  assert.equal(plan.actions[0].existing.ups_installation_id, 43);
});
