-- Diagnostic query to check actual campaign_leads data
-- Run this in your Supabase SQL editor to see what's actually in the database

-- 1. Check the current function definition (to see if migration was applied)
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'get_campaign_lead_stats';

-- 2. Check actual lead data distribution
SELECT
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE email_address IS NOT NULL) as has_email_address,
  COUNT(*) FILTER (WHERE email_status = 'found') as email_status_found,
  COUNT(*) FILTER (WHERE email_status = 'pending') as email_status_pending,
  COUNT(*) FILTER (WHERE email_status = 'not_found') as email_status_not_found,
  COUNT(*) FILTER (WHERE email_status IS NULL) as email_status_null,
  COUNT(*) FILTER (WHERE subject_line IS NOT NULL) as has_subject,
  COUNT(*) FILTER (WHERE instantly_status = 'pending') as instantly_pending,
  COUNT(*) FILTER (WHERE instantly_status = 'synced') as instantly_synced,
  COUNT(*) FILTER (WHERE instantly_status IS NULL) as instantly_null,
  -- Ready to send using OLD logic
  COUNT(*) FILTER (
    WHERE email_status = 'found'
      AND subject_line IS NOT NULL
      AND instantly_status = 'pending'
  ) as ready_old_logic,
  -- Ready to send using NEW logic
  COUNT(*) FILTER (
    WHERE email_address IS NOT NULL
      AND email_status IS DISTINCT FROM 'not_found'
      AND subject_line IS NOT NULL
      AND instantly_status = 'pending'
  ) as ready_new_logic
FROM campaign_leads
WHERE campaign_id = 'YOUR_CAMPAIGN_ID_HERE';  -- Replace with your campaign ID

-- 3. Sample of first 5 leads to see actual values
SELECT
  id,
  first_name,
  company_name,
  email_address,
  email_status,
  subject_line IS NOT NULL as has_subject,
  instantly_status,
  instantly_synced_at
FROM campaign_leads
WHERE campaign_id = 'YOUR_CAMPAIGN_ID_HERE'  -- Replace with your campaign ID
LIMIT 5;
