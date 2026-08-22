/**
 * EduMantra – Supabase Migration Runner
 * Connects via Supabase's direct Postgres connection (port 5432 / 6543)
 * and runs the full schema SQL.
 *
 * Usage:  node scripts/migrate.js
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Supabase direct DB connection string format:
//   postgresql://postgres:[SERVICE_ROLE_KEY]@db.[PROJECT_REF].supabase.co:5432/postgres
// BUT for pooled connections use port 6543 with transaction mode.
// We derive these from env vars.

const projectRef = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];

// Supabase DB password = service role JWT (for direct connections it uses the DB password
// set in Supabase dashboard — we need to prompt or read from env)
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY;

const connectionConfig = {
  host:     `db.${projectRef}.supabase.co`,
  port:     5432,
  database: 'postgres',
  user:     'postgres',
  password: DB_PASSWORD,
  ssl:      { rejectUnauthorized: false },
};

const SQL_FILE = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');

async function run() {
  console.log(`\n🔗 Connecting to Supabase Postgres at db.${projectRef}.supabase.co…`);

  const client = new Client(connectionConfig);

  try {
    await client.connect();
    console.log('✅ Connected!\n');

    const sql = fs.readFileSync(SQL_FILE, 'utf-8');

    console.log('🚀 Running migration: 001_initial_schema.sql');
    console.log('─'.repeat(60));

    await client.query(sql);

    console.log('\n✅ Migration completed successfully!');
    console.log('─'.repeat(60));
    console.log('\nTables created:');
    const { rows } = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    rows.forEach(r => console.log(`  ✓ ${r.tablename}`));

    console.log('\nCustom types created:');
    const { rows: types } = await client.query(`
      SELECT typname FROM pg_type
      WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND typtype = 'e'
      ORDER BY typname;
    `);
    types.forEach(t => console.log(`  ✓ ${t.typname}`));

  } catch (err) {
    console.error('\n❌ Migration failed:');
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.error('  Could not connect. Check SUPABASE_DB_PASSWORD in your .env');
      console.error(`  Expected: db.${projectRef}.supabase.co:5432`);
    } else if (err.message.includes('already exists')) {
      console.error('  Some objects already exist — migration may have partially run before.');
      console.error('  Run the idempotent SQL manually in Supabase SQL Editor.');
    } else {
      console.error(' ', err.message);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
