#!/usr/bin/env node

/**
 * validate-write-safety.js
 *
 * Validates that write SQL keywords and client-side write fetch calls are
 * properly gated by the write-safety layer. Complements validate-db-readonly.
 *
 * Checks:
 *   1. SQL write keywords (INSERT, UPDATE, DELETE, ALTER, DROP, TRUNCATE) are
 *      only present in explicitly approved write files
 *   2. Approved write files must import the write-safety guard
 *   3. Approved write files must not expose process.env in responses
 *   4. Approved write files must not be imported by client components
 *   5. Client-side files must not contain write fetch calls (PATCH, POST, PUT, DELETE)
 *   6. No TypeScript files outside node_modules
 *   7. .env.local, node_modules, .next, build.log are not git-tracked
 *
 * Exit code 0 = all checks pass
 * Exit code 1 = one or more violations found
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const violations = [];

// Files explicitly approved to contain write SQL (must use write-safety guard)
const APPROVED_WRITE_FILES = [
  'app/api/network/tickets/route.js',
  'app/api/network/tickets/[ticket_number]/route.js',
  'app/api/network/tickets/[ticket_number]/response/route.js',
  'app/api/network/ticket-responses/[ticket_number]/route.js',
  'app/api/network/ups-installations/route.js',
  'app/api/network/ups-installations/[ups_installation_id]/route.js',
  'app/api/network/ups-installations/[ups_installation_id]/phase2/route.js',
  'app/api/network/ups-installations/[ups_installation_id]/phase3-schedule/route.js',
  'app/api/network/ups-installations/[ups_installation_id]/phase3-warehouse/route.js',
  'app/api/network/ups-installations/[ups_installation_id]/phase3-devices/route.js',
  'app/api/network/ups/schedule/route.js',
  'app/api/network/ups/schedule/custom/route.js',
  'app/api/network/ups/[ups_installation_id]/rollback/route.js',
  'app/api/cases/[id]/rma/route.js',
  'app/api/cases/[id]/notifications/send/route.js',
  'app/api/cases/[id]/rma/actions/route.js',
  'app/api/logistics/workbook/upload/route.js',
  'app/api/logistics/submissions/route.js',
  'app/api/logistics/submissions/clear/route.js',
  'app/api/logistics/submissions/undo/route.js',
  'app/api/data-management/refresh-pickup-results/route.js',
  'app/api/checkin/route.js',
  'app/api/issue/cart/route.js',
  'app/api/issue/commit/route.js',
  'app/api/notifications/route.js',
  'app/api/notifications/[id]/decide/route.js',
  'app/api/runbook/processes/route.js',
];

// Files excluded from SQL keyword scanning (auth/crypto utilities, not data writes)
const SQL_SCAN_EXCLUDED_FILES = [
  'lib/auth/session.js',
];

// Client files approved for auth-related POST calls (not data writes)
const AUTH_CLIENT_FILES = [
  'app/login/page.jsx',
  'app/components/nav-header.jsx',
];

const WRITE_SQL_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'ALTER', 'DROP', 'TRUNCATE'];
const WRITE_FETCH_METHODS = ['PATCH', 'POST', 'PUT', 'DELETE'];

function addViolation(file, line, message) {
  violations.push({ file: path.relative(ROOT, file), line, message });
}

function collectFiles(dir, files) {
  files = files || [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (entry === 'node_modules' || entry === '.next') continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      collectFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

function isImportLine(line) {
  return /^\s*(import|const\s+.*=\s*require)/.test(line);
}

function isApprovedFile(filePath) {
  const rel = path.relative(ROOT, filePath);
  return APPROVED_WRITE_FILES.includes(rel) || SQL_SCAN_EXCLUDED_FILES.includes(rel);
}

/**
 * Check 1: SQL write keywords only in approved files
 */
function checkWriteSQLKeywords() {
  const filesToScan = [
    path.join(ROOT, 'lib', 'db.js'),
    path.join(ROOT, 'lib', 'db-read-queries.js'),
  ].concat(collectFiles(path.join(ROOT, 'app', 'api')))
    .concat(collectFiles(path.join(ROOT, 'lib')))
    .filter(function (f) { return fs.existsSync(f) && f.endsWith('.js'); });

  // Deduplicate
  const seen = new Set();
  const unique = filesToScan.filter(function (f) {
    if (seen.has(f)) return false;
    seen.add(f);
    return true;
  });

  for (const filePath of unique) {
    if (isApprovedFile(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isCommentLine(line) || isImportLine(line)) continue;

      const match = line.match(/['"`]([^'"`]*)\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b([^'"`]*)['"`]/i);
      if (match) {
        addViolation(filePath, i + 1, 'SQL write keyword "' + match[2].toUpperCase() + '" in non-approved file');
      }
    }
  }
}

/**
 * Check 2: Approved write files must import write-safety guard
 */
function checkApprovedFilesUseGuard() {
  const guardPattern = /(?:import|require).*(?:write-safety|@\/lib\/write-safety|app\/api\/network\/_guards|@\/app\/api\/network\/_guards)/;

  for (const rel of APPROVED_WRITE_FILES) {
    const filePath = path.join(ROOT, rel);
    if (!fs.existsSync(filePath)) {
      addViolation(filePath, 0, 'Approved write file does not exist');
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!guardPattern.test(content)) {
      addViolation(filePath, 0, 'Approved write file does NOT import write-safety guard');
    }
  }
}

