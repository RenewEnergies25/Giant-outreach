-- ============================================================================
-- MANUAL FIX: Run this in Supabase SQL Editor if migrations didn't apply
-- ============================================================================

-- STEP 1: Check if the stats function was updated
-- If you see "email_status = 'found'" in the output, the migration didn't apply
\echo '=== CHECKING IF STATS FUNCTION WAS UPDATED ==='
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'get_campaign_lead_stats';

-- STEP 2: Get your campaign ID from browser URL and check actual lead data
-- Replace 'YOUR_CAMPAIGN_ID' with actual UUID from your browser address bar
\echo ''
\echo '=== CHECKING LEAD DATA (Replace YOUR_CAMPAIGN_ID below) ==='

DO $$
DECLARE
  v_campaign_id UUID := 'YOUR_CAMPAIGN_ID'; -- <<<< REPLACE THIS
  v_total INTEGER;
  v_has_email INTEGER;
  v_has_subject INTEGER;
  v_pending_status INTEGER;
  v_synced_status INTEGER;
  v_ready_old INTEGER;
  v_ready_new INTEGER;
BEGIN
  -- Count various conditions
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE email_address IS NOT NULL),
    COUNT(*) FILTER (WHERE subject_line IS NOT NULL),
    COUNT(*) FILTER (WHERE instantly_status = 'pending'),
    COUNT(*) FILTER (WHERE instantly_status = 'synced'),
    -- OLD logic
    COUNT(*) FILTER (WHERE email_status = 'found' AND subject_line IS NOT NULL AND instantly_status = 'pending'),
    -- NEW logic
    COUNT(*) FILTER (WHERE email_address IS NOT NULL
                     AND email_status IS DISTINCT FROM 'not_found'
                     AND subject_line IS NOT NULL
                     AND instantly_status = 'pending')
  INTO v_total, v_has_email, v_has_subject, v_pending_status, v_synced_status, v_ready_old, v_ready_new
  FROM campaign_leads
  WHERE campaign_id = v_campaign_id;

  RAISE NOTICE 'Total leads: %', v_total;
  RAISE NOTICE 'Has email_address: %', v_has_email;
  RAISE NOTICE 'Has subject_line: %', v_has_subject;
  RAISE NOTICE 'instantly_status = pending: %', v_pending_status;
  RAISE NOTICE 'instantly_status = synced: %', v_synced_status;
  RAISE NOTICE '---';
  RAISE NOTICE 'Ready to send (OLD logic - email_status=found): %', v_ready_old;
  RAISE NOTICE 'Ready to send (NEW logic - has email_address): %', v_ready_new;
  RAISE NOTICE '---';

  IF v_synced_status > 0 THEN
    RAISE NOTICE 'PROBLEM DETECTED: % leads marked as "synced" need to be reset!', v_synced_status;
  END IF;

  IF v_ready_new = 0 AND v_has_email > 0 AND v_has_subject > 0 THEN
    RAISE NOTICE 'PROBLEM: You have emails (%] and subjects (%) but 0 ready to send!', v_has_email, v_has_subject;
    RAISE NOTICE 'This means instantly_status is not "pending" for those leads.';
  END IF;
END $$;

-- STEP 3: Show sample of actual lead data
\echo ''
\echo '=== SAMPLE LEAD DATA (First 3 leads) ==='
SELECT
  id,
  first_name,
  company_name,
  email_address,
  email_status,
  (subject_line IS NOT NULL) as has_subject,
  instantly_status,
  instantly_lead_id,
  created_at
FROM campaign_leads
WHERE campaign_id = 'YOUR_CAMPAIGN_ID' -- <<<< REPLACE THIS
ORDER BY created_at
LIMIT 3;

-- STEP 4: MANUAL FIX - Reset instantly_status to 'pending'
-- Uncomment the lines below and run this section to manually fix the data

/*
\echo ''
\echo '=== APPLYING MANUAL FIX ==='

-- Reset leads marked as 'synced' but never actually synced (no instantly_lead_id)
UPDATE campaign_leads
SET
  instantly_status = 'pending',
  instantly_synced_at = NULL,
  updated_at = NOW()
WHERE campaign_id = 'YOUR_CAMPAIGN_ID' -- <<<< REPLACE THIS
  AND instantly_lead_id IS NULL
  AND instantly_status != 'pending';

-- Show how many were reset
SELECT 'Reset ' || COUNT(*) || ' leads back to pending status'
FROM campaign_leads
WHERE campaign_id = 'YOUR_CAMPAIGN_ID' -- <<<< REPLACE THIS
  AND instantly_lead_id IS NULL
  AND instantly_status = 'pending';
*/

-- STEP 5: MANUAL FIX - Update the stats function
-- If the stats function wasn't updated, uncomment and run this:

/*
CREATE OR REPLACE FUNCTION get_campaign_lead_stats(p_campaign_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_leads', COUNT(*),
    'emails_found', COUNT(*) FILTER (WHERE email_address IS NOT NULL AND email_status IS DISTINCT FROM 'not_found'),
    'emails_pending', COUNT(*) FILTER (WHERE email_address IS NULL OR email_status = 'pending'),
    'subjects_generated', COUNT(*) FILTER (WHERE subject_line IS NOT NULL),
    'subjects_pending', COUNT(*) FILTER (WHERE subject_line IS NULL),
    'synced_to_instantly', COUNT(*) FILTER (WHERE instantly_status != 'pending'),
    'ready_to_send', COUNT(*) FILTER (
      WHERE email_address IS NOT NULL
        AND email_status IS DISTINCT FROM 'not_found'
        AND subject_line IS NOT NULL
        AND instantly_status = 'pending'
    )
  ) INTO result
  FROM campaign_leads
  WHERE campaign_id = p_campaign_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql;
*/

\echo ''
\echo '=== INSTRUCTIONS ==='
\echo '1. Replace YOUR_CAMPAIGN_ID with your actual campaign ID from the browser URL'
\echo '2. Run STEPS 1-3 to diagnose the problem'
\echo '3. If STEP 2 shows synced leads, uncomment STEP 4 and run it to reset them'
\echo '4. If STEP 1 shows old function, uncomment STEP 5 and run it to update the function'
\echo '5. Refresh your campaign page in the browser'
