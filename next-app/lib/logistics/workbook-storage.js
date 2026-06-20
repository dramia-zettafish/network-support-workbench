/**
 * Workbook Storage — manages the active logistics workbook on local filesystem.
 *
 * Stores only the latest uploaded workbook. Previous uploads are replaced.
 * Files are stored in .local-data/logistics/ which is gitignored.
 */

import 'server-only';

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.local-data', 'logistics');
const WORKBOOK_PATH = path.join(DATA_DIR, 'active-workbook.xlsx');
const META_PATH = path.join(DATA_DIR, 'active-workbook-meta.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Save a new active workbook, replacing any previous one.
 * @param {Buffer} buffer - The xlsx file contents
 * @param {string} originalFilename - Original upload filename
 * @returns {{ filename: string, uploadedAt: string }}
 */
export function saveWorkbook(buffer, originalFilename) {
  ensureDir();
  fs.writeFileSync(WORKBOOK_PATH, buffer);
  const meta = {
    filename: originalFilename,
    uploadedAt: new Date().toISOString(),
    sizeBytes: buffer.length,
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
  return meta;
}

/**
 * Get metadata about the active workbook, or null if none exists.
 * @returns {{ filename: string, uploadedAt: string, sizeBytes: number } | null}
 */
export function getWorkbookMeta() {
  if (!fs.existsSync(META_PATH)) return null;
  return JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
}

/**
 * Read the active workbook file as a Buffer, or null if none exists.
 * @returns {Buffer | null}
 */
export function readWorkbookBuffer() {
  if (!fs.existsSync(WORKBOOK_PATH)) return null;
  return fs.readFileSync(WORKBOOK_PATH);
}
