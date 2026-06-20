#!/usr/bin/env node

const pg = require('pg');
const bcrypt = require('bcryptjs');

const { Pool } = pg;

const TEAM_LABELS = {
  computer_technicians: 'Computer Technician',
  intake_administrators: 'Intake Administrator',
  internal_support_technicians: 'Internal Support Technician',
  logistics_technicians: 'Logistics Technician',
  network_technicians: 'Network Technician',
  order_administrators: 'Order Administrator',
  parts_administrators: 'Parts Administrator',
  quote_administrators: 'Quote Administrator',
  rma_administrators: 'RMA Administrator',
  reporting_administrators: 'Reporting Administrator',
  route_coordinators: 'Route Coordinator',
};

const ALL_TEAM_KEYS = Object.keys(TEAM_LABELS);

const LOCAL_USERS = [
  {
    username: 'NTech',
    password: 'T3sting!',
    displayName: 'NTech',
    role: 'technician',
    teams: ['network_technicians'],
  },
  {
    username: 'Dev User',
    password: 'Admin123!',
    displayName: 'Dev User',
    role: 'manager',
    teams: ALL_TEAM_KEYS,
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must point at the local EUSupport database.');
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const [key, label] of Object.entries(TEAM_LABELS)) {
      await ensureTeam(client, key, label);
    }

    for (const user of LOCAL_USERS) {
      await ensureLocalUser(client, user);
    }

    await client.query('COMMIT');
    console.log('Seeded local test users: NTech, Dev User');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function ensureTeam(client, key, label) {
  const existing = await client.query('SELECT id FROM teams WHERE key = $1 LIMIT 1', [key]);
  if (existing.rows.length > 0) {
    await client.query('UPDATE teams SET label = $2, is_enabled = 1 WHERE key = $1', [key, label]);
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    'INSERT INTO teams (key, label, is_enabled) VALUES ($1, $2, 1) RETURNING id',
    [key, label]
  );
  return inserted.rows[0].id;
}

async function ensureLocalUser(client, user) {
  const userId = await upsertBusinessUser(client, user);
  await syncUserTeams(client, userId, user.teams);
  await upsertAuthUser(client, user);
}

async function upsertBusinessUser(client, user) {
  const result = await client.query(
    `INSERT INTO users (upn, display_name, email, role, timezone, is_active)
     VALUES ($1, $2, NULL, $3, 'America/Chicago', 1)
     ON CONFLICT (upn) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       role = EXCLUDED.role,
       timezone = EXCLUDED.timezone,
       is_active = 1
     RETURNING id`,
    [user.username, user.displayName, user.role]
  );
  return result.rows[0].id;
}

async function syncUserTeams(client, userId, teamKeys) {
  await client.query('DELETE FROM user_teams WHERE user_id = $1', [userId]);

  for (const teamKey of teamKeys) {
    await client.query(
      `INSERT INTO user_teams (user_id, team_id)
       SELECT $1, id FROM teams WHERE key = $2
       ON CONFLICT DO NOTHING`,
      [userId, teamKey]
    );
  }
}

async function upsertAuthUser(client, user) {
  const passwordHash = await bcrypt.hash(user.password, 10);
  await client.query(
    `INSERT INTO auth_users (username, password_hash, role, is_active)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (username) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       is_active = 1`,
    [user.username, passwordHash, user.role]
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
