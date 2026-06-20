import http from 'http';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { appendFile, mkdir, readFile, rename, writeFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role.js';
import { query } from '@/lib/db.js';
import { mutate } from '@/lib/db-write.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);
const DOCKER_SOCKET = '/var/run/docker.sock';
const HISTORY_RETENTION_MS = 8 * 24 * 60 * 60 * 1000;
const CURRENT_WINDOW_MS = 3 * 60 * 1000;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_BUCKET_MS = 30 * 60 * 1000;
const WEEK_BUCKET_MS = 2 * 60 * 60 * 1000;
const HOST_SNAPSHOT_MAX_AGE_MS = 15 * 1000;
const LATEST_SAMPLE_MAX_AGE_MS = 30 * 1000;
const ACTIVE_USER_WINDOW_MS = 20 * 1000;
const BACKGROUND_USER_WINDOW_MS = 90 * 1000;
const USE_DATABASE_HISTORY = true;
let metricsTableReadyPromise = null;
let activeUsersTableReadyPromise = null;

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function nonNegativeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, number);
}

function cpuSnapshot() {
  return os.cpus().reduce(
    (snapshot, cpu) => {
      const times = cpu.times;
      const total = Object.values(times).reduce((sum, value) => sum + value, 0);
      return {
        idle: snapshot.idle + times.idle,
        total: snapshot.total + total,
      };
    },
    { idle: 0, total: 0 }
  );
}

async function getOsCpuUsagePercent() {
  const start = cpuSnapshot();
  await new Promise((resolve) => setTimeout(resolve, 250));
  const end = cpuSnapshot();
  const idleDelta = end.idle - start.idle;
  const totalDelta = end.total - start.total;
  if (totalDelta <= 0) return 0;
  return clampPercent(((totalDelta - idleDelta) / totalDelta) * 100);
}

async function readNumberFile(filePath) {
  try {
    const raw = (await readFile(filePath, 'utf8')).trim();
    if (!raw || raw === 'max') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function requestDocker(pathname) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { socketPath: DOCKER_SOCKET, path: pathname, method: 'GET' },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Docker API ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    request.setTimeout(4000, () => request.destroy(new Error('Docker API timeout')));
    request.on('error', reject);
    request.end();
  });
}

function dockerCpuPercent(stats) {
  const cpuDelta = Number(stats?.cpu_stats?.cpu_usage?.total_usage || 0)
    - Number(stats?.precpu_stats?.cpu_usage?.total_usage || 0);
  const systemDelta = Number(stats?.cpu_stats?.system_cpu_usage || 0)
    - Number(stats?.precpu_stats?.system_cpu_usage || 0);
  const onlineCpus = Number(stats?.cpu_stats?.online_cpus)
    || stats?.cpu_stats?.cpu_usage?.percpu_usage?.length
    || os.cpus().length
    || 1;

  if (cpuDelta <= 0 || systemDelta <= 0) return 0;
  return Math.max(0, (cpuDelta / systemDelta) * onlineCpus * 100);
}

function dockerMemory(stats) {
  const memoryStats = stats?.memory_stats || {};
  const rawUsed = Number(memoryStats.usage || 0);
  const inactiveFile = Number(
    memoryStats?.stats?.total_inactive_file
    ?? memoryStats?.stats?.inactive_file
    ?? 0
  );
  const used = Math.max(0, rawUsed - inactiveFile);
  const limit = Number(memoryStats.limit || 0);
  const free = Math.max(0, limit - used);
  return {
    usedBytes: used,
    rawUsedBytes: rawUsed,
    cacheBytes: inactiveFile,
    totalBytes: limit,
    freeBytes: free,
    usedPercent: limit > 0 ? (used / limit) * 100 : 0,
    source: 'docker-stats',
  };
}

