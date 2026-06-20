import pg from 'pg';

const { Pool } = pg;

const globalForPg = globalThis;

function resolveConnectionString() {
  const connectionString = process.env.NETWORK_DATABASE_URL;
  if (!connectionString) {
    throw new Error('[network-workbench/db] NETWORK_DATABASE_URL must be set. Network Workbench never falls back to DATABASE_URL.');
  }
  return connectionString;
}

function getPool() {
  if (!globalForPg.__networkVcodePgPool) {
    globalForPg.__networkVcodePgPool = new Pool({
      connectionString: resolveConnectionString(),
      max: 10,
      idleTimeoutMillis: 30000
    });
  }
  return globalForPg.__networkVcodePgPool;
}

export async function query(text, params = []) {
  try {
    return await getPool().query(text, params);
  } catch (error) {
    throw toDbError(error);
  }
}

export async function transaction(callback) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw toDbError(error);
  } finally {
    client.release();
  }
}

export function toDbError(error) {
  if (error?.status) return error;

  const dbError = new Error(error.message || 'Database error');
  dbError.code = error.code;
  dbError.detail = error.detail;
  dbError.constraint = error.constraint;
  dbError.cause = error;
  return dbError;
}
