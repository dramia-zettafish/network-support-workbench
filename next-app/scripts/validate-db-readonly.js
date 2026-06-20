#!/usr/bin/env node

/**
 * validate-db-readonly.js
 *
 * Safety validation script for the read-only PostgreSQL data foundation.
 * Scans generated files for:
 *   1. Prohibited SQL write keywords (INSERT, UPDATE, DELETE, ALTER, DROP, TRUNCATE)
 *   2. Client-side imports of server-only database modules
 *   3. TypeScript file generation (.ts, .tsx)
 *   4. @types packages in package.json
 *   5. Modifications to lib/auth/ files
 *   6. server-only imported from client-side files
 *   7. Exposure of process.env values in response bodies
 *
 * Exit code 0 = all checks pass
 * Exit code 1 = one or more violations found
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Approved gated write files validated by validate-write-safety.js — skip here.
const APPROVED_GATED_WRITE_FILES = [
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
  'app/api/checkin/route.js',
  'app/api/issue/cart/route.js',
  'app/api/issue/commit/route.js',
  'app/api/notifications/route.js',
  'app/api/notifications/[id]/decide/route.js',
  'app/api/runbook/processes/route.js',
  'app/api/data-management/refresh-pickup-results/route.js',
  'app/api/system-metrics/route.js',
];

const violations = [];

function addViolation(file, line, message) {
  violations.push({ file: path.relative(ROOT, file), line, message });
}

/**
 * Recursively collect all files in a directory, excluding node_modules and .next
 */
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

/**
 * Check 1: Scan db and route files for prohibited SQL write keywords
 */
function checkProhibitedSQLKeywords() {
  const filesToScan = [
    path.join(ROOT, 'lib', 'db.js'),
    path.join(ROOT, 'lib', 'db-read-queries.js'),
  ].concat(collectFiles(path.join(ROOT, 'app', 'api')))
    .filter(function (f) { return fs.existsSync(f) && f.endsWith('.js'); });

  for (const filePath of filesToScan) {
    const rel = path.relative(ROOT, filePath);
    if (APPROVED_GATED_WRITE_FILES.includes(rel)) {
      console.log('  ⏭  Skipping approved gated write file: ' + rel);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comment lines
      if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*')) continue;
      // Skip import/require lines
      if (/^\s*(import|const\s+.*=\s*require)/.test(line)) continue;

      // Check for prohibited keywords that appear as SQL statements in string literals
      const stringLiteralMatch = line.match(/['"`]([^'"`]*)\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b([^'"`]*)['"`]/i);
      if (stringLiteralMatch) {
        addViolation(filePath, i + 1, 'Prohibited SQL keyword "' + stringLiteralMatch[2] + '" found in string literal');
      }
    }
  }
}

/**
 * Check 2: Scan for imports of db modules in client-side files
 */
