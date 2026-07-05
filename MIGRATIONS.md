# Database Migrations Guide

This document explains how to apply pending database migrations to your Supabase database.

## Quick Start

### Option 1: Using Supabase CLI (Recommended)

The easiest way to apply migrations:

```bash
# Install Supabase CLI (if not already installed)
npm install -g @supabase/cli

# Link your Supabase project (you'll need your project ref)
supabase link --project-ref <your-project-ref>

# Apply all pending migrations
supabase db push
```

You can find your project ref in your [Supabase dashboard](https://supabase.com/dashboard) under Settings → General.

### Option 2: Using Migration Runner Script

If you prefer an automated Node.js approach:

```bash
# Make sure you have the required environment variables set
# NEXT_PUBLIC_SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY

# Run migrations
npx tsx scripts/migrate.ts
```

### Option 3: Manual Migration via Dashboard

If automated approaches don't work:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor** → **New Query**
4. For each migration file in `supabase/migrations/` (in order):
   - Open the file in your text editor
   - Copy the entire SQL content
   - Paste into the Supabase SQL Editor
   - Click **Run**

## Available Migrations

The following 13 migrations are pending:

| # | Migration | Purpose |
|---|-----------|---------|
| 1 | `001_initial_schema.sql` | Initial database schema setup |
| 2 | `002_pipelines_enhancements.sql` | Sales pipeline enhancements |
| 3 | `003_broadcast_recipient_wamid.sql` | WhatsApp ID tracking for broadcasts |
| 4 | `004_contact_delete_set_null.sql` | Contact deletion cleanup |
| 5 | `005_broadcast_counts_incremental.sql` | Incremental broadcast counter |
| 6 | `006_automations.sql` | Automation framework |
| 7 | `007_automations_increment_counter.sql` | Automation counter |
| 8 | `008_profile_avatars_storage.sql` | Profile avatar storage |
| 9 | `009_message_actions.sql` | Message action tracking |
| 10 | `010_flows.sql` | Flow builder tables |
| 11 | `011_profile_beta_features.sql` | Beta feature flags |
| 12 | `012_flows_increment_counter.sql` | Flow counter |
| 13 | `013_whatsapp_config_phone_number_id_unique.sql` | Unique phone number ID constraint |

## Environment Variables Required

To run migrations programmatically, you need:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (⚠️ Keep this secret!)

These are automatically set if your project is connected to Vercel with Supabase integration.

## Checking Migration Status

After running migrations, you can verify they were applied by:

1. Going to Supabase Dashboard → your project
2. Checking the **SQL Editor** for the new tables and structures
3. Or querying the `_migrations` table (if using the migration runner):
   ```sql
   SELECT name, executed_at FROM _migrations ORDER BY name;
   ```

## Troubleshooting

### "Missing environment variables" error

Make sure you have set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

These should be available in your project settings or `.env.local` / `.env.development.local`.

### "Supabase CLI not found"

Install it globally:
```bash
npm install -g @supabase/cli
```

### "Migrations table doesn't exist"

This is normal on first run. The migration runner will attempt to create it automatically. If it fails, manually create it:

```sql
CREATE TABLE _migrations (
  name TEXT PRIMARY KEY,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Idempotent Migrations

All migrations in this project are **idempotent**, meaning they can be safely run multiple times without causing errors. They use:
- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `DROP ... IF EXISTS` for policies and triggers

This means it's safe to re-run migrations if something fails.

## Database Schema

After migrations are applied, you'll have the following tables:

- `profiles` - User profiles
- `contacts` - CRM contacts
- `messages` - Message history
- `pipelines` - Sales pipelines
- `pipeline_stages` - Pipeline stages
- `broadcasts` - WhatsApp broadcasts
- `automations` - Automation workflows
- `flows` - Flow builder workflows
- `whatsapp_config` - WhatsApp Business API configuration
- And supporting tables for message actions, flow counters, etc.

## Need Help?

- Check [Supabase Documentation](https://supabase.com/docs)
- Review individual migration files in `supabase/migrations/`
- Check your Supabase project logs in the Dashboard

---

**Last Updated**: 2026-07-05  
**Total Migrations**: 13
