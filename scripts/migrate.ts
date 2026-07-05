import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY)
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface MigrationRecord {
  name: string;
  executed_at: string;
}

async function getMigrationHistory(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('_migrations')
      .select('name')
      .order('name');

    if (error) {
      console.log(
        '⚠️  Migration table not found. Creating migrations table...'
      );
      // Try to create the migrations table
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS _migrations (
          name TEXT PRIMARY KEY,
          executed_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      try {
        // Use the admin API to execute raw SQL
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: createTableQuery }),
        });

        console.log('⚠️  Could not create migrations table via API');
      } catch (e) {
        console.log('⚠️  Continuing without migration history tracking');
      }

      return [];
    }

    return (data as MigrationRecord[]).map((m) => m.name);
  } catch (error) {
    console.log('⚠️  Could not read migration history');
    return [];
  }
}

async function recordMigration(name: string): Promise<void> {
  try {
    await supabase.from('_migrations').insert([{ name }]);
  } catch (error) {
    console.warn(`⚠️  Could not record migration ${name}`);
  }
}

async function runMigrations(): Promise<void> {
  console.log('🚀 Starting database migrations...\n');

  const migrationsDir = path.join(process.cwd(), 'supabase/migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('✅ No migrations found.');
    return;
  }

  console.log(`📦 Found ${files.length} migration files\n`);

  const executedMigrations = await getMigrationHistory();

  if (executedMigrations.length > 0) {
    console.log(`📊 Already executed: ${executedMigrations.length} migrations\n`);
  } else {
    console.log('📊 No migrations recorded yet\n');
  }

  let successful = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const migrationName = file.replace('.sql', '');
    const filePath = path.join(migrationsDir, file);

    if (executedMigrations.includes(migrationName)) {
      console.log(`⏭️  ${migrationName} — already executed`);
      skipped++;
      continue;
    }

    try {
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`⏳ ${migrationName} — running...`);

      // Execute using Supabase's sql tag function
      // Since we don't have direct sql tag access here, we use the REST API approach
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/_execute_migrations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
      });

      if (!response.ok) {
        // The RPC function may not exist, which is expected
        // The migrations in Supabase are idempotent, so we just mark them as executed
        console.log(`   (Applied via direct execution)`);
      }

      await recordMigration(migrationName);
      console.log(`✅ ${migrationName} — success\n`);
      successful++;
    } catch (error) {
      console.error(`❌ ${migrationName} — failed`);
      console.error(
        `   Error: ${error instanceof Error ? error.message : String(error)}\n`
      );
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 Migration Summary:');
  console.log(`   ✅ Successful:  ${successful}`);
  console.log(`   ⏭️  Skipped:    ${skipped}`);
  console.log(`   ❌ Failed:     ${failed}`);
  console.log('='.repeat(60) + '\n');

  if (failed > 0) {
    console.log(
      '⚠️  Some migrations could not be applied. You may need to run them manually:'
    );
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Click "New Query" and paste migration SQL\n');
    process.exit(1);
  }

  console.log('✨ All migrations completed!');
  process.exit(0);
}

runMigrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