async function getContainerMetrics() {
  const containerName = process.env.SYSTEM_METRICS_CONTAINER_NAME || os.hostname();
  try {
    const stats = await requestDocker(`/containers/${encodeURIComponent(containerName)}/stats?stream=false`);
    return {
      name: (stats.name || containerName).replace(/^\//, ''),
      id: stats.id,
      source: 'docker-stats',
      cpu: {
        usagePercent: dockerCpuPercent(stats),
        onlineCpus: Number(stats?.cpu_stats?.online_cpus) || os.cpus().length,
      },
      memory: dockerMemory(stats),
    };
  } catch {
    const used = await readNumberFile('/sys/fs/cgroup/memory.current')
      ?? await readNumberFile('/sys/fs/cgroup/memory/memory.usage_in_bytes')
      ?? 0;
    const max = await readNumberFile('/sys/fs/cgroup/memory.max')
      ?? await readNumberFile('/sys/fs/cgroup/memory/memory.limit_in_bytes')
      ?? os.totalmem();
    return {
      name: containerName,
      source: 'cgroup-fallback',
      cpu: {
        usagePercent: await getOsCpuUsagePercent(),
        onlineCpus: os.cpus().length,
      },
      memory: {
        usedBytes: used,
        totalBytes: max,
        freeBytes: Math.max(0, max - used),
        usedPercent: max > 0 ? (used / max) * 100 : 0,
        source: 'cgroup-fallback',
      },
    };
  }
}

async function getSystemMetrics() {
  const snapshotPath = process.env.SYSTEM_METRICS_HOST_SNAPSHOT_PATH;
  if (snapshotPath) {
    try {
      const rawSnapshot = (await readFile(snapshotPath, 'utf8')).replace(/^\uFEFF/, '');
      const snapshot = JSON.parse(rawSnapshot);
      if (!snapshot.error && snapshot.cpu && snapshot.memory) {
        const snapshotTime = Date.parse(snapshot.timestamp);
        if (!Number.isFinite(snapshotTime)) {
          throw new Error('Host metrics snapshot has an invalid timestamp');
        }
        const ageMs = Date.now() - snapshotTime;
        if (ageMs > HOST_SNAPSHOT_MAX_AGE_MS) {
          throw new Error(`Host metrics snapshot is stale (${Math.round(ageMs / 1000)}s old)`);
        }
        return {
          source: snapshot.source || 'host-snapshot',
          timestamp: snapshot.timestamp,
          ageMs,
          cpu: {
            usagePercent: clampPercent(snapshot.cpu.usagePercent),
            logicalCores: Number(snapshot.cpu.logicalCores) || os.cpus().length,
          },
          memory: {
            totalBytes: Number(snapshot.memory.totalBytes || 0),
            usedBytes: Number(snapshot.memory.usedBytes || 0),
            freeBytes: Number(snapshot.memory.freeBytes || 0),
            usedPercent: clampPercent(snapshot.memory.usedPercent),
            source: snapshot.source || 'host-snapshot',
          },
        };
      }
      throw new Error(snapshot.error || 'Host metrics snapshot is invalid');
    } catch (err) {
      throw new Error(`Host system metrics unavailable: ${err.message}`);
    }
  }

  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    source: 'container-os-fallback',
    cpu: {
      usagePercent: await getOsCpuUsagePercent(),
      logicalCores: os.cpus().length,
    },
    memory: {
      totalBytes: total,
      usedBytes: used,
      freeBytes: free,
      usedPercent: total > 0 ? (used / total) * 100 : 0,
      source: 'container-os-fallback',
    },
  };
}

function parseDfOutput(stdout, targetPath) {
  const lines = stdout.trim().split(/\r?\n/);
  const line = lines[lines.length - 1] || '';
  const parts = line.split(/\s+/);
  if (parts.length < 6) throw new Error('Unexpected df output');

  const total = Number(parts[1]) * 1024;
  const used = Number(parts[2]) * 1024;
  const free = Number(parts[3]) * 1024;
  return {
    path: targetPath,
    filesystem: parts[0],
    totalBytes: total,
    usedBytes: used,
    freeBytes: free,
    usedPercent: total > 0 ? (used / total) * 100 : 0,
    mount: parts.slice(5).join(' '),
  };
}

