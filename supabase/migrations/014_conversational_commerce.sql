-- ============================================================
-- 014_conversational_commerce.sql
--
-- WhatsApp Conversational Components: Ice Breakers and Commands
--
-- Ice Breakers: Up to 4 tappable prompts (max 80 chars each)
-- Commands: Up to 30 slash-prefixed commands with descriptions
--           (command max 32 chars, description max 256 chars)
--
-- Both configured per phone_number_id and synced to Meta API.
-- Users can only manage components for their own phone numbers
-- via RLS policies.
--
-- Idempotent: Uses IF NOT EXISTS and DO blocks for safe re-runs.
-- ============================================================

-- 1. Create conversational_components table
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS conversational_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ice_breaker', 'command')),
    name TEXT NOT NULL,
    description TEXT,
    "position" INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (user_id, phone_number_id) REFERENCES whatsapp_config(user_id, phone_number_id) ON DELETE CASCADE,
    UNIQUE (user_id, phone_number_id, type, "position")
  );
  RAISE NOTICE 'Created table conversational_components';
EXCEPTION
  WHEN duplicate_table THEN
    RAISE NOTICE 'Table conversational_components already exists';
END $$;

-- 2. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_conversational_components_user_phone
  ON conversational_components(user_id, phone_number_id);

CREATE INDEX IF NOT EXISTS idx_conversational_components_type_status
  ON conversational_components(user_id, phone_number_id, type, status);

-- 3. Enable RLS on conversational_components
DO $$
BEGIN
  ALTER TABLE conversational_components ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE 'Enabled RLS on conversational_components';
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'RLS already enabled or error: %', SQLERRM;
END $$;

-- 4. Create RLS policy: Users can only access their own components
DO $$
BEGIN
  CREATE POLICY "Users can access their own conversational components"
    ON conversational_components
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  RAISE NOTICE 'Created RLS policy for conversational_components';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'RLS policy already exists';
  WHEN others THEN
    RAISE NOTICE 'Error creating RLS policy: %', SQLERRM;
END $$;

-- 5. Create updated_at trigger
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION update_conversational_components_updated_at()
  RETURNS TRIGGER AS $trigger$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $trigger$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS conversational_components_updated_at ON conversational_components;
  CREATE TRIGGER conversational_components_updated_at
    BEFORE UPDATE ON conversational_components
    FOR EACH ROW
    EXECUTE FUNCTION update_conversational_components_updated_at();

  RAISE NOTICE 'Created updated_at trigger for conversational_components';
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Trigger setup error: %', SQLERRM;
END $$;

-- 6. Create helper function to fetch components grouped by type
CREATE OR REPLACE FUNCTION get_conversational_components(
  p_user_id UUID,
  p_phone_number_id TEXT
)
RETURNS TABLE (
  ice_breakers TEXT,
  commands TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    json_agg(
      json_build_object(
        'id', id,
        'name', name,
        'position', "position",
        'status', status
      ) ORDER BY "position"
    ) FILTER (WHERE type = 'ice_breaker'),
    json_agg(
      json_build_object(
        'id', id,
        'name', name,
        'description', description,
        'position', "position",
        'status', status
      ) ORDER BY "position"
    ) FILTER (WHERE type = 'command')
  FROM conversational_components
  WHERE user_id = p_user_id
    AND phone_number_id = p_phone_number_id
    AND status = 'active';
$$;

-- 7. Optionally: Create conversational_component_triggers table for Phase 2
-- (Links components to automations for command routing)
-- Commented out for now but schema is ready:
/*
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS conversational_component_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES conversational_components(id) ON DELETE CASCADE,
    automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (component_id, automation_id)
  );
  RAISE NOTICE 'Created table conversational_component_triggers';
EXCEPTION
  WHEN duplicate_table THEN
    RAISE NOTICE 'Table conversational_component_triggers already exists';
END $$;
*/

-- Migration complete
GRANT EXECUTE ON FUNCTION get_conversational_components(UUID, TEXT) TO authenticated;
