-- Check if your database has the correct Instantly campaign ID
-- Run this in Supabase SQL Editor

-- First, find your campaign in the database
SELECT
  id as database_campaign_id,
  name as campaign_name,
  instantly_campaign_id,
  instantly_synced_at,
  created_at
FROM campaigns
WHERE name ILIKE '%dentist%'
ORDER BY created_at DESC
LIMIT 5;

-- Then check how many leads are in pending status for this campaign
SELECT
  c.name as campaign_name,
  c.instantly_campaign_id,
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE cl.instantly_status = 'pending') as pending_leads,
  COUNT(*) FILTER (WHERE cl.email_address IS NOT NULL) as has_email,
  COUNT(*) FILTER (WHERE cl.subject_line IS NOT NULL) as has_subject
FROM campaigns c
LEFT JOIN campaign_leads cl ON cl.campaign_id = c.id
WHERE c.name ILIKE '%dentist%'
GROUP BY c.id, c.name, c.instantly_campaign_id;

-- If instantly_campaign_id is NULL or doesn't match, you need to get the correct ID
-- To get the correct campaign ID from Instantly:
-- 1. Go to your Dentist's campaign in Instantly
-- 2. Look at the URL - it will be like: instantly.ai/app/campaign/CAMPAIGN_ID_HERE
-- 3. Copy that CAMPAIGN_ID and update your database:

/*
UPDATE campaigns
SET instantly_campaign_id = 'PASTE_REAL_CAMPAIGN_ID_HERE'
WHERE name ILIKE '%dentist%';
*/
