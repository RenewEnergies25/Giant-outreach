-- ============================================================================
-- QUICK FIX: Copy your campaign ID from browser URL and run this entire script
-- ============================================================================

-- 1. Update the stats function to count CSV emails
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

-- 2. Reset ALL leads that were marked as 'synced' but never actually got an instantly_lead_id
UPDATE campaign_leads
SET
  instantly_status = 'pending',
  instantly_synced_at = NULL,
  updated_at = NOW()
WHERE instantly_lead_id IS NULL
  AND instantly_status != 'pending';

-- 3. Show results
SELECT
  'Fixed! Updated stats function and reset ' || COUNT(*) || ' leads to pending status' as result
FROM campaign_leads
WHERE instantly_lead_id IS NULL
  AND instantly_status = 'pending';

-- Now refresh your campaign page in the browser - should show leads ready to send!
