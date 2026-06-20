import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth.js';
import { requireRole } from '@/lib/auth/require-role.js';
import { query } from '@/lib/db.js';
import { mutate } from '@/lib/db-write.js';
import { requireWriteEnabled } from '@/lib/write-safety';
import fs from 'fs';
import path from 'path';

const INDEX_PATH = path.join(process.cwd(), 'public', 'static', 'processFlows', 'index.json');
const DEFAULT_TEAM = 'Parts Administrators';
const TEAM_ALIASES = new Map([
  ['parts administration', DEFAULT_TEAM],
]);

function loadRunbookIndex() {
  try {
    const data = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
    const processes = data?.processes;
    if (!Array.isArray(processes)) return [];
    return processes.filter((p) => p && p.id);
  } catch {
    return [];
  }
}

function canonicalTeamLabel(team) {
  const normalized = String(team || '').trim().split(/\s+/).filter(Boolean).join(' ');
  if (!normalized) return '';
  return TEAM_ALIASES.get(normalized.toLowerCase()) || normalized;
}

function dedupeCaseInsensitive(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const key = String(value || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function parseTeams(raw) {
  if (raw == null) return [];

  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!value) return [];
    try {
      return parseTeams(JSON.parse(value));
    } catch {
      return dedupeCaseInsensitive(
        value.split(',').map(canonicalTeamLabel).filter(Boolean)
      );
    }
  }

  if (Array.isArray(raw)) {
    return dedupeCaseInsensitive(raw.map(canonicalTeamLabel).filter(Boolean));
  }

  return [];
}

function effectiveTeams(raw) {
  const teams = parseTeams(raw);
  return teams.length > 0 ? teams : [DEFAULT_TEAM];
}

function teamsDbValue(raw) {
  return JSON.stringify(effectiveTeams(raw));
}

function docVisibleToUser(docTeams, userTeams) {
  const docSet = new Set(effectiveTeams(docTeams).map((t) => t.toLowerCase()));
  const userSet = new Set(effectiveTeams(userTeams).map((t) => t.toLowerCase()));
  return [...docSet].some((team) => userSet.has(team));
}

/**
 * GET /api/runbook/processes — list visible process flow documents
 * Optional query param: ?team=<team_key> to filter by active workspace
 */
export async function GET(req) {
  const user = await requireAuth(req);

  const processes = loadRunbookIndex();
  if (processes.length === 0) {
    return NextResponse.json([]);
  }

  // Check for team filter from query params
  const { searchParams } = new URL(req.url);
  const teamFilter = searchParams.get('team');

  // Get user's team labels from the users.teams column (matches main branch behavior)
  let userTeamsRaw = null;
  try {
    const userRows = await query(`SELECT teams FROM users WHERE upn = $1 LIMIT 1`, [user.username]);
    if (userRows.length > 0 && userRows[0].teams) {
      userTeamsRaw = userRows[0].teams;
    }
  } catch {}

  // Also include team keys mapped to labels
  if (parseTeams(userTeamsRaw).length === 0 && user.teams && user.teams.length > 0) {
    try {
      const teamRows = await query(`SELECT label FROM teams WHERE key = ANY($1)`, [user.teams]);
      userTeamsRaw = teamRows.map((r) => r.label);
    } catch {}
  }
  const userTeams = effectiveTeams(userTeamsRaw);

  // Load team restrictions from DB
  let docTeamMap = {};
  try {
    const rows = await query(`SELECT doc_id, teams FROM runbook_documents`);
    for (const r of rows) {
      docTeamMap[r.doc_id] = r.teams;
    }
  } catch {}

  // If a team filter is provided, resolve its label and filter to only that team
  let filterLabel = null;
  if (teamFilter) {
    try {
      const teamRows = await query(`SELECT label FROM teams WHERE key = $1 LIMIT 1`, [teamFilter]);
      if (teamRows.length > 0) filterLabel = teamRows[0].label;
    } catch {}
    if (!filterLabel) filterLabel = teamFilter;
  }

  const visible = processes
    .filter((p) => docVisibleToUser(docTeamMap[p.id], userTeams))
    .filter((p) => {
      if (!filterLabel) return true;
      const docTeams = effectiveTeams(docTeamMap[p.id]);
      return docTeams.some((t) => t.toLowerCase() === filterLabel.toLowerCase());
    })
    .map((p) => ({ ...p, teams: effectiveTeams(docTeamMap[p.id]) }));

  return NextResponse.json(visible);
}

/**
 * PATCH /api/runbook/processes — set team visibility for a document (manager only)
 * Body: { doc_id, teams: string[] }
 */
export async function PATCH(req) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;

  try {
    await requireRole('manager', req);
    const body = await req.json();
    const docId = (body.doc_id || '').trim();
    const teams = effectiveTeams(body.teams);

    if (!docId) {
      return NextResponse.json({ error: 'doc_id is required' }, { status: 422 });
    }

    const teamsVal = teamsDbValue(teams);
    await mutate(
      `INSERT INTO runbook_documents(doc_id, teams, created_at, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(doc_id) DO UPDATE SET teams = EXCLUDED.teams, updated_at = CURRENT_TIMESTAMP`,
      [docId, teamsVal]
    );

    return NextResponse.json({ ok: true, doc_id: docId, teams });
  } catch (error) {
    if (error.forbidden) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error.unauthorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