async function getWindowsDiskUsage(targetPath) {
  const root = path.parse(targetPath).root.replace(/\\$/, '');
  const driveName = root.replace(':', '');
  const command = [
    '$drive = Get-PSDrive -Name',
    `'${driveName.replace(/'/g, "''")}'`,
    '; [pscustomobject]@{Name=$drive.Name;Used=$drive.Used;Free=$drive.Free;Root=$drive.Root} | ConvertTo-Json -Compress',
  ].join(' ');
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { timeout: 3000 });
  const drive = JSON.parse(stdout);
  const used = Number(drive.Used || 0);
  const free = Number(drive.Free || 0);
  const total = used + free;
  return {
    path: targetPath,
    filesystem: `${drive.Name}:`,
    totalBytes: total,
    usedBytes: used,
    freeBytes: free,
    usedPercent: total > 0 ? (used / total) * 100 : 0,
    mount: drive.Root || root,
  };
}

async function getDiskUsage() {
  const targetPath = process.env.SYSTEM_METRICS_STORAGE_PATH || process.cwd();
  if (process.platform === 'win32') {
    return getWindowsDiskUsage(targetPath);
  }

  const { stdout } = await execFileAsync('df', ['-kP', targetPath], { timeout: 3000 });
  return parseDfOutput(stdout, targetPath);
}

async function getDatabaseInfo() {
  const rows = await query(`
    SELECT current_database() AS name,
           pg_database_size(current_database())::bigint AS size_bytes,
           current_setting('server_version') AS version
  `);
  const row = rows[0] || {};
  return {
    name: row.name || process.env.POSTGRES_DB || 'Unavailable',
    sizeBytes: Number(row.size_bytes || 0),
    version: row.version || 'Unknown',
  };
}

function getEnvironmentInfo() {
  return {
    label: process.env.APP_ENVIRONMENT
      || process.env.NEXT_PUBLIC_ENV_LABEL
      || process.env.NODE_ENV
      || 'development',
    branch: process.env.APP_GIT_BRANCH
      || process.env.GIT_BRANCH
      || process.env.VERCEL_GIT_COMMIT_REF
      || 'local',
    service: process.env.SYSTEM_METRICS_CONTAINER_NAME || os.hostname(),
  };
}

async function ensureActiveUsersTable() {
  if (!activeUsersTableReadyPromise) {
    activeUsersTableReadyPromise = (async () => {
      await mutate(`
      CREATE TABLE IF NOT EXISTS system_active_user_sessions (
        client_key TEXT PRIMARY KEY,
        user_key TEXT NOT NULL,
        username TEXT NOT NULL,
        role TEXT,
        state TEXT NOT NULL DEFAULT 'active',
        last_seen TIMESTAMPTZ NOT NULL
      )
    `);
      await mutate(`
      CREATE INDEX IF NOT EXISTS idx_system_active_user_sessions_last_seen
      ON system_active_user_sessions (last_seen)
    `);
      await mutate(`
      CREATE INDEX IF NOT EXISTS idx_system_active_user_sessions_user_key
      ON system_active_user_sessions (user_key)
    `);
    })().catch((err) => {
      activeUsersTableReadyPromise = null;
      throw err;
    });
  }
  return activeUsersTableReadyPromise;
}

function activeUserKey(user) {
  return String(user?.uid || user?.id || user?.username || 'unknown');
}

function activeClientKey(user, clientId) {
  const userKey = activeUserKey(user);
  const client = String(clientId || 'default').slice(0, 160);
  return `${userKey}:${client}`;
}

function normalizeSessionState(state) {
  return state === 'background' ? 'background' : 'active';
}

async function trackActiveUser(user, state = 'active', clientId = 'default') {
  await ensureActiveUsersTable();
  const userKey = activeUserKey(user);
  const username = String(user?.username || userKey);
  const clientKey = activeClientKey(user, clientId);
  const sessionState = normalizeSessionState(state);
  await mutate(
    `INSERT INTO system_active_user_sessions (client_key, user_key, username, role, state, last_seen)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (client_key)
     DO UPDATE SET username = EXCLUDED.username,
                   user_key = EXCLUDED.user_key,
                   role = EXCLUDED.role,
                   state = EXCLUDED.state,
                   last_seen = EXCLUDED.last_seen`,
    [clientKey, userKey, username, user?.role || null, sessionState]
  );
}

async function removeActiveUser(user, clientId = null) {
  await ensureActiveUsersTable();
  const userKey = activeUserKey(user);
  if (clientId) {
    await mutate('DELETE FROM system_active_user_sessions WHERE client_key = $1', [activeClientKey(user, clientId)]);
    return;
  }
  await mutate('DELETE FROM system_active_user_sessions WHERE user_key = $1', [userKey]);
}

