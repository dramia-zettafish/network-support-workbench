#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const {
  analyzeRows,
  findExistingMatches,
  parseCsv,
  planImportRows
} = require('./import_ups_history');

function requirePg() {
  try {
    return require('pg');
  } catch (error) {
    const frontendRequire = createRequire(path.resolve(__dirname, '../../frontend/package.json'));
    return frontendRequire('pg');
  }
}

const repoRoot = path.resolve(__dirname, '../..');
const defaultCsvPath = path.join(repoRoot, 'UPS Installation Tracker - Data.csv');

const backfillFields = [
  'external_ticket_number',
  'school_name',
  'tea_code',
  'created_date',
  'serial_number',
  'defective_battery_pack_serial',
  'idf',
  'new_serial_number',
  'new_webcard_serial',
  'new_asset_tag',
  'new_mac_address',
  'hostname',
  'new_battery_pack_asset_tag',
  'new_battery_pack_serial',
  'room_number',
  'installed_date',
  'snmp_ip',
  'ups_po',
  'bp_po',
  'proposed_install_date',
  'install_contact',
  'install_contact_number'
];

const fieldMaxLengths = {
  external_ticket_number: 8,
  serial_number: 100,
  defective_battery_pack_serial: 100,
  idf: 100,
  new_serial_number: 100,
  new_webcard_serial: 100,
  new_asset_tag: 100,
  new_mac_address: 32,
  hostname: 100,
  new_battery_pack_asset_tag: 100,
  new_battery_pack_serial: 100,
  room_number: 50,
  snmp_ip: 100,
  ups_po: 100,
  bp_po: 100,
  install_contact: 255,
  install_contact_number: 20
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`Backfill failed: ${error.message}`);
    process.exitCode = 1;
  });
}

async function main() {
  const mode = process.argv.includes('--execute') || process.argv.includes('--commit') ? 'execute' : 'dry-run';
  const csvPath = getArgValue('--file') || defaultCsvPath;
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    'postgresql://user:password@localhost:5432/tickets';

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const analysis = analyzeRows(rows);
  const sourceRowsByCsvRow = rowsByCsvRow(rows);
  for (const row of analysis.validRows) {
    row.install_contact = cleanText(sourceRowsByCsvRow.get(row.source_row)?.['Install Contact']);
    row.install_contact_number = cleanText(sourceRowsByCsvRow.get(row.source_row)?.['Install Contact Number']);
  }

  const { Pool } = requirePg();
  const pool = new Pool({ connectionString });

  try {
    const existingRows = await findExistingMatches(pool, analysis.validRows, mode);
    const importPlan = planImportRows(analysis.validRows, existingRows);
    const backfillPlan = buildBackfillPlan(importPlan.actions);

    printSummary({
      mode,
      csvPath,
      totalRows: rows.length,
      analysis,
      importPlan,
      backfillPlan
    });

    if (mode === 'execute') {
      await applyBackfill(pool, backfillPlan);
    }
  } finally {
    await pool.end();
  }
}

function rowsByCsvRow(rows) {
  return new Map(rows.map((row) => [row.__csv_row_number, row]));
}

function buildBackfillPlan(actions) {
  const rowsById = new Map();
  const conflicts = [];
  const skippedValues = [];

  actions
    .filter((action) => action.action === 'update' && action.existing)
    .forEach((action) => {
      const fields = backfillFields.filter((field) => isMissing(action.existing[field]) && !isMissing(action.row[field]));
      if (fields.length === 0) return;

      const id = action.existing.ups_installation_id;
      const current = rowsById.get(id) || {
        ups_installation_id: id,
        external_ticket_number: action.row.external_ticket_number,
        school_name: action.row.school_name,
        fields: {}
      };

      for (const field of fields) {
        const nextValue = action.row[field];
        const maxLength = fieldMaxLengths[field];
        if (maxLength && String(nextValue).length > maxLength) {
          skippedValues.push({
            ups_installation_id: id,
            field,
            value: nextValue,
            reason: `exceeds ${maxLength} characters`
          });
          continue;
        }

        if (!Object.prototype.hasOwnProperty.call(current.fields, field)) {
          current.fields[field] = nextValue;
          continue;
        }

        if (String(current.fields[field]) !== String(nextValue)) {
          conflicts.push({
            ups_installation_id: id,
            field,
            kept: current.fields[field],
            skipped: nextValue
          });
        }
      }

      rowsById.set(id, current);
    });

  return {
    rows: Array.from(rowsById.values()).filter((row) => Object.keys(row.fields).length > 0),
    conflicts,
    skippedValues
  };
}

function isMissing(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function cleanText(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (/^(n\/a|na|none|null)$/i.test(trimmed)) return null;
  return trimmed;
}

function printSummary({ mode, csvPath, totalRows, analysis, importPlan, backfillPlan }) {
  const fieldCounts = {};
  for (const row of backfillPlan.rows) {
    for (const field of Object.keys(row.fields)) {
      fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    }
  }

  console.log(`Historical UPS missing-field backfill (${mode})`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Total rows read: ${totalRows}`);
  console.log(`Rows valid after CSV validation: ${analysis.validRows.length}`);
  console.log(`Existing DB matches: ${importPlan.existingMatchCount}`);
  console.log(`Nonmatching CSV rows ignored: ${importPlan.actions.filter((action) => action.action === 'insert').length}`);
  console.log(`Matched rows needing at least one field backfilled: ${backfillPlan.rows.length}`);
  console.log(`Conflicting duplicate field values skipped: ${backfillPlan.conflicts.length}`);
  console.log(`Overlong field values skipped: ${backfillPlan.skippedValues.length}`);
  console.log(`Rows skipped by CSV validation: ${analysis.skippedRows.length}`);

  console.log('\nFields to backfill:');
  Object.entries(fieldCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([field, count]) => {
      console.log(`- ${field}: ${count}`);
    });

  console.log('\nPreview:');
  backfillPlan.rows.slice(0, 10).forEach((row) => {
    console.log(JSON.stringify(row));
  });

  if (backfillPlan.conflicts.length) {
    console.log('\nConflict preview:');
    backfillPlan.conflicts.slice(0, 10).forEach((conflict) => {
      console.log(JSON.stringify(conflict));
    });
  }

  if (backfillPlan.skippedValues.length) {
    console.log('\nOverlong value preview:');
    backfillPlan.skippedValues.slice(0, 10).forEach((skippedValue) => {
      console.log(JSON.stringify(skippedValue));
    });
  }
}

async function applyBackfill(pool, backfillPlan) {
  const client = await pool.connect();
  let updatedRows = 0;

  try {
    await client.query('BEGIN');

    for (const row of backfillPlan.rows) {
      const fields = Object.keys(row.fields);
      const values = Object.values(row.fields);
      const assignments = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
      await client.query(
        `UPDATE ups_installations SET ${assignments} WHERE ups_installation_id = $${fields.length + 1}`,
        [...values, row.ups_installation_id]
      );
      updatedRows += 1;
    }

    await client.query('COMMIT');
    console.log(`\nUpdated rows: ${updatedRows}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}
