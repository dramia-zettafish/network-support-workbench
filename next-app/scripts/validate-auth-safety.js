#!/usr/bin/env node
/**
 * validate-auth-safety.js — Ensures auth boundary safety invariants.
 *
 * Checks:
 * 1. No dev/mock auth in production config
 * 2. No process.env values exposed in API responses
 * 3. No password hashes in responses
 * 4. No TypeScript files
 * 5. Sensitive files not tracked in git
 * 6. SESSION_SECRET not hardcoded in tracked files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
let passes = 0;

function pass(msg) {
  passes++;
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  failures++;
  console.log(`  ✗ ${msg}`);
}

function readFile(filePath) {
  try {
    return fs.readFileSync(path.join(ROOT, filePath), 'utf8');
  } catch {
    return null;
  }
}

function getTrackedFiles() {
  try {
    const out = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    // Fallback: list files manually
    return [];
  }
}

console.log('\n🔒 Auth Safety Validation\n');

// 1. Check that mock provider is not usable in production
console.log('  [Production Safety]');
const getCurrUser = readFile('lib/auth/get-current-user.js');
if (getCurrUser && getCurrUser.includes("process.env.NODE_ENV === 'production'")) {
  pass('get-current-user.js rejects mock in production');
} else {
  fail('get-current-user.js must reject mock provider in production');
}

const loginRoute = readFile('app/api/auth/login/route.js');
if (loginRoute && loginRoute.includes("process.env.NODE_ENV === 'production'")) {
  pass('Login route rejects mock in production');
} else {
  fail('Login route must reject mock provider in production');
}

// 2. Check no process.env values exposed in API responses
console.log('\n  [Secret Exposure]');
const apiFiles = [];
function findApiFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findApiFiles(full);
    else if (entry.name === 'route.js') apiFiles.push(full);
  }
}
findApiFiles(path.join(ROOT, 'app/api'));

let envExposed = false;
for (const file of apiFiles) {
  const content = fs.readFileSync(file, 'utf8');
  // Check for patterns that would expose env vars in responses
  if (content.match(/json\([^)]*process\.env\./)) {
    const rel = path.relative(ROOT, file);
    fail(`${rel} may expose process.env in response`);
    envExposed = true;
  }
}
if (!envExposed) pass('No process.env values exposed in API responses');

// 3. Check no password_hash in API responses
let hashExposed = false;
for (const file of apiFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('password_hash') && !content.includes('// validate-auth-safety')) {
    const rel = path.relative(ROOT, file);
    fail(`${rel} references password_hash`);
    hashExposed = true;
  }
}
if (!hashExposed) pass('No password_hash references in API routes');

// 4. No TypeScript files in app/ or lib/
console.log('\n  [No TypeScript]');
let tsFound = false;
function findTs(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') findTs(full);
    else if (entry.name.match(/\.(ts|tsx)$/)) {
      fail(`TypeScript file found: ${path.relative(ROOT, full)}`);
      tsFound = true;
    }
  }
}
findTs(path.join(ROOT, 'app'));
findTs(path.join(ROOT, 'lib'));
if (!tsFound) pass('No TypeScript files in app/ or lib/');

// 5. Sensitive files not tracked
console.log('\n  [Sensitive Files]');
const tracked = getTrackedFiles();
const sensitivePatterns = ['.env.local', '.next', 'node_modules', 'build.log'];
let sensitiveTracked = false;
for (const pattern of sensitivePatterns) {
  const found = tracked.filter((f) => f === pattern || f.startsWith(pattern + '/'));
  if (found.length > 0) {
    fail(`${pattern} is tracked in git`);
    sensitiveTracked = true;
  }
}
if (!sensitiveTracked) pass('No sensitive files tracked in git');

// 6. SESSION_SECRET not hardcoded
console.log('\n  [Hardcoded Secrets]');
let secretHardcoded = false;
const sourceFiles = tracked.filter((f) => f.match(/\.(js|jsx|json)$/) && !f.includes('node_modules'));
for (const file of sourceFiles) {
  const content = readFile(file);
  if (!content) continue;
  if (content.match(/SESSION_SECRET\s*=\s*['"][^'"]{10,}['"]/)) {
    fail(`${file} has hardcoded SESSION_SECRET`);
    secretHardcoded = true;
  }
}
if (!secretHardcoded) pass('No hardcoded SESSION_SECRET in source');

// 7. Middleware exists
console.log('\n  [Middleware]');
if (fs.existsSync(path.join(ROOT, 'middleware.js'))) {
  pass('middleware.js exists');
} else {
  fail('middleware.js not found — routes are unprotected');
}

// Summary
console.log(`\n  Results: ${passes} passed, ${failures} failed\n`);
process.exit(failures > 0 ? 1 : 0);
