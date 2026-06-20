#!/usr/bin/env node
/**
 * validate-production-readiness.js — Meta-check for obvious production risks.
 *
 * Checks:
 * 1. .env.local not tracked in git
 * 2. No uploaded workbook files tracked
 * 3. No generated downloads tracked
 * 4. No TypeScript files in app/ or lib/
 * 5. No WRITES_ENABLED=true in tracked env examples
 * 6. No AUTH_PROVIDER=mock as production default
 * 7. Required docs exist
 * 8. Existing validation scripts pass (references only — does not run them)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
let passes = 0;

function pass(msg) { passes++; console.log(`  ✓ ${msg}`); }
function fail(msg) { failures++; console.log(`  ✗ ${msg}`); }

function getTrackedFiles() {
  try {
    return execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch { return []; }
}

const tracked = getTrackedFiles();

console.log('\n🚀 Production Readiness Validation\n');

// 1. .env.local not tracked
console.log('  [Secrets & Environment]');
if (tracked.includes('.env.local')) fail('.env.local is tracked in git');
else pass('.env.local not tracked');

// 2. No uploaded workbook files tracked (.local-data/)
if (tracked.some(f => f.startsWith('.local-data/'))) fail('.local-data/ files tracked in git');
else pass('No .local-data/ files tracked');

// 3. No generated downloads tracked
if (tracked.some(f => f.startsWith('.next/'))) fail('.next/ build output tracked in git');
else pass('No .next/ build output tracked');

// 4. No TypeScript files in app/ or lib/
console.log('\n  [Language Compliance]');
const tsFiles = tracked.filter(f => /\.(ts|tsx)$/.test(f) && (f.startsWith('app/') || f.startsWith('lib/')));
if (tsFiles.length > 0) { tsFiles.forEach(f => fail(`TypeScript file: ${f}`)); }
else pass('No TypeScript files in app/ or lib/');

// 5. No WRITES_ENABLED=true in tracked env examples
console.log('\n  [Write Safety]');
const envExamplePath = path.join(ROOT, '.env.local.example');
if (fs.existsSync(envExamplePath)) {
  const envContent = fs.readFileSync(envExamplePath, 'utf8');
  if (/^\s*WRITES_ENABLED\s*=\s*true\s*$/m.test(envContent)) {
    fail('.env.local.example has WRITES_ENABLED=true');
  } else {
    pass('WRITES_ENABLED defaults to false in .env.local.example');
  }
} else {
  fail('.env.local.example not found');
}

// 6. No AUTH_PROVIDER=mock as uncommented default suggesting production use
console.log('\n  [Auth Safety]');
if (fs.existsSync(envExamplePath)) {
  const envContent = fs.readFileSync(envExamplePath, 'utf8');
  // Check that mock is documented as dev-only (the file has comments explaining this)
  if (/^\s*AUTH_PROVIDER\s*=\s*mock\s*$/m.test(envContent)) {
    // Acceptable if there's a comment explaining it's dev-only
    if (envContent.includes('Development only') || envContent.includes('REJECTED in production')) {
      pass('AUTH_PROVIDER=mock in example is documented as dev-only');
    } else {
      fail('AUTH_PROVIDER=mock in example without production warning');
    }
  } else {
    pass('AUTH_PROVIDER not set to mock in example');
  }
}

// 7. Required docs exist
console.log('\n  [Documentation]');
const requiredDocs = [
  'docs/PRODUCTION-READINESS.md',
  'docs/AUTH-BOUNDARY.md',
  '.env.local.example',
  'middleware.js',
];
for (const doc of requiredDocs) {
  if (fs.existsSync(path.join(ROOT, doc))) pass(`${doc} exists`);
  else fail(`${doc} missing`);
}

// 8. Validation scripts referenced in package.json
console.log('\n  [Validation Scripts]');
const pkgPath = path.join(ROOT, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const scripts = pkg.scripts || {};
  const required = ['validate:db-readonly', 'validate:write-safety', 'validate:auth-safety'];
  for (const s of required) {
    if (scripts[s]) pass(`npm run ${s} defined`);
    else fail(`npm run ${s} not defined in package.json`);
  }
}

// Summary
console.log(`\n  Results: ${passes} passed, ${failures} failed\n`);
process.exit(failures > 0 ? 1 : 0);
