#!/usr/bin/env node

const { Pool } = require('pg');

const sourceConnectionString =
  process.env.SOURCE_NETWORK_DATABASE_URL || 'postgresql://user:password@localhost:5432/tickets';
const targetConnectionString = process.env.NETWORK_DATABASE_URL;

const tableSpecs = [
  { sourceTable: 'tickets', targetTable: 'network_workbench.tickets', pk: 'ticket_number', where: '' },
  { sourceTable: 'rmas', targetTable: 'network_workbench.rmas', pk: 'rma_id', where: '' },
  { sourceTable: 'device_responses', targetTable: 'network_workbench.device_responses', pk: 'id', where: '' },
  {
    sourceTable: 'ups_installations',
    targetTable: 'network_workbench.ups_installations',
    pk: 'ups_installation_id',
    where: 'WHERE ticket_number IS NOT NULL'
  }
];

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

async function main() {
  if (!targetConnectionString) {
    throw new Error('NETWORK_DATABASE_URL must be set. Network Workbench imports never fall back to the EUS database.');
  }

  const source = new Pool({ connectionString: sourceConnectionString });
  const target = new Pool({ connectionString: targetConnectionString });
  const targetClient = await target.connect();

  try {
    await targetClient.query('BEGIN');

    for (const spec of tableSpecs) {
      const copied = await copyTable({ source, targetClient, spec });
      console.log(`${spec.targetTable}: copied ${copied}`);
    }

    await resetSequence(targetClient, 'network_workbench.tickets', 'ticket_number');
    await resetSequence(targetClient, 'network_workbench.rmas', 'rma_id');
    await resetSequence(targetClient, 'network_workbench.device_responses', 'id');
    await resetSequence(targetClient, 'network_workbench.ups_installations', 'ups_installation_id');

    await targetClient.query('COMMIT');
  } catch (error) {
    await targetClient.query('ROLLBACK');
    throw error;
  } finally {
    targetClient.release();
    await source.end();
    await target.end();
  }
}

async function copyTable({ source, targetClient, spec }) {
  const columns = await getColumns(source, spec.sourceTable);
  const rows = await source.query(
    `SELECT ${columns.map(quoteIdentifier).join(', ')}
     FROM ${quoteIdentifier(spec.sourceTable)}
     ${spec.where}`
  );

  if (rows.rowCount === 0) return 0;

  const columnList = columns.map(quoteIdentifier).join(', ');
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const updateList = columns
    .filter((column) => column !== spec.pk)
    .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
    .join(', ');

  const insertSql = `
    INSERT INTO ${quoteQualifiedIdentifier(spec.targetTable)} (${columnList})
    VALUES (${placeholders})
    ON CONFLICT (${quoteIdentifier(spec.pk)}) DO UPDATE SET ${updateList}
  `;

  let copied = 0;
  for (const row of rows.rows) {
    await targetClient.query(insertSql, columns.map((column) => row[column]));
    copied += 1;
  }

  return copied;
}

async function getColumns(pool, table) {
  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
    [table]
  );

  return result.rows.map((row) => row.column_name);
}

async function resetSequence(client, table, column) {
  await client.query(
    `
      SELECT setval(
        pg_get_serial_sequence($1, $2),
        COALESCE((SELECT MAX(${quoteIdentifier(column)}) FROM ${quoteQualifiedIdentifier(table)}), 1),
        true
      )
    `,
    [table, column]
  );
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quoteQualifiedIdentifier(identifier) {
  return identifier.split('.').map(quoteIdentifier).join('.');
}