async function getActiveUserMetrics() {
  await ensureActiveUsersTable();
  const activeCutoff = new Date(Date.now() - ACTIVE_USER_WINDOW_MS);
  const backgroundCutoff = new Date(Date.now() - BACKGROUND_USER_WINDOW_MS);
  await mutate(
    `DELETE FROM system_active_user_sessions
     WHERE (state = 'active' AND last_seen < $1)
        OR (state = 'background' AND last_seen < $2)
        OR state NOT IN ('active', 'background')`,
    [activeCutoff, backgroundCutoff]
  );
  const rows = await query(
    `WITH recent AS (
       SELECT user_key, state
       FROM system_active_user_sessions
       WHERE (state = 'active' AND last_seen >= $1)
          OR (state = 'background' AND last_seen >= $2)
     ),
     per_user AS (
       SELECT user_key,
              BOOL_OR(state = 'active') AS has_active,
              BOOL_OR(state = 'background') AS has_background
       FROM recent
       GROUP BY user_key
     )
     SELECT COUNT(*) FILTER (WHERE has_active)::int AS active_count,
            COUNT(*) FILTER (WHERE NOT has_active AND has_background)::int AS background_count,
            COUNT(*)::int AS total_count
     FROM per_user`,
    [activeCutoff, backgroundCutoff]
  );
  const active = Number(rows[0]?.active_count || 0);
  const background = Number(rows[0]?.background_count || 0);
  return {
    active,
    background,
    total: Number(rows[0]?.total_count ?? active + background),
    windowSeconds: Math.round(ACTIVE_USER_WINDOW_MS / 1000),
    activeWindowSeconds: Math.round(ACTIVE_USER_WINDOW_MS / 1000),
    backgroundWindowSeconds: Math.round(BACKGROUND_USER_WINDOW_MS / 1000),
    source: 'session-activity',
  };
}

function historyFilePath() {
  return path.join(
    process.env.SYSTEM_METRICS_HISTORY_DIR || path.join(process.cwd(), '.local-data', 'system-monitoring'),
    'metrics.jsonl'
  );
}

function sampleFromMetrics(metrics) {
  const logicalCores = Math.max(1, Number(metrics?.cpu?.logicalCores || metrics?.container?.cpu?.onlineCpus || 1));
  const containerCpu = nonNegativeNumber(metrics?.cpu?.containerUsagePercent);
  const systemMemoryTotal = Number(metrics?.memory?.system?.totalBytes || metrics?.memory?.totalBytes || 0);
  const containerMemoryUsed = Number(metrics?.memory?.container?.usedBytes || 0);
  const containerMemoryPercent = clampPercent(metrics?.memory?.container?.usedPercent);

  return {
    ts: Date.parse(metrics.timestamp),
    timestamp: metrics.timestamp,
    cpu: {
      system: clampPercent(metrics?.cpu?.systemUsagePercent),
      container: containerCpu,
      containerShare: clampPercent(containerCpu / logicalCores),
    },
    memory: {
      system: clampPercent(metrics?.memory?.system?.usedPercent ?? metrics?.memory?.usedPercent),
      container: containerMemoryPercent,
      containerShare: systemMemoryTotal > 0 ? clampPercent((containerMemoryUsed / systemMemoryTotal) * 100) : 0,
    },
    storage: {
      used: clampPercent(metrics?.storage?.usedPercent),
      freeBytes: Number(metrics?.storage?.freeBytes || 0),
      usedBytes: Number(metrics?.storage?.usedBytes || 0),
      totalBytes: Number(metrics?.storage?.totalBytes || 0),
    },
    users: {
      active: nonNegativeNumber(metrics?.users?.active),
      background: nonNegativeNumber(metrics?.users?.background),
      total: nonNegativeNumber(metrics?.users?.total ?? (
        nonNegativeNumber(metrics?.users?.active) + nonNegativeNumber(metrics?.users?.background)
      )),
    },
  };
}

