import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ConversationalComponent } from '@/types';
import {
  validateIceBreaker,
  validateCommandName,
  validateCommandDescription,
  syncConversationalComponents,
  buildConversationalPayload,
} from '@/lib/whatsapp/conversational-api';

/**
 * GET /api/whatsapp/conversational
 *
 * Fetch current ice breakers and commands from database
 *
 * Query params:
 *   phone_number_id: string (required)
 *
 * Returns: { ice_breakers: ConversationalComponent[], commands: ConversationalComponent[], sync_status: string }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get phone_number_id from query params
    const phoneNumberId = request.nextUrl.searchParams.get('phone_number_id');
    if (!phoneNumberId) {
      return NextResponse.json(
        { error: 'phone_number_id query parameter required' },
        { status: 400 }
      );
    }

    // Verify user owns this phone number
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('id')
      .eq('user_id', user.id)
      .eq('phone_number_id', phoneNumberId)
      .maybeSingle();

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp config not found or unauthorized' },
        { status: 404 }
      );
    }

    // Fetch components
    const { data: components, error: fetchError } = await supabase
      .from('conversational_components')
      .select('*')
      .eq('user_id', user.id)
      .eq('phone_number_id', phoneNumberId)
      .eq('status', 'active')
      .order('position', { ascending: true });

    if (fetchError) {
      console.error('Database error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch components' },
        { status: 500 }
      );
    }

    const ice_breakers = (components || []).filter((c) => c.type === 'ice_breaker');
    const commands = (components || []).filter((c) => c.type === 'command');

    return NextResponse.json({
      ice_breakers,
      commands,
      sync_status: 'synced',
      component_count: {
        ice_breakers: ice_breakers.length,
        commands: commands.length,
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/whatsapp/conversational/sync
 *
 * Sync ice breakers and commands to Meta Conversational Automation API
 *
 * Body:
 * {
 *   phone_number_id: string,
 *   ice_breakers: string[],
 *   commands: Array<{ command_name: string, command_description: string }>
 * }
 *
 * Returns: { success: boolean, message?: string, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { phone_number_id, ice_breakers = [], commands = [] } = body;

    if (!phone_number_id) {
      return NextResponse.json(
        { error: 'phone_number_id is required' },
        { status: 400 }
      );
    }

    // Validate constraints
    if (ice_breakers.length > 4) {
      return NextResponse.json(
        { error: 'Maximum 4 ice breakers allowed' },
        { status: 400 }
      );
    }

    if (commands.length > 30) {
      return NextResponse.json(
        { error: 'Maximum 30 commands allowed' },
        { status: 400 }
      );
    }

    // Validate each ice breaker
    for (const breaker of ice_breakers) {
      const validation = validateIceBreaker(breaker);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Ice breaker validation failed: ${validation.error}` },
          { status: 400 }
        );
      }
    }

    // Validate each command
    for (const cmd of commands) {
      const nameValidation = validateCommandName(cmd.command_name);
      if (!nameValidation.valid) {
        return NextResponse.json(
          { error: `Command name validation failed: ${nameValidation.error}` },
          { status: 400 }
        );
      }

      const descValidation = validateCommandDescription(cmd.command_description);
      if (!descValidation.valid) {
        return NextResponse.json(
          { error: `Command description validation failed: ${descValidation.error}` },
          { status: 400 }
        );
      }
    }

    // Get WhatsApp config (includes access token)
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('phone_number_id', phone_number_id)
      .maybeSingle();

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp config not found' },
        { status: 404 }
      );
    }

    if (!config.access_token) {
      return NextResponse.json(
        { error: 'Access token not configured' },
        { status: 400 }
      );
    }

    // Build payload and call Meta API
    const payload = buildConversationalPayload(ice_breakers, commands);

    const response = await syncConversationalComponents(
      phone_number_id,
      config.access_token,
      payload
    );

    if (!response.success) {
      console.error('Meta API error:', response.error);
      return NextResponse.json(
        {
          success: false,
          error: response.error?.message || 'Failed to sync with Meta API',
        },
        { status: 400 }
      );
    }

    // Mark all as successfully synced (optional: update a sync_status column if added to schema)
    return NextResponse.json({
      success: true,
      message: 'Components synced to WhatsApp',
      synced_count: {
        ice_breakers: ice_breakers.length,
        commands: commands.length,
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
