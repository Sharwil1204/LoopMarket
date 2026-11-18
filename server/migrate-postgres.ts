import pg from 'pg';
import {readFile} from 'node:fs/promises';

const connStr = process.argv[2] || process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connStr) {
  console.error('Error: Please provide a connection string as argument or set POSTGRES_URL or DATABASE_URL.');
  process.exit(1);
}

const isLocal = connStr.includes('localhost') || connStr.includes('127.0.0.1');
const pool = new pg.Pool({
  connectionString: connStr,
  ssl: isLocal ? false : {rejectUnauthorized: false},
});

console.log('Connecting to PostgreSQL database...');
const client = await pool.connect();
try {
  console.log('Reading schema file server/postgres-schema.sql...');
  const schemaSql = await readFile(new URL('./postgres-schema.sql', import.meta.url), 'utf8');
  console.log('Executing schema migration...');
  await client.query(schemaSql);
  console.log('Schema migration completed successfully! All tables, indexes and triggers are ready.');
} catch (e: any) {
  console.error('Migration failed:', e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