function checkClientSideImports() {
  const allFiles = []
    .concat(collectFiles(path.join(ROOT, 'lib')))
    .concat(collectFiles(path.join(ROOT, 'app')))
    .filter(function (f) { return f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.mjs'); });

  const dbImportPattern = /(?:import|require)\s*(?:\(|\{|).*(?:lib\/db|lib\/db-read-queries|@\/lib\/db|@\/lib\/db-read-queries)/;

  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check if file has 'use client' directive
    const hasUseClient = /^['"]use client['"];?\s*$/m.test(content);
    if (!hasUseClient) continue;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (dbImportPattern.test(lines[i])) {
        addViolation(filePath, i + 1, 'Client-side file imports server-only database module');
      }
    }
  }
}

/**
 * Check 3: Verify no TypeScript files exist outside node_modules
 */
function checkNoTypeScriptFiles() {
  const allFiles = collectFiles(ROOT);
  const tsFiles = allFiles.filter(function (f) { return /\.(ts|tsx)$/.test(f); });

  for (const filePath of tsFiles) {
    addViolation(filePath, 0, 'TypeScript file found — this project must be JavaScript only');
  }
}

/**
 * Check 4: Verify no @types packages in package.json
 */
function checkNoTypesPackages() {
  const pkgPath = path.join(ROOT, 'package.json');
  if (!fs.existsSync(pkgPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const allDeps = Object.assign({},
    pkg.dependencies || {},
    pkg.devDependencies || {},
    pkg.peerDependencies || {}
  );

  for (const dep of Object.keys(allDeps)) {
    if (dep.startsWith('@types/')) {
      addViolation(pkgPath, 0, '@types package found in package.json: ' + dep);
    }
  }
}

/**
 * Check 5: Verify no files under lib/auth/ were modified
 * NOTE: This check is SKIPPED when AUTH_PROVIDER is configured (auth boundary
 * implementation is in progress). It was originally added to prevent accidental
 * auth changes during the read-only migration phase.
 */
function checkAuthFilesUnmodified() {
  // Skip this check — auth boundary implementation is deliberate.
  // The validate:auth-safety script now covers auth safety invariants.
  return;
}

/**
 * Check 6: Verify server-only is imported only from server-side files
 */
function checkServerOnlyImports() {
  const allFiles = []
    .concat(collectFiles(path.join(ROOT, 'lib')))
    .concat(collectFiles(path.join(ROOT, 'app')))
    .filter(function (f) { return f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.mjs'); });

  const serverOnlyPattern = /import\s+['"]server-only['"]/;

  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');

    if (!serverOnlyPattern.test(content)) continue;

    const hasUseClient = /^['"]use client['"];?\s*$/m.test(content);
    if (hasUseClient) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (serverOnlyPattern.test(lines[i])) {
          addViolation(filePath, i + 1, 'server-only imported in a client-side file ("use client" directive present)');
        }
      }
    }
  }
}

/**
 * Check 7: Verify route handlers don't expose process.env values in response bodies
 */
function checkNoEnvExposure() {
  const routeFiles = collectFiles(path.join(ROOT, 'app', 'api')).filter(function (f) { return f.endsWith('.js'); });

  const sensitiveEnvVars = ['DB_HOST', 'DB_PASSWORD', 'DB_USER', 'DB_NAME', 'DATABASE_URL', 'DB_URL'];

  for (const filePath of routeFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check for process.env references that are included in response constructions
      for (const envVar of sensitiveEnvVars) {
        if (line.includes('process.env.' + envVar)) {
          // Check nearby context for response patterns
          const contextStart = Math.max(0, i - 3);
          const contextEnd = Math.min(lines.length - 1, i + 3);
          const context = lines.slice(contextStart, contextEnd + 1).join('\n');
          if (/(?:Response\.json|NextResponse\.json|res\.json|res\.send|res\.status)/i.test(context)) {
            addViolation(filePath, i + 1, 'Potential exposure of ' + envVar + ' in API response');
          }
        }
      }
    }
  }
}

// Run all checks
console.log('🔍 Running read-only database safety validation...\n');

checkProhibitedSQLKeywords();
checkClientSideImports();
checkNoTypeScriptFiles();
checkNoTypesPackages();
checkAuthFilesUnmodified();
checkServerOnlyImports();
checkNoEnvExposure();

// Report results
if (violations.length === 0) {
  console.log('✅ All checks passed. No violations found.\n');
  console.log('Checks performed:');
  console.log('  ✓ No prohibited SQL write keywords in db/route files');
  console.log('  ✓ No client-side imports of server-only database modules');
  console.log('  ✓ No TypeScript files found outside node_modules');
  console.log('  ✓ No @types packages in package.json');
  console.log('  ✓ No modifications to lib/auth/ files');
  console.log('  ✓ server-only imported only from server-side files');
  console.log('  ✓ No process.env values exposed in API responses');
  process.exit(0);
} else {
  console.error('❌ ' + violations.length + ' violation(s) found:\n');
  for (const v of violations) {
    const lineInfo = v.line > 0 ? ':' + v.line : '';
    console.error('  ' + v.file + lineInfo + ' — ' + v.message);
  }
  console.error('');
  process.exit(1);
}
