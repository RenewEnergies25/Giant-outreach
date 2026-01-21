-- Fix get_campaign_lead_stats function to count CSV imported emails as "ready to send"
--
-- Root cause: The function only counted leads with email_status = 'found' (Hunter.io verified)
-- but CSV imported emails have email_status = NULL or 'pending', so they showed as "0 ready to send"
--
-- New logic matches the Edge Function:
-- - Has email address (email_address IS NOT NULL)
-- - Has subject line (subject_line IS NOT NULL)
-- - Not synced yet (instantly_status = 'pending')
-- - Not explicitly invalid (email_status != 'not_found')

CREATE OR REPLACE FUNCTION get_campaign_lead_stats(p_campaign_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_leads', COUNT(*),
    -- FIXED: Count ALL emails (including CSV imports), not just Hunter.io verified
    'emails_found', COUNT(*) FILTER (WHERE email_address IS NOT NULL AND email_status IS DISTINCT FROM 'not_found'),
    'emails_pending', COUNT(*) FILTER (WHERE email_address IS NULL OR email_status = 'pending'),
    'subjects_generated', COUNT(*) FILTER (WHERE subject_line IS NOT NULL),
    'subjects_pending', COUNT(*) FILTER (WHERE subject_line IS NULL),
    'synced_to_instantly', COUNT(*) FILTER (WHERE instantly_status != 'pending'),
    -- FIXED: Count leads with email addresses (includes CSV imports)
    -- OLD: WHERE email_status = 'found' AND subject_line IS NOT NULL AND instantly_status = 'pending'
    -- NEW: WHERE email_address IS NOT NULL AND email_status IS DISTINCT FROM 'not_found' AND subject_line IS NOT NULL AND instantly_status = 'pending'
    'ready_to_send', COUNT(*) FILTER (
      WHERE email_address IS NOT NULL
        AND email_status IS DISTINCT FROM 'not_found'  -- Includes NULL, 'pending', 'found', excludes 'not_found'
        AND subject_line IS NOT NULL
        AND instantly_status = 'pending'
    )
  ) INTO result
  FROM campaign_leads
  WHERE campaign_id = p_campaign_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql;
