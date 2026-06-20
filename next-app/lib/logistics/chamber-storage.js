/**
 * Chamber Storage — persists technician submissions tied to the active workbook.
 *
 * Submissions are stored as JSON in .local-data/logistics/chamber.json.
 * Chamber is tied to the active workbook's uploadedAt timestamp — if a new
 * workbook is uploaded, prior chamber state is automatically invalidated.
 */

import 'server-only';

import fs from 'fs';
import path from 'path';
import { getWorkbookMeta } from './workbook-storage.js';

const DATA_DIR = path.join(process.cwd(), '.local-data', 'logistics');
const CHAMBER_PATH = path.join(DATA_DIR, 'chamber.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function emptyState(workbookId) {
  return { workbookId, submissions: [], lastClearedAt: null, lastDownloadedAt: null };
}

/**
 * Load chamber state. Returns null if no active workbook.
 * Resets if workbook identity has changed.
 */
export function loadChamber() {
  const meta = getWorkbookMeta();
  if (!meta) return null;

  const workbookId = meta.uploadedAt;

  if (!fs.existsSync(CHAMBER_PATH)) return emptyState(workbookId);

  try {
    const data = JSON.parse(fs.readFileSync(CHAMBER_PATH, 'utf-8'));
    if (data.workbookId !== workbookId) return emptyState(workbookId);
    return data;
  } catch {
    return emptyState(workbookId);
  }
}

/**
 * Save chamber state to disk.
 */
export function saveChamber(chamber) {
  ensureDir();
  fs.writeFileSync(CHAMBER_PATH, JSON.stringify(chamber, null, 2));
}

/**
 * Add submissions to the chamber. Each entry: { work_order_number, owner, sub_status, submittedAt }
 */
export function addSubmissions(entries) {
  const chamber = loadChamber();
  if (!chamber) return null;

  for (const entry of entries) {
    // Replace existing submission for same work_order_number
    const idx = chamber.submissions.findIndex((s) => s.work_order_number === entry.work_order_number);
    if (idx !== -1) chamber.submissions[idx] = entry;
    else chamber.submissions.push(entry);
  }

  saveChamber(chamber);
  return chamber;
}

/**
 * Clear all submissions (after download). Preserves workbookId and timestamps.
 */
export function clearChamber() {
  const chamber = loadChamber();
  if (!chamber) return null;

  chamber.submissions = [];
  chamber.lastClearedAt = new Date().toISOString();
  saveChamber(chamber);
  return chamber;
}

/**
 * Record download timestamp.
 */
export function markDownloaded() {
  const chamber = loadChamber();
  if (!chamber) return null;

  chamber.lastDownloadedAt = new Date().toISOString();
  saveChamber(chamber);
  return chamber;
}
