#!/usr/bin/env node
/**
 * validate-team-resolver.js
 * Connects to the database and confirms all required team keys resolve to numeric IDs.
 * Usage: DATABASE_URL=postgresql://... node scripts/validate-team-resolver.js
 */
'use strict';

const { Pool } = require('pg');

const REQUIRED_KEYS = [
  'parts_administrators',
  'rma_administrators',
  'internal_support_technicians',
  'computer_technicians',
  'intake_administrators',
  'route_coordinators',
  'order_administrators',
  'quote_administrators',
  'network_technicians',
  'logistics_technicians',
  'reporting_administrators',
];

// Stage → team key mapping (must match lib/teams.js getStageTeamMap)
const STAGE_TEAM_MAP = {
  'Intake': 'intake_administrators',
  'Diagnosing': 'computer_technicians',
  'Ordering': 'order_administrators',
  'Quote Request': 'quote_administrators',
  'Part Distribution': 'parts_administrators',
  'Repairing': 'computer_technicians',
  'Labor Claim': 'order_administrators',
  'Depot Repair': 'computer_technicians',
  'Ready for Pickup': 'route_coordinators',
  'Pickup Scheduled': 'logistics_technicians',
  'Ready for Delivery': 'route_coordinators',
  'Delivery Scheduled': 'logistics_technicians',
  'Delivered': 'intake_administrators',
};

async function main() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) { console.error('DATABASE_URL not set'); process.exit(1); }

  const pool = new Pool({ connectionString: connStr });
  let failures = 0;

  try {
    const { rows } = await pool.query('SELECT id, key FROM teams WHERE is_enabled = 1');
    const byKey = Object.fromEntries(rows.map(r => [r.key, r.id]));

    console.log(`\n🔍 Team Resolver Validation (${rows.length} teams in DB)\n`);

    // Check all required keys resolve
    for (const key of REQUIRED_KEYS) {
      if (byKey[key] != null) {
        console.log(`  ✓ ${key} → id ${byKey[key]}`);
      } else {
        console.log(`  ✗ ${key} → NOT FOUND`);
        failures++;
      }
    }

    // Check stage map resolves
    console.log(`\n  Stage → Team Map:`);
    for (const [stage, teamKey] of Object.entries(STAGE_TEAM_MAP)) {
      const id = byKey[teamKey];
      if (id != null) {
        console.log(`  ✓ "${stage}" → ${teamKey} (id ${id})`);
      } else {
        console.log(`  ✗ "${stage}" → ${teamKey} (NOT FOUND)`);
        failures++;
      }
    }

    // Check workspace-config keys (all 11 should be present)
    const workspaceKeys = [
      'computer_technicians', 'intake_administrators', 'internal_support_technicians',
      'logistics_technicians', 'network_technicians', 'order_administrators',
      'parts_administrators', 'quote_administrators', 'reporting_administrators',
      'rma_administrators', 'route_coordinators',
    ];
    console.log(`\n  Workspace Config Keys:`);
    for (const key of workspaceKeys) {
      if (byKey[key] != null) {
        console.log(`  ✓ ${key} → id ${byKey[key]}`);
      } else {
        console.log(`  ✗ ${key} → NOT FOUND`);
        failures++;
      }
    }

    console.log(`\n  Results: ${failures === 0 ? '✅ ALL PASS' : `❌ ${failures} FAILURE(S)`}\n`);
    process.exit(failures > 0 ? 1 : 0);
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
