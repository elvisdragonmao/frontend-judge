import pg from "pg";
import { config } from "../config.js";

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
});

/** Run a query and return rows */
export async function query<
  T extends pg.QueryResultRow = Record<string, unknown>,
>(text: string, params?: unknown[]): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

/** Run a query and return a single row or null */
export async function queryOne<
  T extends pg.QueryResultRow = Record<string, unknown>,
>(text: string, params?: unknown[]): Promise<T | null> {
  const result = await pool.query<T>(text, params);
  return result.rows[0] ?? null;
}

/** Run a query and return all rows */
export async function queryMany<
  T extends pg.QueryResultRow = Record<string, unknown>,
>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

/** Run a transaction */
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
