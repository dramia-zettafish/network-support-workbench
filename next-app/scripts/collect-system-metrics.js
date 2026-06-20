const crypto = require('crypto');

const baseUrl = process.env.SYSTEM_METRICS_BASE_URL || 'http://nextjs_dev:3000';
const username = process.env.SYSTEM_METRICS_COLLECTOR_USERNAME || 'DEV User';
const role = process.env.SYSTEM_METRICS_COLLECTOR_ROLE || 'manager';
const intervalMs = Math.max(1000, Number(process.env.SYSTEM_METRICS_COLLECTOR_INTERVAL_MS || 1000));
const logIntervalMs = Math.max(5000, Number(process.env.SYSTEM_METRICS_COLLECTOR_LOG_INTERVAL_MS || 30000));
const secret = process.env.SESSION_SECRET;
let lastLogAt = 0;

if (!secret || secret.length < 32) {
  throw new Error('SESSION_SECRET must be set and at least 32 characters');
}

function createSessionCookie() {
  const now = Date.now();
  const payload = {
    uid: 'system-metrics-collector',
    username,
    role,
    iat: now,
    exp: now + Math.max(intervalMs * 6, 60000),
  };
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${Buffer.from(data).toString('base64url')}.${sig}`;
}

async function collectOnce() {
  const res = await fetch(`${baseUrl}/api/system-metrics?record=1&range=current`, {
    headers: {
      Cookie: `eus_session=${createSessionCookie()}`,
      'User-Agent': 'eusupport-system-metrics-collector',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`metrics collection failed: HTTP ${res.status} ${body}`);
  }

  const body = await res.json();
  const now = Date.now();
  if (now - lastLogAt >= logIntervalMs) {
    lastLogAt = now;
    console.log(
      `[metrics] ${body.timestamp} usage=${body.cpu?.systemUsagePercent?.toFixed?.(2)} ` +
      `container=${body.cpu?.containerUsagePercent?.toFixed?.(2)} history=${body.history?.current?.length || 0}`
    );
  }
}

async function loop() {
  for (;;) {
    const startedAt = Date.now();
    try {
      await collectOnce();
    } catch (err) {
      console.error(`[metrics] ${err.message}`);
    }
    const elapsedMs = Date.now() - startedAt;
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, intervalMs - elapsedMs)));
  }
}

loop();
