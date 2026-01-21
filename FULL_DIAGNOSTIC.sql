-- COMPREHENSIVE DIAGNOSTIC: Check what's actually happening
-- Run this in Supabase SQL Editor

-- 1. Get your campaign details
SELECT
  id as campaign_id_in_db,
  name,
  instantly_campaign_id,
  instantly_status,
  instantly_synced_at,
  created_at
FROM campaigns
WHERE name ILIKE '%dentist%'
ORDER BY created_at DESC;

-- 2. Check if instantly_campaign_id is NULL or exists
-- If NULL: Next sync will CREATE a new campaign
-- If EXISTS: Next sync will ADD leads to existing campaign

-- 3. Count leads by status
SELECT
  'Total leads' as status,
  COUNT(*) as count
FROM campaign_leads
WHERE campaign_id IN (SELECT id FROM campaigns WHERE name ILIKE '%dentist%')

UNION ALL

SELECT
  'Has email_address' as status,
  COUNT(*) as count
FROM campaign_leads
WHERE campaign_id IN (SELECT id FROM campaigns WHERE name ILIKE '%dentist%')
  AND email_address IS NOT NULL

UNION ALL

SELECT
  'Has subject_line' as status,
  COUNT(*) as count
FROM campaign_leads
WHERE campaign_id IN (SELECT id FROM campaigns WHERE name ILIKE '%dentist%')
  AND subject_line IS NOT NULL

UNION ALL

SELECT
  'instantly_status = pending' as status,
  COUNT(*) as count
FROM campaign_leads
WHERE campaign_id IN (SELECT id FROM campaigns WHERE name ILIKE '%dentist%')
  AND instantly_status = 'pending'

UNION ALL

SELECT
  'Ready to sync (all conditions)' as status,
  COUNT(*) as count
FROM campaign_leads
WHERE campaign_id IN (SELECT id FROM campaigns WHERE name ILIKE '%dentist%')
  AND email_address IS NOT NULL
  AND email_status IS DISTINCT FROM 'not_found'
  AND subject_line IS NOT NULL
  AND instantly_status = 'pending';

-- 4. Show first 3 leads with their actual data
SELECT
  id,
  first_name,
  company_name,
  LEFT(email_address, 30) as email,
  email_status,
  LEFT(subject_line, 50) as subject,
  instantly_status,
  instantly_lead_id
FROM campaign_leads
WHERE campaign_id IN (SELECT id FROM campaigns WHERE name ILIKE '%dentist%')
ORDER BY created_at
LIMIT 3;
