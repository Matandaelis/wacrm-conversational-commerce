# Conversational Commerce Testing & Verification Guide

## Complete Implementation Summary

This guide walks you through testing and verifying the conversational commerce feature for WhatsApp CRM.

## 1. Component Overview

### What Was Implemented

1. **Conversational Components Panel**
   - Full UI for managing ice breakers (max 4, 80 chars each)
   - Full UI for managing commands (max 30, 32-char names, 256-char descriptions)
   - Real-time validation and character counters
   - Status indicators and sync tracking
   - Delete confirmation dialogs

2. **API Integration**
   - GET endpoint: `/api/whatsapp/conversational` - Fetches components from database
   - POST endpoint: Syncs components to Meta WhatsApp Conversational Automation API
   - Full validation before Meta API calls
   - Error handling and user feedback

3. **Database Layer**
   - Migration: `014_conversational_commerce.sql`
   - Table: `conversational_components` with RLS policies
   - Stores ice breakers and commands per phone number
   - One phone number per user enforcement

4. **Webhook Enhancement**
   - Component source detection for incoming messages
   - Identifies messages from ice breakers or commands
   - Logs component-driven engagement
   - Non-blocking detection (won't slow webhook)

5. **Verification Interface**
   - Real-time sync status display
   - Component count tracking (current/max)
   - Lists all configured ice breakers and commands
   - Copy-to-clipboard functionality
   - Refresh status button

## 2. Testing the Implementation

### Step 1: Connect WhatsApp Business Account

1. Go to Settings → WhatsApp
2. Enter your WhatsApp Business Account credentials:
   - Business Phone Number ID
   - WABA ID
   - Access Token
   - Verify Token

3. Click "Save & Verify" to establish connection

### Step 2: Add Ice Breakers

1. After connecting, scroll to "Conversational Components"
2. Click "Ice Breakers" tab
3. Click "Add Ice Breaker"
4. Enter text (max 80 characters):
   - Examples: "Browse Products", "Check Order Status", "Talk to Support"
5. Click "Save"
6. Add up to 4 ice breakers

### Step 3: Add Commands

1. Click "Commands" tab
2. Click "Add Command"
3. Enter command name (alphanumeric + underscore, max 32 chars):
   - Examples: "help", "order_status", "product_search"
4. Enter description (max 256 chars):
   - Explains what the command does
5. Click "Save"
6. Add up to 30 commands

### Step 4: Sync to WhatsApp

1. Click "Sync to WhatsApp" button
2. System will validate all components
3. Sync will push to Meta API
4. Status will show "Synced" or error message

### Step 5: Verify Sync Status

1. Check the "Sync Verification" panel below
2. Verify:
   - Meta API Status shows "Synced" (green)
   - Ice Breaker count matches what you added
   - Command count matches what you added
   - All components listed correctly

### Step 6: Test on WhatsApp

1. Message your WhatsApp business phone number
2. You should see ice breakers as quick reply buttons
3. Type a command (e.g., "/help") to trigger it
4. Verify the message is processed

## 3. Webhook Testing

### Component Detection Logging

The webhook now logs when messages come from components:

```
[webhook] message from ice_breaker: "Browse Products"
[webhook] message from command: "/help"
```

Check your app logs to verify:
- Messages from ice breakers are being detected
- Messages from commands are being detected
- Detection happens non-blocking (webhook returns 200 OK immediately)

### Testing Component Detection

1. Send a message matching an ice breaker text
2. Send a command (e.g., "/help")
3. Check application logs for:
   - `[webhook] message from ice_breaker: ...` or
   - `[webhook] message from command: ...`

## 4. Database Verification

### Check Components in Database

You can query the database to verify storage:

```sql
SELECT 
  type,
  name,
  description,
  status,
  created_at
FROM conversational_components
WHERE user_id = 'YOUR_USER_ID'
ORDER BY type, position;
```

Expected results:
- Type: "ice_breaker" or "command"
- Name: Your entered text
- Description: Command description (NULL for ice breakers)
- Status: "active"
- Created_at: Current timestamp

## 5. API Testing

### Test GET Endpoint

```bash
curl -X GET "http://localhost:3000/api/whatsapp/conversational?phone_number_id=YOUR_PHONE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
{
  "ice_breakers": [
    { "id": "...", "name": "Browse Products", "type": "ice_breaker" }
  ],
  "commands": [
    { "id": "...", "name": "help", "description": "Get help", "type": "command" }
  ],
  "sync_status": "synced",
  "component_count": {
    "ice_breakers": 1,
    "commands": 1
  }
}
```

### Test POST Endpoint (Sync)

```bash
curl -X POST "http://localhost:3000/api/whatsapp/conversational" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number_id": "YOUR_PHONE_ID",
    "ice_breakers": ["Browse Products", "Check Status"],
    "commands": [
      { "command_name": "help", "command_description": "Get help" }
    ]
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Components synced to WhatsApp",
  "synced_count": {
    "ice_breakers": 2,
    "commands": 1
  }
}
```

## 6. Error Handling Tests

### Test Validation

Try these error cases:

1. **Ice breaker too long (>80 chars)** → Should show validation error
2. **Command name with special chars** → Should reject
3. **Over 4 ice breakers** → Should disable "Add" button
4. **Over 30 commands** → Should disable "Add" button
5. **Command description >256 chars** → Should trim/warn

### Test Meta API Errors

If sync fails:
- Check access token is valid
- Verify phone_number_id is correct
- Check Meta API status page for outages
- Error message will display in sync status alert

## 7. Performance Considerations

- Components are cached in browser (SWR library)
- Webhook component detection is non-blocking
- Database queries are indexed on user_id and phone_number_id
- Sync to Meta happens asynchronously

## 8. Troubleshooting

### Components not appearing in WhatsApp

1. Verify sync was successful (check green status)
2. Confirm phone number is connected
3. Check Meta Business account has correct permissions
4. Wait a few minutes for Meta to propagate

### Webhook not detecting components

1. Verify components are synced
2. Check application logs for errors
3. Ensure message text exactly matches ice breaker
4. For commands, use `/command_name` format

### Sync fails with error

1. Verify access token is not expired
2. Check phone_number_id format (should be numeric string)
3. Check component content (no emojis, correct lengths)
4. Check Meta API status

## 9. Production Checklist

Before deploying to production:

- [ ] Database migration applied
- [ ] WhatsApp credentials securely stored
- [ ] Components tested on test phone number
- [ ] Webhook logs verified for component detection
- [ ] Error handling tested
- [ ] Performance tested with multiple components
- [ ] Team trained on adding/managing components
- [ ] Documentation shared with support team

## 10. Support & Resources

- Meta WhatsApp Conversational Automation API: https://developers.facebook.com/docs/whatsapp/business-platform/conversational-components
- Database schema: `supabase/migrations/014_conversational_commerce.sql`
- Component types: `src/types/index.ts`
- API utilities: `src/lib/whatsapp/conversational-api.ts`

