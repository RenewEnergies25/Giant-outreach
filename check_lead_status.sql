-- CRITICAL DIAGNOSTIC: Check actual lead data in database
-- Run this in Supabase SQL Editor to see why leads aren't counted as "ready to send"

-- First, get your campaign ID from the URL (it's in the browser address bar)
-- Replace 'YOUR_CAMPAIGN_ID_HERE' below with the actual UUID

\echo '=== CAMPAIGN LEAD STATUS BREAKDOWN ==='

SELECT
  'Total Leads' as metric,
  COUNT(*) as count
FROM campaign_leads
WHERE campaign_id = 'YOUR_CAMPAIGN_ID_HERE'

UNION ALL

SELECT
  'Has Email Address' as metric,
  COUNT(*) as count
FROM campaign_leads
WHERE campaign_id = 'YOUR_CAMPAIGN_ID_HERE'
  AND email_address IS NOT NULL

UNION ALL

SELECT
  'Has Subject Line' as metric,
  COUNT(*) as count
FROM campaign_leads
WHERE campaign_id = 'YOUR_CAMPAIGN_ID_HERE'
  AND subject_line IS NOT NULL

UNION ALL

SELECT
  'instantly_status = pending' as metric,
  COUNT(*) as count
FROM campaign_leads
WHERE campaign_id = 'YOUR_CAMPAIGN_ID_HERE'
  AND instantly_status = 'pending'

UNION ALL

SELECT
  'instantly_status = synced' as metric,
  COUNT(*) as count
FROM campaign_leads
WHERE campaign_id = 'YOUR_CAMPAIGN_ID_HERE'
  AND instantly_status = 'synced'

UNION ALL

SELECT
  'instantly_lead_id IS NULL' as metric,
  COUNT(*) as count
FROM campaign_leads
WHERE campaign_id = 'YOUR_CAMPAIGN_ID_HERE'
  AND instantly_lead_id IS NULL

UNION ALL

SELECT
  'instantly_lead_id IS NOT NULL' as metric,
  COUNT(*) as count
FROM campaign_leads
WHERE campaign_id = 'YOUR_CAMPAIGN_ID_HERE'
  AND instantly_lead_id IS NOT NULL

UNION ALL

SELECT
  'READY TO SEND (All Conditions)' as metric,
  COUNT(*) as count
FROM campaign_leads
WHERE campaign_id = 'YOUR_CAMPAIGN_ID_HERE'
  AND email_address IS NOT NULL
  AND email_status IS DISTINCT FROM 'not_found'
  AND subject_line IS NOT NULL
  AND instantly_status = 'pending';

\echo ''
\echo '=== SAMPLE OF FIRST 3 LEADS (Full Details) ==='

SELECT
  id,
  first_name,
  company_name,
  email_address,
  email_status,
  (subject_line IS NOT NULL) as has_subject,
  instantly_status,
  instantly_lead_id,
  instantly_synced_at,
  created_at
FROM campaign_leads
WHERE campaign_id = 'YOUR_CAMPAIGN_ID_HERE'
ORDER BY created_at
LIMIT 3;