async function readHistorySamples(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          const sample = JSON.parse(line);
          return Number.isFinite(sample.ts) ? sample : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function aggregateBucket(samples) {
  const count = samples.length || 1;
  const average = (selector) => samples.reduce((sum, sample) => sum + Number(selector(sample) || 0), 0) / count;
  const latest = samples[samples.length - 1] || {};
  return {
    ts: latest.ts,
    timestamp: latest.timestamp,
    cpu: {
      system: average((sample) => sample.cpu?.system),
      container: average((sample) => sample.cpu?.container),
      containerShare: average((sample) => sample.cpu?.containerShare),
    },
    memory: {
      system: average((sample) => sample.memory?.system),
      container: average((sample) => sample.memory?.container),
      containerShare: average((sample) => sample.memory?.containerShare),
    },
    storage: {
      used: average((sample) => sample.storage?.used),
      freeBytes: latest.storage?.freeBytes || 0,
      usedBytes: latest.storage?.usedBytes || 0,
      totalBytes: latest.storage?.totalBytes || 0,
    },
    users: {
      active: average((sample) => sample.users?.active ?? sample.users?.count),
      background: average((sample) => sample.users?.background),
      total: average((sample) => sample.users?.total ?? sample.users?.count),
    },
  };
}

function bucketSamples(samples, bucketMs) {
  const buckets = new Map();
  for (const sample of samples) {
    const key = Math.floor(sample.ts / bucketMs) * bucketMs;
    const bucket = buckets.get(key) || [];
    bucket.push(sample);
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, bucket]) => aggregateBucket(bucket));
}

function buildHistory(samples, now) {
  const sorted = samples
    .filter((sample) => Number.isFinite(sample.ts))
    .sort((a, b) => a.ts - b.ts);
  return {
    current: sorted.filter((sample) => sample.ts >= now - CURRENT_WINDOW_MS),
    day: bucketSamples(sorted.filter((sample) => sample.ts >= now - DAY_WINDOW_MS), DAY_BUCKET_MS),
    week: bucketSamples(sorted.filter((sample) => sample.ts >= now - WEEK_WINDOW_MS), WEEK_BUCKET_MS),
  };
}

async function storeSample(metrics, range = 'all') {
  if (USE_DATABASE_HISTORY) {
    return storeSampleInDatabase(metrics, range);
  }

  const filePath = historyFilePath();
  const sample = sampleFromMetrics(metrics);
  const now = sample.ts;
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  await appendFile(filePath, `${JSON.stringify(sample)}\n`, 'utf8');

  const samples = await readHistorySamples(filePath);
  const retained = samples.filter((row) => row.ts >= now - HISTORY_RETENTION_MS);
  if (retained.length !== samples.length) {
    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, retained.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
    await rename(tmpPath, filePath);
  }

  return buildHistory(retained, now);
}

async function ensureMetricsTable() {
  if (!metricsTableReadyPromise) {
    metricsTableReadyPromise = (async () => {
      await mutate(`
        CREATE TABLE IF NOT EXISTS system_metric_samples (
          id BIGSERIAL PRIMARY KEY,
          sampled_at TIMESTAMPTZ NOT NULL,
          system_cpu_percent DOUBLE PRECISION NOT NULL,
          container_cpu_percent DOUBLE PRECISION NOT NULL,
          container_cpu_share_percent DOUBLE PRECISION NOT NULL,
          system_memory_percent DOUBLE PRECISION NOT NULL,
          container_memory_percent DOUBLE PRECISION NOT NULL,
          container_memory_share_percent DOUBLE PRECISION NOT NULL,
          storage_used_percent DOUBLE PRECISION NOT NULL,
          storage_free_bytes BIGINT NOT NULL,
          storage_used_bytes BIGINT NOT NULL,
          storage_total_bytes BIGINT NOT NULL,
          active_user_count INTEGER NOT NULL DEFAULT 0,
          background_user_count INTEGER NOT NULL DEFAULT 0,
          total_user_count INTEGER NOT NULL DEFAULT 0,
          source_system TEXT NOT NULL,
          source_container TEXT NOT NULL,
          raw JSONB NOT NULL
        )
      `);
      await mutate(`
        ALTER TABLE system_metric_samples
        ADD COLUMN IF NOT EXISTS active_user_count INTEGER NOT NULL DEFAULT 0
      `);
      await mutate(`
        ALTER TABLE system_metric_samples
        ADD COLUMN IF NOT EXISTS background_user_count INTEGER NOT NULL DEFAULT 0
      `);
      await mutate(`
        ALTER TABLE system_metric_samples
        ADD COLUMN IF NOT EXISTS total_user_count INTEGER NOT NULL DEFAULT 0
      `);
      await mutate(`
        UPDATE system_metric_samples
        SET total_user_count = active_user_count + background_user_count
        WHERE total_user_count = 0
          AND (active_user_count > 0 OR background_user_count > 0)
      `);
      await mutate(`
        CREATE INDEX IF NOT EXISTS idx_system_metric_samples_sampled_at
        ON system_metric_samples (sampled_at)
      `);
    })().catch((err) => {
      metricsTableReadyPromise = null;
      throw err;
    });
  }
  return metricsTableReadyPromise;
}

