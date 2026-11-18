import pg from 'pg';
import {POSTGRES_SCHEMA_SQL} from './postgres-schema-sql';
import type {Database,Statement} from './types';

const {Pool} = pg;

export function convertSqliteToPostgres(sql: string): string {
  let paramIndex = 1;
  let inString = false;
  let out = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'") {
      if (inString && sql[i + 1] === "'") {
        out += "''";
        i++;
        continue;
      }
      inString = !inString;
      out += char;
    } else if (char === '?' && !inString) {
      out += '$' + paramIndex++;
    } else {
      out += char;
    }
  }

  // Convert SQLite "INSERT OR IGNORE INTO ..." to PostgreSQL "INSERT INTO ... ON CONFLICT DO NOTHING"
  if (/INSERT\s+OR\s+IGNORE\s+INTO\s+/i.test(out)) {
    out = out.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+/gi, 'INSERT INTO ');
    if (!/ON\s+CONFLICT/i.test(out)) {
      out += ' ON CONFLICT DO NOTHING';
    }
  }

  return out;
}

class PgQuery implements Statement {
  values: any[] = [];
  constructor(public sql: string, private pool: pg.Pool) {}

  bind(...values: any[]) {
    // Sanitize values: replace undefined with null
    this.values = values.map(v => (v === undefined ? null : v));
    return this;
  }

  async first<T = any>(): Promise<T | null> {
    const pgSql = convertSqliteToPostgres(this.sql);
    const res = await this.pool.query(pgSql, this.values);
    return (res.rows[0] as T) || null;
  }

  async all<T = any>(): Promise<{results: T[]}> {
    const pgSql = convertSqliteToPostgres(this.sql);
    const res = await this.pool.query(pgSql, this.values);
    return {results: res.rows as T[]};
  }

  async run(): Promise<{meta: {changes: number}}> {
    const pgSql = convertSqliteToPostgres(this.sql);
    const res = await this.pool.query(pgSql, this.values);
    return {meta: {changes: res.rowCount ?? 0}};
  }

  async executeOnClient(client: pg.PoolClient): Promise<{meta: {changes: number}; results?: any[]}> {
    const pgSql = convertSqliteToPostgres(this.sql);
    const res = await client.query(pgSql, this.values);
    return {meta: {changes: res.rowCount ?? 0}, results: res.rows};
  }
}

export async function openPostgresDatabase(connectionString?: string) {
  const connStr = connectionString || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error('Database connection string is required (POSTGRES_URL or DATABASE_URL).');
  }

  const isLocal = connStr.includes('localhost') || connStr.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: connStr,
    ssl: isLocal ? false : {rejectUnauthorized: false},
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Ensure tables and triggers exist
  const initClient = await pool.connect();
  try {
    const check = await initClient.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
    );
    if (check.rowCount === 0) {
      await initClient.query(POSTGRES_SCHEMA_SQL);
    }
  } finally {
    initClient.release();
  }

  const db: Database = {
    prepare: (sql: string) => new PgQuery(sql, pool),
    batch: async (stmts: Statement[]) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        let lastChanges = 0;
        const results = [];
        for (const s of stmts) {
          // Set loopmarket.changes for changes() function inside statements
          await client.query("SELECT set_config('loopmarket.changes', $1, true)", [String(lastChanges)]);
          const q = s as PgQuery;
          const res = await q.executeOnClient(client);
          lastChanges = res.meta.changes;
          results.push(res);
        }
        await client.query('COMMIT');
        return results;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
  };

  return {
    db,
    pool,
    close: () => pool.end(),
  };
}
