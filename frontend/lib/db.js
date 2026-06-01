import pg from 'pg';

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  'postgresql://user:password@db:5432/tickets';

const globalForPg = globalThis;

export const pool =
  globalForPg.__networkVcodePgPool ||
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPg.__networkVcodePgPool = pool;
}

export async function query(text, params = []) {
  try {
    return await pool.query(text, params);
  } catch (error) {
    throw toDbError(error);
  }
}

export async function transaction(callback) {
  const client = await pool.connect();

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
