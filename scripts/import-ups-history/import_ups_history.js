#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

function requirePg() {
  try {
    return require('pg');
  } catch (error) {
    try {
      const frontendRequire = createRequire(path.resolve(__dirname, '../../frontend/package.json'));
      return frontendRequire('pg');
    } catch (frontendError) {
      return require('/app/node_modules/pg');
    }
  }
}

const { Pool } = requirePg();

const repoRoot = path.resolve(__dirname, '../..');
const defaultCsvPath = path.join(repoRoot, 'ups_clean_import_ready_promoted.csv');
const mode = process.argv.includes('--commit') ? 'commit' : 'dry-run';
const csvPath = getArgValue('--file') || defaultCsvPath;
const importLimit = getIntArgValue('--limit');
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  'postgresql://user:password@localhost:5432/tickets';

const insertSql = `
  INSERT INTO ups_installations (
    ticket_number,
    external_ticket_number,
    school_name,
    tea_code,
    created_date,
    status,
    serial_number,
    defective_battery_pack_serial,
    idf,
    asset_tag,
    new_serial_number,
    new_webcard_serial,
    new_asset_tag,
    mac_address,
    new_mac_address,
    hostname,
    new_battery_pack_asset_tag,
    new_battery_pack_serial,
    model,
    room_number,
    installed_date,
    notes,
    snmp_ip,
    ups_po,
    bp_po,
    proposed_install_date
  ) VALUES (
    NULL,
    $1,
    $2,
    $3,
    $4,
    'fulfilled',
    $5,
    $6,
    $7,
    NULL,
    $8,
    $9,
    $10,
    NULL,
    $11,
    $12,
    $13,
    $14,
    NULL,
    $15,
    $16,
    $17,
    $18,
    $19,
    $20,
    $21
  )
  RETURNING ups_installation_id
`;

