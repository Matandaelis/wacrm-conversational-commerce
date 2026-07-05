/**
 * conversational-api.ts
 *
 * Utility functions for Meta's WhatsApp Conversational Automation API.
 * Handles syncing ice breakers and commands to Meta's platform.
 *
 * API Reference:
 * POST /{PHONE_NUMBER_ID}/conversational_automation
 */

export interface ConversationalAutomationPayload {
  prompts?: string[];
  commands?: Array<{
    command_name: string;
    command_description: string;
  }>;
}

export interface ConversationalApiResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    code?: string;
    type?: string;
  };
}

/**
 * Validate ice breaker text
 * - Max 80 chars
 * - No emojis or special characters (alphanumeric, spaces, punctuation only)
 */
export function validateIceBreaker(text: string): {
  valid: boolean;
  error?: string;
} {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Ice breaker cannot be empty' };
  }

  if (text.length > 80) {
    return { valid: false, error: 'Ice breaker must be 80 characters or less' };
  }

  if (hasEmoji(text)) {
    return { valid: false, error: 'Emojis are not allowed' };
  }

  return { valid: true };
}

/**
 * Validate command name (without the / prefix)
 * - Max 32 chars
 * - Alphanumeric and underscore only
 * - No emojis
 */
export function validateCommandName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Command name cannot be empty' };
  }

  if (name.length > 32) {
    return { valid: false, error: 'Command name must be 32 characters or less' };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    return {
      valid: false,
      error: 'Command name can only contain letters, numbers, and underscores',
    };
  }

  if (hasEmoji(name)) {
    return { valid: false, error: 'Emojis are not allowed' };
  }

  return { valid: true };
}

/**
 * Validate command description
 * - Max 256 chars
 * - No emojis
 */
export function validateCommandDescription(desc: string): {
  valid: boolean;
  error?: string;
} {
  if (!desc || desc.trim().length === 0) {
    return { valid: false, error: 'Command description cannot be empty' };
  }

  if (desc.length > 256) {
    return {
      valid: false,
      error: 'Command description must be 256 characters or less',
    };
  }

  if (hasEmoji(desc)) {
    return { valid: false, error: 'Emojis are not allowed' };
  }

  return { valid: true };
}

/**
 * Simple emoji detection using Unicode ranges
 * More comprehensive than just checking for specific characters
 */
export function hasEmoji(text: string): boolean {
  const emojiRegex =
    /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
  return emojiRegex.test(text);
}

/**
 * Build payload for Meta Conversational Automation API
 */
export function buildConversationalPayload(
  ice_breakers: string[],
  commands: Array<{
    command_name: string;
    command_description: string;
  }>
): ConversationalAutomationPayload {
  return {
    prompts: ice_breakers && ice_breakers.length > 0 ? ice_breakers : undefined,
    commands: commands && commands.length > 0 ? commands : undefined,
  };
}

/**
 * Call Meta's Conversational Automation API to sync ice breakers and commands
 *
 * @param phoneNumberId - The WhatsApp phone number ID
 * @param accessToken - The WhatsApp API access token
 * @param payload - The ice breakers and commands payload
 * @returns API response with success status
 */
export async function syncConversationalComponents(
  phoneNumberId: string,
  accessToken: string,
  payload: ConversationalAutomationPayload
): Promise<ConversationalApiResponse> {
  try {
    const url = `https://graph.instagram.com/v18.0/${phoneNumberId}/conversational_automation`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: {
          message: data.error?.message || 'Unknown API error',
          code: data.error?.code,
          type: data.error?.type,
        },
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

/**
 * Detect if a message is from an ice breaker or command
 * Returns null if neither matches
 */
export function detectComponentSource(
  messageText: string,
  ice_breakers: string[],
  commands: string[]
): 'ice_breaker' | 'command' | null {
  if (ice_breakers.includes(messageText)) {
    return 'ice_breaker';
  }

  // Check if message is a command (starts with /, or exact match with command name)
  if (messageText.startsWith('/')) {
    const commandName = messageText.slice(1).split(' ')[0];
    if (commands.some((cmd) => cmd === commandName)) {
      return 'command';
    }
  }

  return null;
}
