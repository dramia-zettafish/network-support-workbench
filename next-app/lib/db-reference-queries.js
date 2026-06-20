// Read-only reference data query functions for users and teams.
// All functions in this file MUST be read-only SELECT queries.
// No mutations allowed.
// No sensitive fields (password hashes, auth secrets, MFA fields, tokens) are exposed.

import 'server-only';
import { query } from './db.js';
import { validateTableName } from './db-read-queries.js';

const USERS_TABLE = 'users';
const TEAMS_TABLE = 'teams';

/**
 * Fetch all active users with safe reference fields only.
 * Excludes: email, role, password hashes, auth secrets, MFA fields, tokens.
 *
 * @returns {Promise<Array>} Array of user objects with id, upn, display_name
 */
export async function getAllUsers() {
  validateTableName(USERS_TABLE);
  const sql = `SELECT id, upn, display_name FROM users WHERE is_active = $1 ORDER BY display_name ASC`;
  return query(sql, [1]);
}

/**
 * Fetch all enabled teams with safe reference fields only.
 * Excludes: description, created_at, updated_at.
 *
 * @returns {Promise<Array>} Array of team objects with id, key, label
 */
export async function getAllTeams() {
  validateTableName(TEAMS_TABLE);
  const sql = `SELECT id, key, label FROM teams WHERE is_enabled = $1 ORDER BY label ASC`;
  return query(sql, [1]);
}
