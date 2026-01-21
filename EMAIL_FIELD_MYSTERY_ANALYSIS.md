# Email Field Mystery - Root Cause Analysis

## The Problem

Instantly API rejects all 41 leads with error: **"Email is required when creating a lead"**

But our logs clearly show the email field exists:
- ✅ Lead has email field: true
- ✅ Email value: "maria@clinic95.com"
- ✅ Email type: string
- ✅ Email length: 18
- ✅ All lead keys: email, first_name, last_name, company_name, website, custom_variables

## Timeline of Investigation

### Initial Hypothesis: Email Missing from Database
**Disproven** - Database query shows email_address exists

### Second Hypothesis: Validation Filtering Out Emails
**Disproven** - Logs show "Prepared 41 valid leads" and email validation passes

### Third Hypothesis: Custom Variables Too Large
**Unlikely** - email_body is only 670 chars (reasonable size)

### Fourth Hypothesis: JSON Serialization Issue
**CURRENT INVESTIGATION**

## Evidence

**From Latest Logs (timestamp 16:55:39.285):**

```
Lead has email field: true
Email value: "maria@clinic95.com"
Email type: string
Email length: 18
All lead keys: email, first_name, last_name, company_name, website, custom_variables
[Instantly API] First lead email type: string
[Instantly API] Payload has leads array: true
```

**Instantly API Response (timestamp 16:55:40.805):**

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Email is required when creating a lead"
}
```

## Critical Missing Piece

We see the email field exists in the JavaScript object, but we don't know if it exists in the **stringified JSON payload** sent over HTTP.

### Hypothesis: JSON.stringify() Removing Email Field

Possible causes:
1. **Circular reference** - If custom_variables has circular refs, JSON.stringify might fail partially
2. **toJSON() method** - If the lead object has a toJSON() that excludes email
3. **Getter property** - If email is a getter that doesn't serialize
4. **Prototype issue** - If email is on prototype, not own property

## Next Test

Added logging to see the actual stringified payload:

```typescript
const payloadString = JSON.stringify(payload);
console.log(`Payload first 500 chars:`, payloadString.substring(0, 500));
console.log(`Payload contains email field: ${payloadString.includes('"email":"')}`);
```

## Expected Results

**If email IS in the stringified payload:**
- We'll see `"email":"maria@clinic95.com"` in the first 500 chars
- This means the issue is with Instantly's API expectations (field name, format, etc.)

**If email is NOT in the stringified payload:**
- We won't see `"email":` in the output
- This confirms JSON serialization is stripping it
- We need to fix how we construct the lead objects

## Deployment Instructions

1. Deploy updated function:
   ```bash
   supabase functions deploy sync-to-instantly
   ```

2. Try sync again from UI

3. Check logs for these new entries:
   - `[Instantly API] Payload first 500 chars: ...`
   - `[Instantly API] Payload contains email field: true/false`

4. Share the complete log output

## Alternative Theory: API Endpoint Mismatch

It's also possible we're using the wrong Instantly API endpoint or format.

**Current endpoint:** `POST /api/v2/leads`

**Payload structure:**
```json
{
  "campaign_id": "a3b6ec64-f670-4821-ac43-2596bfa556d0",
  "leads": [
    {
      "email": "maria@clinic95.com",
      "first_name": "Maria Hardman",
      "last_name": "",
      "company_name": "Clinic 95 Ltd",
      "website": "",
      "custom_variables": {
        "email_body": "...",
        "subject_line": "...",
        "opening_line": "...",
        "call_to_action": "..."
      }
    }
  ]
}
```

This looks correct according to Instantly API v2 documentation, but we should verify.

## Files Modified

1. **supabase/functions/_shared/instantly.ts**
   - Added payload stringification logging
   - Added email field existence check

## Status

**Waiting for deployment and new log output** to determine if email field exists in the actual HTTP request payload.
