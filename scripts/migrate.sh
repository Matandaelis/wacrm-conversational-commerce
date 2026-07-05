#!/bin/bash

# Supabase Database Migration Runner
# This script applies all pending migrations to your Supabase database

set -e

# Load environment variables
if [ -f ".env.local" ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

if [ -f ".env.development.local" ]; then
  export $(cat .env.development.local | grep -v '^#' | xargs)
fi

# Check for required environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ Missing NEXT_PUBLIC_SUPABASE_URL environment variable"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable"
  exit 1
fi

echo "🚀 Starting database migrations..."
echo ""

# Find and list all migration files
MIGRATIONS_DIR="supabase/migrations"
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "❌ Migrations directory not found: $MIGRATIONS_DIR"
  exit 1
fi

# Get list of migration files
MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -name "*.sql" | sort)
MIGRATION_COUNT=$(echo "$MIGRATION_FILES" | wc -l)

echo "📦 Found $MIGRATION_COUNT migration files"
echo ""

# Create a temporary file to store the combined SQL
COMBINED_SQL="/tmp/migrations_$(date +%s).sql"
cat > "$COMBINED_SQL" << 'EOF'
-- Start of migrations
EOF

# Append all migration files
for migration_file in $MIGRATION_FILES; do
  echo "-- Migration: $(basename $migration_file)" >> "$COMBINED_SQL"
  cat "$migration_file" >> "$COMBINED_SQL"
  echo "" >> "$COMBINED_SQL"
done

echo "📝 Combined migrations into temporary file"
echo ""

# Execute migrations using curl and Supabase REST API
echo "⏳ Applying migrations..."

# For best results, use the Supabase CLI if installed
if command -v supabase &> /dev/null; then
  echo "✅ Supabase CLI detected, using it to apply migrations"
  cd "$(dirname "$0")/.."
  supabase db push --linked --dry-run=false 2>&1 || {
    echo "❌ Failed to apply migrations via Supabase CLI"
    rm -f "$COMBINED_SQL"
    exit 1
  }
else
  echo "⚠️  Supabase CLI not found. Using REST API approach..."
  
  # Try using curl to execute migrations
  # Note: This approach has limitations with complex multi-statement SQL
  
  # For now, provide instructions
  echo ""
  echo "To apply these migrations, please:"
  echo "1. Install Supabase CLI: npm install -g @supabase/cli"
  echo "2. Link your project: supabase link --project-ref <project-ref>"
  echo "3. Run migrations: supabase db push"
  echo ""
  echo "Or manually in Supabase dashboard:"
  echo "1. Go to SQL Editor"
  echo "2. Create a new query"
  echo "3. Copy the contents of: $COMBINED_SQL"
  echo ""
  rm -f "$COMBINED_SQL"
  exit 1
fi

# Cleanup
rm -f "$COMBINED_SQL"

echo ""
echo "✨ All migrations completed successfully!"
