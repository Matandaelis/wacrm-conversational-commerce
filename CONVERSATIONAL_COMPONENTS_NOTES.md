# Conversational Components - Implementation Details & Notes

## API Integration Flow

### 1. Component Management Lifecycle

```
User adds/edits ice breaker or command in UI
    ↓
ConversationalComponentsPanel validates locally
    ↓
User clicks "Sync to WhatsApp" button
    ↓
POST /api/whatsapp/conversational with ice_breakers[] and commands[]
    ↓
API validates all constraints (length, format, limits)
    ↓
Builds Meta payload with `prompts` (ice breakers) and `commands`
    ↓
Calls Meta Conversational Automation API v18.0
    ↓
Returns sync status to UI (success, error, synced_count)
```

### 2. Meta API Mapping

**Database → Meta API Mapping:**
- Database `ice_breakers` array → Meta API `prompts` array
- Database `commands` array → Meta API `commands` array with `{command_name, command_description}`

**Important:** The Meta API is source of truth. Users should only sync components that are configured in their WhatsApp Business Manager first.

### 3. Webhook Component Detection

When a message arrives via webhook:
1. Extract message text from inbound message
2. Query `conversational_components` for this user's active components
3. Check if message matches any ice breaker (exact match)
4. Check if message starts with `/` followed by command name
5. Log `component_source` for analytics/automation routing

```typescript
// Example: User taps "Book a flight" ice breaker
// Webhook receives: { text: { body: "Book a flight" } }
// Detection returns: "ice_breaker"

// Example: User types "/help more info"
// Webhook receives: { text: { body: "/help more info" } }
// Detection returns: "command" (command name = "help")
```

### 4. Critical Validation Rules

**Ice Breakers:**
- 4 maximum per phone number (Meta limit)
- 80 characters maximum (Meta limit)
- Plain text only - no emojis, no special formatting
- Must be unique within the phone number's ice breaker list
- Displayed as tappable buttons in WhatsApp chat

**Commands:**
- 30 maximum per phone number (Meta limit)
- Command name: 32 characters, alphanumeric + underscore only
- Command description: 256 characters max, no emojis
- Command name must be unique within the phone number's command list
- Users trigger by typing `/command_name` in WhatsApp chat

### 5. One Phone Number Per User Policy

The schema enforces:
```sql
UNIQUE(user_id, phone_number_id)
```

This ensures each user can only configure conversational components for ONE phone number at a time. To switch to another number:
1. User must delete/deactivate components for current phone number
2. Switch to different phone number in WhatsApp settings
3. Configure new components for the new number

### 6. Sync Status Handling

After successful sync to Meta API, the implementation does NOT automatically update the database sync_status. Instead:
- UI shows success message
- User can retry sync if needed
- Failed syncs show Meta API error messages for debugging

To add persistent sync status tracking in future:
1. Update migration to add `sync_status` and `last_synced_at` columns
2. Update API route to record sync timestamp
3. Update UI to show "Synced at..." timestamp

### 7. Error Handling

**Common Meta API Errors:**
- `"Invalid access token"` → User must re-authenticate WhatsApp
- `"Phone number not found"` → phone_number_id mismatch
- `"Limit exceeded"` → Too many ice breakers (>4) or commands (>30)
- `"Invalid command name"` → Contains invalid characters or exceeds 32 chars

All errors are caught and returned to UI with Meta's error message for troubleshooting.

### 8. Webhook Payload Examples

**Ice Breaker Trigger:**
```json
{
  "messages": [{
    "from": "1234567890",
    "text": { "body": "Book a flight" }
  }]
}
```
Detection: `component_source = "ice_breaker"`

**Command Trigger:**
```json
{
  "messages": [{
    "from": "1234567890",
    "text": { "body": "/help show me options" }
  }]
}
```
Detection: `component_source = "command"` (command name = "help")

### 9. Future Enhancement Ideas

1. **Sync History Tracking:**
   - Add `conversational_component_syncs` table
   - Track each successful/failed sync with timestamp and error

2. **Auto-Retry Failed Syncs:**
   - Background job to retry failed syncs every 5 minutes
   - Exponential backoff for persistent failures

3. **Component Import/Export:**
   - Export ice breakers and commands as JSON
   - Import from JSON file to bulk-configure

4. **Analytics Dashboard:**
   - Count how many messages came from ice breakers vs commands
   - Most popular ice breakers/commands
   - Webhook detection success rate

5. **Multi-Language Support:**
   - Support ice breakers and commands in multiple languages
   - Language field in database schema

### 10. Testing Checklist

- [ ] Add 4 ice breakers, verify 5th is rejected
- [ ] Add 30 commands, verify 31st is rejected
- [ ] Test 80-character limit on ice breaker with emoji rejection
- [ ] Test 32-character limit on command name
- [ ] Test 256-character limit on command description
- [ ] Sync to Meta API with valid access token
- [ ] Verify webhook detects ice breaker selection
- [ ] Verify webhook detects command execution
- [ ] Test error handling with invalid token
- [ ] Verify RLS policies prevent cross-user access

---

**Implementation Date:** 2026-01-05
**API Version:** Meta Graph API v18.0
**Database Migration:** 014_conversational_commerce.sql