function dbRowUserCounts(row) {
  const active = nonNegativeNumber(row.active_user_count);
  const background = nonNegativeNumber(row.background_user_count);
  const total = nonNegativeNumber(row.total_user_count);
  return {
    active,
    background,
    total: total || active + background,
  };
}

function dbRowToSample(row) {
  const ts = row.sampled_at instanceof Date
    ? row.sampled_at.getTime()
    : Date.parse(row.sampled_at);
  const timestamp = row.sampled_at instanceof Date
    ? row.sampled_at.toISOString()
    : new Date(ts).toISOString();

  return {
    ts,
    timestamp,
    cpu: {
      system: Number(row.system_cpu_percent || 0),
      container: Number(row.container_cpu_percent || 0),
      containerShare: Number(row.container_cpu_share_percent || 0),
    },
    memory: {
      system: Number(row.system_memory_percent || 0),
      container: Number(row.container_memory_percent || 0),
      containerShare: Number(row.container_memory_share_percent || 0),
    },
    storage: {
      used: Number(row.storage_used_percent || 0),
      freeBytes: Number(row.storage_free_bytes || 0),
      usedBytes: Number(row.storage_used_bytes || 0),
      totalBytes: Number(row.storage_total_bytes || 0),
    },
    users: dbRowUserCounts(row),
  };
}

function dbBucketRowToSample(row) {
  const ts = Number(row.bucket_ms || 0);
  return {
    ts,
    timestamp: new Date(ts).toISOString(),
    cpu: {
      system: Number(row.system_cpu_percent || 0),
      container: Number(row.container_cpu_percent || 0),
      containerShare: Number(row.container_cpu_share_percent || 0),
    },
    memory: {
      system: Number(row.system_memory_percent || 0),
      container: Number(row.container_memory_percent || 0),
      containerShare: Number(row.container_memory_share_percent || 0),
    },
    storage: {
      used: Number(row.storage_used_percent || 0),
      freeBytes: Number(row.storage_free_bytes || 0),
      usedBytes: Number(row.storage_used_bytes || 0),
      totalBytes: Number(row.storage_total_bytes || 0),
    },
    users: dbRowUserCounts(row),
  };
}

async function storeSampleInDatabase(metrics, range = 'all') {
  const sample = sampleFromMetrics(metrics);
  const sampledAt = new Date(sample.ts);
  await ensureMetricsTable();
  await mutate(
    `INSERT INTO system_metric_samples (
       sampled_at,
       system_cpu_percent,
       container_cpu_percent,
       container_cpu_share_percent,
       system_memory_percent,
       container_memory_percent,
       container_memory_share_percent,
       storage_used_percent,
       storage_free_bytes,
       storage_used_bytes,
       storage_total_bytes,
       active_user_count,
       background_user_count,
       total_user_count,
       source_system,
       source_container,
       raw
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb
     )`,
    [
      sampledAt,
      sample.cpu.system,
      sample.cpu.container,
      sample.cpu.containerShare,
      sample.memory.system,
      sample.memory.container,
      sample.memory.containerShare,
      sample.storage.used,
      sample.storage.freeBytes,
      sample.storage.usedBytes,
      sample.storage.totalBytes,
      sample.users.active,
      sample.users.background,
      sample.users.total,
      metrics.sources?.system || 'unknown',
      metrics.sources?.container || 'unknown',
      JSON.stringify(metrics),
    ]
  );
  await mutate('DELETE FROM system_metric_samples WHERE sampled_at < $1', [
    new Date(sample.ts - HISTORY_RETENTION_MS),
  ]);
  return readRequestedHistoryFromDatabase(sample.ts, range);
}

