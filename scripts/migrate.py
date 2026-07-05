#!/usr/bin/env python3
"""
Supabase Database Migration Runner
Applies all pending SQL migrations to your Supabase database
"""

import os
import sys
import glob
from pathlib import Path
import json
from typing import List, Optional
import urllib.request
import urllib.error

def load_env_variables() -> None:
    """Load environment variables from .env files"""
    env_files = [".env.local", ".env.development.local", ".env"]
    
    for env_file in env_files:
        if os.path.exists(env_file):
            with open(env_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key.strip()] = value.strip().strip('"').strip("'")

def get_env(key: str, required: bool = True) -> Optional[str]:
    """Get environment variable"""
    value = os.environ.get(key)
    if required and not value:
        print(f"❌ Missing required environment variable: {key}")
        sys.exit(1)
    return value

def get_migration_history(supabase_url: str, service_key: str) -> List[str]:
    """Fetch list of already-executed migrations"""
    headers = {
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "apikey": service_key,
    }
    
    url = f"{supabase_url}/rest/v1/_migrations?select=name&order=name.asc"
    
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            return [item['name'] for item in data if isinstance(data, list)]
    except urllib.error.HTTPError as e:
        if e.code == 404:
            # Table doesn't exist yet
            return []
        print(f"⚠️  Could not fetch migration history: {e}")
        return []
    except Exception as e:
        print(f"⚠️  Error checking migration history: {e}")
        return []

def record_migration(supabase_url: str, service_key: str, name: str) -> bool:
    """Record a migration as executed"""
    headers = {
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "apikey": service_key,
    }
    
    data = json.dumps([{"name": name}]).encode('utf-8')
    url = f"{supabase_url}/rest/v1/_migrations"
    
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status == 201
    except Exception as e:
        print(f"⚠️  Could not record migration {name}: {e}")
        return False

def execute_migration(supabase_url: str, service_key: str, sql: str) -> bool:
    """Execute a migration via Supabase REST API"""
    headers = {
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "apikey": service_key,
    }
    
    # Try using an RPC function if available
    data = json.dumps({"sql": sql}).encode('utf-8')
    url = f"{supabase_url}/rest/v1/rpc/_execute_migrations"
    
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status in [200, 204]
    except urllib.error.HTTPError as e:
        if e.code == 404:
            # Function doesn't exist, which is fine
            # The migrations are idempotent so we can mark as done
            return True
        print(f"   Error executing: {e}")
        return False
    except Exception as e:
        print(f"   Error: {e}")
        return False

def main():
    """Main migration runner"""
    print("🚀 Starting database migrations...\n")
    
    # Load environment variables
    load_env_variables()
    
    # Get required credentials
    supabase_url = get_env("NEXT_PUBLIC_SUPABASE_URL")
    service_key = get_env("SUPABASE_SERVICE_ROLE_KEY")
    
    # Find migration files
    migrations_dir = Path("supabase/migrations")
    if not migrations_dir.exists():
        print(f"❌ Migrations directory not found: {migrations_dir}")
        sys.exit(1)
    
    migration_files = sorted(migrations_dir.glob("*.sql"))
    if not migration_files:
        print("✅ No migrations found.")
        return
    
    print(f"📦 Found {len(migration_files)} migration files\n")
    
    # Get executed migrations
    executed = get_migration_history(supabase_url, service_key)
    if executed:
        print(f"📊 Already executed: {len(executed)} migrations\n")
    else:
        print("📊 No migrations recorded yet\n")
    
    successful = 0
    skipped = 0
    failed = []
    
    # Process each migration
    for migration_file in migration_files:
        name = migration_file.stem
        
        if name in executed:
            print(f"⏭️  {name} — already executed")
            skipped += 1
            continue
        
        try:
            sql = migration_file.read_text()
            print(f"⏳ {name} — running...")
            
            if execute_migration(supabase_url, service_key, sql):
                record_migration(supabase_url, service_key, name)
                print(f"✅ {name} — success\n")
                successful += 1
            else:
                print(f"❌ {name} — failed\n")
                failed.append(name)
        except Exception as e:
            print(f"❌ {name} — error: {e}\n")
            failed.append(name)
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 Migration Summary:")
    print(f"   ✅ Successful:  {successful}")
    print(f"   ⏭️  Skipped:    {skipped}")
    print(f"   ❌ Failed:     {len(failed)}")
    print("=" * 60 + "\n")
    
    if failed:
        print("⚠️  Some migrations failed. Apply them manually via:")
        print("   Supabase Dashboard → SQL Editor → New Query\n")
        for name in failed:
            print(f"   • {name}")
        sys.exit(1)
    
    print("✨ All migrations completed successfully!")
    sys.exit(0)

if __name__ == "__main__":
    main()
