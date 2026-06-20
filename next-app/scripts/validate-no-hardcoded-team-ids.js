#!/usr/bin/env node
/**
 * validate-no-hardcoded-team-ids.js
 * Fails if any dev team IDs (2340–2350) are found in app source files.
 */
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEV_IDS = [2340, 2341, 2342, 2343, 2344, 2345, 2346, 2347, 2348, 2349, 2350];
const PATTERN = DEV_IDS.join('|');
const SCAN_DIRS = ['app', 'lib', 'middleware.js'].map(d => path.join(ROOT, d));

let failures = [];

for (const dir of SCAN_DIRS) {
  try {
    const out = execSync(
      `grep -rn --include='*.js' --include='*.jsx' -E '\\b(${PATTERN})\\b' ${dir}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    for (const line of out.trim().split('\n').filter(Boolean)) {
      // Exclude node_modules and .next
      if (line.includes('node_modules') || line.includes('.next/')) continue;
      // Exclude this validation script itself
      if (line.includes('validate-no-hardcoded-team-ids')) continue;
      failures.push(line);
    }
  } catch (e) {
    // grep returns exit 1 when no matches — that's success for us
    if (e.status !== 1) throw e;
  }
}

if (failures.length > 0) {
  console.error('\n❌ FAIL: Hardcoded dev team IDs (2340–2350) found:\n');
  failures.forEach(f => console.error(`  ${f}`));
  console.error(`\n  ${failures.length} occurrence(s) must be replaced with team key lookups.\n`);
  process.exit(1);
} else {
  console.log('\n✅ PASS: No hardcoded dev team IDs (2340–2350) found in source.\n');
  process.exit(0);
}