async function readHistoryFromDatabase(now) {
  await ensureMetricsTable();
  const rows = await query(
    `SELECT sampled_at,
            system_cpu_percent,
            container_cpu_percent,
            container_cpu_share_percent,
            system_memory_percent,
            container_memory_percent,
            container_memory_share_percent,
            storage_used_percent,
            storage_free_bytes,
            storage_used_bytes,
            storage_total_bytes,
            active_user_count,
            background_user_count,
            total_user_count
     FROM system_metric_samples
     WHERE sampled_at >= $1
     ORDER BY sampled_at ASC`,
    [new Date(now - WEEK_WINDOW_MS)]
  );
  return buildHistory(rows.map(dbRowToSample), now);
}

function selectedHistoryRange(request) {
  const range = request.nextUrl.searchParams.get('range');
  return ['current', 'day', 'week', 'all'].includes(range) ? range : 'all';
}

async function readCurrentHistoryFromDatabase(now) {
  await ensureMetricsTable();
  const rows = await query(
    `SELECT sampled_at,
            system_cpu_percent,
            container_cpu_percent,
            container_cpu_share_percent,
            system_memory_percent,
            container_memory_percent,
            container_memory_share_percent,
            storage_used_percent,
            storage_free_bytes,
            storage_used_bytes,
            storage_total_bytes,
            active_user_count,
            background_user_count,
            total_user_count
     FROM system_metric_samples
     WHERE sampled_at >= $1
     ORDER BY sampled_at ASC`,
    [new Date(now - CURRENT_WINDOW_MS)]
  );
  return rows.map(dbRowToSample);
}

async function readBucketedHistoryFromDatabase(now, windowMs, bucketMs) {
  await ensureMetricsTable();
  const rows = await query(
    `WITH bucketed AS (
       SELECT FLOOR(EXTRACT(EPOCH FROM sampled_at) * 1000 / $2) * $2 AS bucket_ms,
              sampled_at,
              system_cpu_percent,
              container_cpu_percent,
              container_cpu_share_percent,
              system_memory_percent,
              container_memory_percent,
              container_memory_share_percent,
              storage_used_percent,
              storage_free_bytes,
              storage_used_bytes,
              storage_total_bytes,
              active_user_count,
              background_user_count,
              total_user_count
       FROM system_metric_samples
       WHERE sampled_at >= $1
     )
     SELECT bucket_ms,
            AVG(system_cpu_percent) AS system_cpu_percent,
            AVG(container_cpu_percent) AS container_cpu_percent,
            AVG(container_cpu_share_percent) AS container_cpu_share_percent,
            AVG(system_memory_percent) AS system_memory_percent,
            AVG(container_memory_percent) AS container_memory_percent,
            AVG(container_memory_share_percent) AS container_memory_share_percent,
            AVG(storage_used_percent) AS storage_used_percent,
            (ARRAY_AGG(storage_free_bytes ORDER BY sampled_at DESC))[1] AS storage_free_bytes,
            (ARRAY_AGG(storage_used_bytes ORDER BY sampled_at DESC))[1] AS storage_used_bytes,
            (ARRAY_AGG(storage_total_bytes ORDER BY sampled_at DESC))[1] AS storage_total_bytes,
            AVG(active_user_count) AS active_user_count,
            AVG(background_user_count) AS background_user_count,
            AVG(total_user_count) AS total_user_count
     FROM bucketed
     GROUP BY bucket_ms
     ORDER BY bucket_ms ASC`,
    [new Date(now - windowMs), bucketMs]
  );
  return rows.map(dbBucketRowToSample);
}

async function readRequestedHistoryFromDatabase(now, range) {
  const history = {
    current: await readCurrentHistoryFromDatabase(now),
    day: [],
    week: [],
  };

  if (range === 'day' || range === 'all') {
    history.day = await readBucketedHistoryFromDatabase(now, DAY_WINDOW_MS, DAY_BUCKET_MS);
  }
  if (range === 'week' || range === 'all') {
    history.week = await readBucketedHistoryFromDatabase(now, WEEK_WINDOW_MS, WEEK_BUCKET_MS);
  }

  return history;
}

