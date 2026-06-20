// READ-ONLY database access layer.
// Do not add INSERT, UPDATE, DELETE, ALTER, DROP, or TRUNCATE operations
// to this file or any file that imports from it.

import 'server-only';
import { Pool } from 'pg';

/**
 * Resolve PostgreSQL connection configuration.
 *
 * Priority:
 *   1. DATABASE_URL (full connection string)
 *   2. DB_URL (alias for DATABASE_URL)
 *   3. Individual DB_* environment variables (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
 */
function resolveConnectionConfig() {
  // Prefer connection string if available
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  if (process.env.DB_URL) {
    return { connectionString: process.env.DB_URL };
  }

  // Fall back to individual variables
  const requiredVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required database environment variables: ${missing.join(', ')}. ` +
      'Provide DATABASE_URL, DB_URL, or all individual DB_* variables. ' +
      'See .env.local.example for required configuration.'
    );
  }

  return {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
}

// Lazy singleton pool — only initialized on first query to avoid build-time errors
// when environment variables are not yet available.
let pool = null;

function getPool() {
  if (!pool) {
    const connectionConfig = resolveConnectionConfig();
    pool = new Pool({
      ...connectionConfig,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

/**
 * Execute a parameterized read-only SQL query.
 *
 * @param {string} text - SQL query string with $1, $2, ... placeholders
 * @param {Array} params - Parameter values for the query
 * @returns {Promise<Array>} Array of result rows
 */
export async function query(text, params = []) {
  const result = await getPool().query(text, params);
  return result.rows;
}

export default getPool;