main().catch((error) => {
  console.error(`Import failed: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  if (!process.argv.includes('--dry-run') && !process.argv.includes('--commit')) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const analysis = analyzeRows(rows);
  const pool = new Pool({ connectionString });

  try {
    const existingDuplicates = await findExistingDuplicates(pool, analysis.validRows, mode);
    const importableRows = analysis.validRows.filter((row) => !isExistingDuplicate(row, existingDuplicates));
    const rowsToImport = importLimit ? importableRows.slice(0, importLimit) : importableRows;

    printSummary({
      mode,
      csvPath,
      importLimit,
      totalRows: rows.length,
      analysis,
      existingDuplicates,
      importableRows,
      rowsToImport
    });

    if (mode === 'dry-run') return;

    await commitRows(pool, rowsToImport);
  } finally {
    await pool.end();
  }
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function getIntArgValue(name) {
  const value = getArgValue(name);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function printUsage() {
  console.log('Usage: node scripts/import-ups-history/import_ups_history.js --dry-run [--file path/to.csv] [--limit 5]');
  console.log('       node scripts/import-ups-history/import_ups_history.js --commit [--file path/to.csv] [--limit 5]');
}

function parseCsv(input) {
  const normalized = input.replace(/^\uFEFF/, '');
  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== '')) records.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((value) => value.trim() !== '')) records.push(row);
  }

  if (records.length === 0) return [];

  const headers = records[0].map((header, index) => normalizeHeader(header, index));
  return records.slice(1).map((record, rowIndex) => {
    const rowObject = {};
    headers.forEach((header, columnIndex) => {
      rowObject[header] = record[columnIndex] || '';
    });
    rowObject.__csv_row_number = rowIndex + 2;
    return rowObject;
  });
}

function normalizeHeader(header, index) {
  const trimmed = header.trim();
  if (trimmed) return trimmed;
  return index === 0 ? 'Footprints' : `_blank_${index}`;
}

function analyzeRows(rows) {
  const validRows = [];
  const skippedRows = [];
  const warnings = [];
  const duplicateExternalTicketNumbers = new Set();
  const duplicateReplacementUpsSerials = new Set();
  const seenExternalTicketNumbers = new Set();
  const seenReplacementUpsSerials = new Set();
  let missingSchool = 0;
  let invalidInstallDate = 0;

  rows.forEach((row) => {
    const normalized = normalizeRow(row, warnings);

    if (!normalized.school_name) {
      missingSchool += 1;
      skippedRows.push(skip(row, 'missing school name'));
      return;
    }

    if (!normalized.created_date) {
      invalidInstallDate += 1;
      skippedRows.push(skip(row, 'missing or invalid Install Scheduled date'));
      return;
    }

    const externalKey = normalized.external_ticket_number;
    if (externalKey && seenExternalTicketNumbers.has(externalKey)) {
      duplicateExternalTicketNumbers.add(externalKey);
      skippedRows.push(skip(row, `duplicate external ticket number ${externalKey}`));
      return;
    }
    if (externalKey) seenExternalTicketNumbers.add(externalKey);

    const serialKey = normalized.new_serial_number;
    if (serialKey && seenReplacementUpsSerials.has(serialKey)) {
      duplicateReplacementUpsSerials.add(serialKey);
      skippedRows.push(skip(row, `duplicate replacement UPS serial ${serialKey}`));
      return;
    }
    if (serialKey) seenReplacementUpsSerials.add(serialKey);

    validRows.push(normalized);
  });

  return {
    validRows,
    skippedRows,
    warnings,
    missingSchool,
    invalidInstallDate,
    duplicateExternalTicketNumbers: Array.from(duplicateExternalTicketNumbers),
    duplicateReplacementUpsSerials: Array.from(duplicateReplacementUpsSerials)
  };
}

function normalizeRow(row, warnings) {
  const externalTicketNumber = cleanExternalTicketNumber(getFirst(row, ['Footprints', '_blank_0']), row, warnings);
  const installDate = cleanDate(row['Install Scheduled']);

  return {
    external_ticket_number: externalTicketNumber,
    school_name: cleanText(row['School Name']),
    tea_code: cleanTeaCode(row['TEA#'], row, warnings),
    created_date: installDate,
    serial_number: cleanText(row['Defective UPS']),
    defective_battery_pack_serial: cleanText(row['Defective BP']),
    idf: cleanText(row.IDF),
    asset_tag: null,
    new_serial_number: cleanText(row['Replacement UPS SN#']),
    new_webcard_serial: cleanText(row['SNMPWEBCARD SERIAL']),
    new_asset_tag: cleanAssetTag(row['Asset Tag#']),
    mac_address: null,
    new_mac_address: cleanMacAddress(row['SNMP MAC']),
    hostname: cleanText(row['SNMP NAME']),
    new_battery_pack_asset_tag: cleanAssetTag(row['BP Asset Tag#']),
    new_battery_pack_serial: cleanText(row['New BP SN']),
    room_number: cleanText(row['RM#']),
    installed_date: installDate,
    notes: null,
    snmp_ip: cleanText(row['IP Address']),
    ups_po: cleanText(row['PO#']),
    bp_po: cleanText(row['BP PO#']),
    proposed_install_date: installDate,
    source_row: row.__csv_row_number
  };
}

function getFirst(row, fields) {
  for (const field of fields) {
    if (row[field] !== undefined) return row[field];
  }
  return '';
}

function cleanText(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (/^(n\/a|na|none|null)$/i.test(trimmed)) return null;
  return trimmed;
}

function cleanAssetTag(value) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  return cleaned.replace(/\.0$/, '');
}

function cleanExternalTicketNumber(value, row, warnings) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const excelNumberMatch = cleaned.match(/^(\d+)\.0$/);
  const ticketNumber = excelNumberMatch ? excelNumberMatch[1] : cleaned;
  if (ticketNumber.length > 8) {
    warnings.push(warn(row, `external ticket number '${ticketNumber}' exceeds 8 chars and was set to NULL`));
    return null;
  }
  return ticketNumber;
}

function cleanTeaCode(value, row, warnings) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const match = cleaned.match(/^\d{1,3}(?:\.0)?$/);
  if (!match) {
    warnings.push(warn(row, `TEA code '${cleaned}' is invalid and was set to NULL`));
    return null;
  }
  const teaCode = Number.parseInt(cleaned, 10);
  if (teaCode < 0 || teaCode > 999) {
    warnings.push(warn(row, `TEA code '${cleaned}' is outside 0-999 and was set to NULL`));
    return null;
  }
  return teaCode;
}

function cleanDate(value) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const dateOnly = cleaned.split(/\s+/)[0];

  const isoMatch = dateOnly.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return toIsoDate(isoMatch[1], isoMatch[2], isoMatch[3]);

  const slashMatch = dateOnly.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slashMatch) {
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
    return toIsoDate(year, slashMatch[1], slashMatch[2]);
  }

  const parsed = new Date(dateOnly);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toIsoDate(year, month, day) {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function cleanMacAddress(value) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const compact = cleaned.replace(/[^a-fA-F0-9]/g, '');
  if (compact.length === 12) {
    return compact.match(/.{1,2}/g).join(':').toUpperCase();
  }
  return cleaned;
}

function skip(row, reason) {
  return {
    csv_row: row.__csv_row_number,
    original_excel_row: cleanText(row._original_excel_row),
    reason
  };
}

function warn(row, message) {
  return {
    csv_row: row.__csv_row_number,
    original_excel_row: cleanText(row._original_excel_row),
    message
  };
}

async function findExistingDuplicates(pool, rows, currentMode) {
  const externalTicketNumbers = rows.map((row) => row.external_ticket_number).filter(Boolean);
  const replacementSerials = rows.map((row) => row.new_serial_number).filter(Boolean);

  let externalResult = { rows: [] };
  let serialResult = { rows: [] };

  try {
    [externalResult, serialResult] = await Promise.all([
      externalTicketNumbers.length
        ? pool.query(
            'SELECT external_ticket_number FROM ups_installations WHERE external_ticket_number = ANY($1::text[])',
            [externalTicketNumbers]
          )
        : { rows: [] },
      replacementSerials.length
        ? pool.query(
            'SELECT new_serial_number FROM ups_installations WHERE new_serial_number = ANY($1::text[])',
            [replacementSerials]
          )
        : { rows: [] }
    ]);
  } catch (error) {
    if (currentMode === 'commit') throw error;
    console.warn(`Warning: DB duplicate check skipped during dry run: ${error.message}`);
  }

  return {
    externalTicketNumbers: new Set(externalResult.rows.map((row) => row.external_ticket_number)),
    replacementSerials: new Set(serialResult.rows.map((row) => row.new_serial_number))
  };
}

function isExistingDuplicate(row, duplicates) {
  return (
    (row.external_ticket_number && duplicates.externalTicketNumbers.has(row.external_ticket_number)) ||
    (row.new_serial_number && duplicates.replacementSerials.has(row.new_serial_number))
  );
}

function printSummary({ mode, csvPath, importLimit, totalRows, analysis, existingDuplicates, importableRows, rowsToImport }) {
  console.log(`Historical UPS import (${mode})`);
  console.log(`CSV: ${csvPath}`);
  if (importLimit) console.log(`Import limit: ${importLimit}`);
  console.log(`Total rows read: ${totalRows}`);
  console.log(`Rows ready before DB duplicate check: ${analysis.validRows.length}`);
  console.log(`Rows ready after DB duplicate check: ${importableRows.length}`);
  console.log(`Rows selected to import: ${rowsToImport.length}`);
  console.log(`Rows skipped: ${analysis.skippedRows.length + analysis.validRows.length - importableRows.length}`);
  if (importLimit) console.log(`Rows not selected due to limit: ${importableRows.length - rowsToImport.length}`);
  console.log(`Rows with missing school: ${analysis.missingSchool}`);
  console.log(`Rows with invalid install date: ${analysis.invalidInstallDate}`);
  console.log(`Duplicate external ticket numbers in CSV: ${analysis.duplicateExternalTicketNumbers.length}`);
  console.log(`Duplicate replacement UPS serials in CSV: ${analysis.duplicateReplacementUpsSerials.length}`);
  console.log(`Existing DB duplicate external ticket numbers: ${existingDuplicates.externalTicketNumbers.size}`);
  console.log(`Existing DB duplicate replacement UPS serials: ${existingDuplicates.replacementSerials.size}`);

  if (analysis.warnings.length) {
    console.log('\nWarnings:');
    analysis.warnings.slice(0, 20).forEach((warning) => {
      console.log(`- CSV row ${warning.csv_row}: ${warning.message}`);
    });
    if (analysis.warnings.length > 20) console.log(`- ...${analysis.warnings.length - 20} more warnings`);
  }

  if (analysis.skippedRows.length) {
    console.log('\nSkipped rows:');
    analysis.skippedRows.slice(0, 20).forEach((row) => {
      console.log(`- CSV row ${row.csv_row}: ${row.reason}`);
    });
    if (analysis.skippedRows.length > 20) console.log(`- ...${analysis.skippedRows.length - 20} more skipped rows`);
  }

  console.log('\nPreview:');
  rowsToImport.slice(0, 5).forEach((row) => {
    console.log(JSON.stringify({
      external_ticket_number: row.external_ticket_number,
      school_name: row.school_name,
      tea_code: row.tea_code,
      proposed_install_date: row.proposed_install_date,
      status: 'fulfilled',
      asset_tag: row.asset_tag,
      new_asset_tag: row.new_asset_tag,
      new_serial_number: row.new_serial_number
    }));
  });
}

async function commitRows(pool, rows) {
  const client = await pool.connect();
  let inserted = 0;

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      await client.query('SAVEPOINT ups_history_row');
      try {
        await client.query(insertSql, [
          row.external_ticket_number,
          row.school_name,
          row.tea_code,
          row.created_date,
          row.serial_number,
          row.defective_battery_pack_serial,
          row.idf,
          row.new_serial_number,
          row.new_webcard_serial,
          row.new_asset_tag,
          row.new_mac_address,
          row.hostname,
          row.new_battery_pack_asset_tag,
          row.new_battery_pack_serial,
          row.room_number,
          row.installed_date,
          row.notes,
          row.snmp_ip,
          row.ups_po,
          row.bp_po,
          row.proposed_install_date
        ]);
        inserted += 1;
        await client.query('RELEASE SAVEPOINT ups_history_row');
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT ups_history_row');
        await client.query('RELEASE SAVEPOINT ups_history_row');
        console.warn(`Skipping CSV row ${row.source_row}: ${error.message}`);
      }
    }

    await client.query('COMMIT');
    console.log(`\nInserted rows: ${inserted}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