async function readLatestMetricsFromDatabase(now) {
  await ensureMetricsTable();
  const rows = await query(
    `SELECT sampled_at, raw
     FROM system_metric_samples
     ORDER BY sampled_at DESC
     LIMIT 1`
  );
  if (!rows.length) {
    throw new Error('No system metric samples are available yet');
  }

  const sampledAt = rows[0].sampled_at instanceof Date
    ? rows[0].sampled_at
    : new Date(rows[0].sampled_at);
  const ageMs = now - sampledAt.getTime();
  if (!Number.isFinite(ageMs) || ageMs > LATEST_SAMPLE_MAX_AGE_MS) {
    throw new Error(`Latest system metric sample is stale (${Math.round(ageMs / 1000)}s old)`);
  }

  const raw = rows[0].raw || {};
  return {
    ...raw,
    accuracy: {
      ...(raw.accuracy || {}),
      latestSampleAgeMs: ageMs,
    },
  };
}

export async function GET(request) {
  try {
    await requireRole(['manager', 'admin'], request);
    const shouldRecord = request.nextUrl.searchParams.get('record') === '1';
    const range = selectedHistoryRange(request);

    if (!shouldRecord && USE_DATABASE_HISTORY) {
      const now = Date.now();
      const [metrics, history, users] = await Promise.all([
        readLatestMetricsFromDatabase(now),
        readRequestedHistoryFromDatabase(now, range),
        getActiveUserMetrics(),
      ]);
      return NextResponse.json({ ...metrics, users, history });
    }

    const [container, system, storage, database, users] = await Promise.all([
      getContainerMetrics(),
      getSystemMetrics(),
      getDiskUsage(),
      getDatabaseInfo(),
      getActiveUserMetrics(),
    ]);

    const cpu = {
      usagePercent: system.cpu.usagePercent,
      systemUsagePercent: system.cpu.usagePercent,
      containerUsagePercent: container.cpu.usagePercent,
      logicalCores: system.cpu.logicalCores || os.cpus().length,
      model: os.cpus()[0]?.model || 'Unknown CPU',
    };

    const memory = {
      ...system.memory,
      system: system.memory,
      container: container.memory,
    };

    const metrics = {
      timestamp: new Date().toISOString(),
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()}`,
      uptimeSeconds: os.uptime(),
      sources: {
        system: system.source,
        container: container.source,
      },
      accuracy: {
        systemIncludesContainer: true,
        containerCpuIsRawDockerPercent: true,
        containerCpuShareIsNormalizedToPcCapacity: true,
        containerMemoryMatchesDockerStatsWorkingSet: true,
        hostSnapshotAgeMs: system.ageMs ?? null,
      },
      cpu,
      memory,
      container,
      system,
      storage,
      database,
      users,
      environment: getEnvironmentInfo(),
    };

    const history = shouldRecord
      ? await storeSample(metrics, range)
      : await readRequestedHistoryFromDatabase(Date.parse(metrics.timestamp), range);
    return NextResponse.json({ ...metrics, history });
  } catch (err) {
    if (err?.unauthorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (err?.forbidden) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[system-metrics] unavailable:', err);
    return NextResponse.json({
      error: 'System metrics unavailable',
      detail: err?.message || 'Unknown system metrics error',
    }, { status: 503 });
  }
}

export async function POST(request) {
  try {
    const user = await requireRole(['manager', 'admin'], request);
    const body = await request.json().catch(() => ({}));
    const clientId = body?.clientId || body?.client_id || null;
    const state = body?.state === 'background' ? 'background' : 'active';

    if (body?.active === false || body?.state === 'closed') {
      await removeActiveUser(user, clientId);
    } else {
      await trackActiveUser(user, state, clientId);
    }

    return NextResponse.json({ users: await getActiveUserMetrics() });
  } catch (err) {
    if (err?.unauthorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (err?.forbidden) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[system-metrics] active user update failed:', err);
    return NextResponse.json({
      error: 'System metrics unavailable',
      detail: err?.message || 'Unknown active user tracking error',
    }, { status: 503 });
  }
}
