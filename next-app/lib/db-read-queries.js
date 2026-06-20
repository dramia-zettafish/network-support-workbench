// All functions in this file MUST be read-only SELECT queries.
// No mutations allowed.

import 'server-only';
import { query } from './db.js';

// Configurable allowlist: set DB_ALLOWED_TABLES env var as comma-separated table names.
// Defaults to EUS Support tables if not configured.
const ALLOWED_TABLES = process.env.DB_ALLOWED_TABLES
  ? process.env.DB_ALLOWED_TABLES.split(',').map((t) => t.trim()).filter(Boolean)
  : ['parts_catalog', 'inventory'];

/**
 * Validate that a table name is in the configured allowlist.
 *
 * @param {string} tableName - The table name to validate
 * @throws {Error} If the table name is not in the allowlist
 */
export function validateTableName(tableName) {
  if (ALLOWED_TABLES.length === 0) {
    throw new Error(
      'No tables are configured in the allowlist. ' +
      'Set DB_ALLOWED_TABLES environment variable with permitted table names.'
    );
  }
  if (!ALLOWED_TABLES.includes(tableName)) {
    throw new Error(
      `Table "${tableName}" is not in the allowed read list. ` +
      `Allowed tables: ${ALLOWED_TABLES.join(', ')}`
    );
  }
}

/**
 * Fetch all rows from an allowed table with a configurable limit.
 *
 * @param {string} tableName - The table to query (must be in allowlist)
 * @param {number} limit - Maximum rows to return (default: 100)
 * @returns {Promise<Array>} Array of row objects
 */
export async function fetchAllFromTable(tableName, limit = 100) {
  validateTableName(tableName);
  return query(`SELECT * FROM ${tableName} LIMIT $1`, [limit]);
}

/**
 * Fetch a single row by ID from an allowed table.
 *
 * @param {string} tableName - The table to query (must be in allowlist)
 * @param {*} id - The ID value to match
 * @returns {Promise<Array>} Array containing the matching row(s)
 */
export async function fetchById(tableName, id) {
  validateTableName(tableName);
  return query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
}