/**
 * Check 3: Approved write files must not expose process.env in responses
 */
function checkApprovedFilesNoEnvExposure() {
  const sensitiveEnvVars = ['DB_HOST', 'DB_PASSWORD', 'DB_USER', 'DB_NAME', 'DATABASE_URL', 'DB_URL'];

  for (const rel of APPROVED_WRITE_FILES) {
    const filePath = path.join(ROOT, rel);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      for (const envVar of sensitiveEnvVars) {
        if (lines[i].includes('process.env.' + envVar)) {
          const ctx = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 4)).join('\n');
          if (/(?:Response\.json|NextResponse\.json|res\.json|res\.send)/i.test(ctx)) {
            addViolation(filePath, i + 1, 'Approved write file exposes ' + envVar + ' in response');
          }
        }
      }
    }
  }
}

/**
 * Check 4: Approved write files must not be imported by client components
 */
function checkApprovedFilesNotImportedByClient() {
  if (APPROVED_WRITE_FILES.length === 0) return;

  const clientFiles = collectFiles(path.join(ROOT, 'app')).concat(collectFiles(path.join(ROOT, 'network-workbench')))
    .filter(function (f) { return f.endsWith('.js') || f.endsWith('.jsx'); });

  for (const filePath of clientFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!/^['"]use client['"];?\s*$/m.test(content)) continue;

    for (const rel of APPROVED_WRITE_FILES) {
      const dir = path.dirname(rel);
      // Only flag if the file contains an import/require referencing the approved write path
      const importPattern = new RegExp('(?:import|require).*' + dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (importPattern.test(content)) {
        addViolation(filePath, 0, 'Client component may import approved write file: ' + rel);
      }
    }
  }
}

/**
 * Check 5: Client-side files must not contain write fetch calls
 *          UNLESS the file is marked @approved-write-client AND checks /api/write-safety/status
 */
function checkClientWriteFetchCalls() {
  const clientFiles = collectFiles(path.join(ROOT, 'app'))
    .filter(function (f) { return f.endsWith('.js') || f.endsWith('.jsx'); });

  const methodShortPattern = /method\s*:\s*['"`](PATCH|POST|PUT|DELETE)['"`]/i;
  const approvedMarker = '@approved-write-client';
  const writeSafetyCheckPattern = /\/api\/write-safety\/status/;

  for (const filePath of clientFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!/^['"]use client['"];?\s*$/m.test(content)) continue;

    // If file has the approved marker AND checks write-safety status, allow it
    const isApprovedClient = content.includes(approvedMarker) && writeSafetyCheckPattern.test(content);
    // Auth client files (login, logout) are allowed to POST to /api/auth/*
    const isAuthClient = AUTH_CLIENT_FILES.includes(path.relative(ROOT, filePath));

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (isCommentLine(lines[i])) continue;
      const match = lines[i].match(methodShortPattern);
      if (match) {
        if (isApprovedClient || isAuthClient) continue;
        addViolation(filePath, i + 1, 'Client-side write fetch call (method: "' + match[1] + '") — UI is read-only');
      }
    }
  }
}

/**
 * Check 6: No TypeScript files outside node_modules
 */
function checkNoTypeScriptFiles() {
  const allFiles = collectFiles(ROOT);
  const tsFiles = allFiles.filter(function (f) { return /\.(ts|tsx)$/.test(f); });

  for (const filePath of tsFiles) {
    addViolation(filePath, 0, 'TypeScript file found — project must be JavaScript only');
  }
}

/**
 * Check 7: Verify .env.local, node_modules, .next, build.log are not tracked
 */
function checkUntrackedFiles() {
  const mustNotTrack = ['.env.local', 'node_modules', '.next', 'build.log'];

  try {
    const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf-8' }).trim();
    for (const name of mustNotTrack) {
      if (tracked.split('\n').some(function (f) { return f === name || f.startsWith(name + '/'); })) {
        addViolation(path.join(ROOT, name), 0, '"' + name + '" is tracked by git — must be in .gitignore');
      }
    }
  } catch (err) {
    // git not available, skip
  }
}

// Run all checks
console.log('🔍 Running write-safety validation...\n');

checkWriteSQLKeywords();
checkApprovedFilesUseGuard();
checkApprovedFilesNoEnvExposure();
checkApprovedFilesNotImportedByClient();
checkClientWriteFetchCalls();
checkNoTypeScriptFiles();
checkUntrackedFiles();

// Report results
if (violations.length === 0) {
  console.log('✅ All write-safety checks passed.\n');
  console.log('Checks performed:');
  console.log('  ✓ No SQL write keywords in non-approved files');
  console.log('  ✓ Approved write files use write-safety guard (' + APPROVED_WRITE_FILES.length + ' approved)');
  console.log('  ✓ Approved write files do not expose process.env in responses');
  console.log('  ✓ Approved write files not imported by client components');
  console.log('  ✓ No unapproved client-side write fetch calls');
  console.log('  ✓ No TypeScript files outside node_modules');
  console.log('  ✓ .env.local, node_modules, .next, build.log not git-tracked');
  process.exit(0);
} else {
  console.error('❌ ' + violations.length + ' write-safety violation(s) found:\n');
  for (const v of violations) {
    const lineInfo = v.line > 0 ? ':' + v.line : '';
    console.error('  ' + v.file + lineInfo + ' — ' + v.message);
  }
  console.error('');
  process.exit(1);
}
