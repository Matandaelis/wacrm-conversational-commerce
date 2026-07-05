# Migration Runner Setup

I've created multiple migration runner scripts to help you apply your 13 pending database migrations to Supabase. Choose the approach that works best for your setup.

## 🎯 Quick Start (Recommended)

### Using Supabase CLI (Easiest)

```bash
# 1. Install the Supabase CLI globally (one-time)
npm install -g @supabase/cli

# 2. Link your Supabase project
supabase link --project-ref <your-project-ref>

# 3. Push all migrations
supabase db push
```

**Your project ref** is available at: [Supabase Dashboard](https://supabase.com/dashboard) → Settings → General

---

## 📦 Available Migration Runners

### Option 1: TypeScript/Node.js Runner

Run migrations using the Node.js ecosystem (requires TypeScript):

```bash
npx tsx scripts/migrate.ts
```

**Best for**: TypeScript projects, direct Node.js integration
**Requirements**: `@supabase/supabase-js` (already installed)

### Option 2: Shell Script Runner

Run migrations using Bash (requires Supabase CLI):

```bash
chmod +x scripts/migrate.sh
./scripts/migrate.sh
```

**Best for**: CI/CD pipelines, Unix/Linux environments
**Requirements**: Supabase CLI installed globally

### Option 3: Python Runner

Run migrations using Python (no dependencies):

```bash
python3 scripts/migrate.py
```

**Best for**: Systems without Node.js, Python environments
**Requirements**: Python 3.6+

### Option 4: JavaScript/ESM Runner

Run migrations using plain JavaScript:

```bash
node scripts/run-migrations.mjs
```

**Best for**: Quick execution without TypeScript compilation
**Requirements**: Node.js 18+

---

## 🔧 Environment Variables

All automated runners require these environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://abcdef.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role API key (⚠️ Secret!) | Starts with `eyJ...` |

**These are automatically available if:**
- Your Vercel project is connected to Supabase
- You have `.env.local` or `.env.development.local` configured
- You're running in the project directory

---

## 📊 What the Runners Do

All migration runners will:

1. ✅ Check which migrations have already been applied
2. 📝 Execute pending migrations in order (001 → 013)
3. 📋 Track executed migrations in a `_migrations` table
4. 🔄 Skip already-applied migrations (idempotent)
5. 📧 Report summary of successful/failed/skipped migrations

---

## 📋 Migrations to be Applied

Your 13 pending migrations:

1. **001_initial_schema.sql** - Database structure setup
2. **002_pipelines_enhancements.sql** - CRM pipelines
3. **003_broadcast_recipient_wamid.sql** - WhatsApp broadcast tracking
4. **004_contact_delete_set_null.sql** - Referential integrity
5. **005_broadcast_counts_incremental.sql** - Broadcast counters
6. **006_automations.sql** - Automation workflows
7. **007_automations_increment_counter.sql** - Automation counters
8. **008_profile_avatars_storage.sql** - User avatars in Blob storage
9. **009_message_actions.sql** - Message action logging
10. **010_flows.sql** - Flow builder framework
11. **011_profile_beta_features.sql** - Beta feature toggles
12. **012_flows_increment_counter.sql** - Flow counters
13. **013_whatsapp_config_phone_number_id_unique.sql** - WhatsApp webhook routing fix

---

## ✨ Key Features

- **Idempotent**: All migrations use `IF NOT EXISTS` / `IF NOT` patterns - safe to run multiple times
- **Transactional**: Changes are atomic - either fully applied or rolled back
- **Tracked**: Executed migrations are recorded in `_migrations` table to prevent re-running
- **Comprehensive**: Covers all features from profiles → messages → automations → flows

---

## 🐛 Troubleshooting

### "Missing environment variables" error

**Solution**: Set these in your `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get these from: [Supabase Dashboard](https://supabase.com/dashboard) → Settings → API

### "Cannot find migrations table"

**Solution**: This is normal on first run. The runners will attempt to create it automatically.

### "Failed to apply migrations"

**Solution**: Apply them manually via Supabase Dashboard:
1. Go to **SQL Editor** → **New Query**
2. Copy/paste each migration file in order
3. Click **Run**

### "Migrations still not applying?"

Try the browser-based approach:
```bash
# This opens your Supabase project in the browser
open https://supabase.com/dashboard
```

Then:
1. Navigate to **SQL Editor**
2. Click **New Query**
3. Paste migration SQL and execute

---

## 📝 For More Information

- See **MIGRATIONS.md** for detailed migration information
- See individual files in `supabase/migrations/` for migration details
- Check [Supabase Documentation](https://supabase.com/docs)

---

## ✅ After Migrations Complete

Once migrations are applied:

1. Your database will have all required tables and constraints
2. WhatsApp webhook routing will work properly (unique phone number IDs)
3. CRM features (contacts, pipelines, broadcasts) will be functional
4. Automations and flows will be operational
5. User management and team features will be ready

**Next steps**: Start the dev server and test the application:
```bash
npm run dev
```

---

**Created**: 2026-07-05  
**Total Migrations**: 13  
**Migration Files**: Idempotent SQL (safe to re-run)

