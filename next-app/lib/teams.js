/**
 * Team resolver — looks up numeric team IDs by stable key from the database.
 * Caches results for the lifetime of the server process (cleared on restart).
 */

import 'server-only';
import { query } from './db.js';

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

async function loadTeams() {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache;
  const rows = await query(`SELECT id, key FROM teams WHERE is_enabled = 1`);
  _cache = Object.fromEntries(rows.map(r => [r.key, r.id]));
  _cacheTime = now;
  return _cache;
}

/**
 * Get the numeric team ID for a given team key.
 * @param {string} key - e.g. 'computer_technicians'
 * @returns {Promise<number>}
 */
export async function getTeamId(key) {
  const map = await loadTeams();
  const id = map[key];
  if (id == null) throw new Error(`Unknown team key: ${key}`);
  return id;
}

/**
 * Get all team IDs as a { key: id } map.
 * @returns {Promise<Record<string, number>>}
 */
export async function getTeamIds() {
  return loadTeams();
}

/**
 * Build the stage → team-id mapping used by logistics routing.
 * @returns {Promise<Record<string, number>>}
 */
export async function getStageTeamMap() {
  const t = await loadTeams();
  return {
    'Intake': t.intake_administrators,
    'Diagnosing': t.computer_technicians,
    'Ordering': t.order_administrators,
    'Quote Request': t.quote_administrators,
    'Quote Request - Hold': t.quote_administrators,
    'Part Distribution': t.parts_administrators,
    'Repairing': t.computer_technicians,
    'Labor Claim': t.order_administrators,
    'Depot Repair': t.computer_technicians,
    'Ready for Pickup': t.route_coordinators,
    'Pickup Scheduled': t.logistics_technicians,
    'Ready for Delivery': t.route_coordinators,
    'Delivery Scheduled': t.logistics_technicians,
    'Delivered': t.order_administrators,
    'Cancelled': t.route_coordinators,
  };
}
