/**
 * Writable database access layer — INSERT, UPDATE, DELETE operations.
 * All mutations go through this file. Uses the same pool as db.js.
 */

import 'server-only';
import getPool from './db.js';

/**
 * Execute a parameterized write SQL query (INSERT/UPDATE/DELETE).
 *
 * @param {string} text - SQL query string with $1, $2, ... placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<{rows: Array, rowCount: number}>}
 */
export async function mutate(text, params = []) {
  const result = await getPool().query(text, params);
  return { rows: result.rows, rowCount: result.rowCount };
}

/**
 * Execute multiple statements in a single transaction.
 *
 * @param {Function} fn - async function receiving a client
 * @returns {Promise<*>} Return value of fn
 */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
