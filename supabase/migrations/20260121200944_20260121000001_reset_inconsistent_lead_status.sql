-- Reset inconsistent lead statuses caused by previous failed sync attempts
--
-- Problem: Leads were marked as instantly_status = 'synced' even though they
-- never got an instantly_lead_id (meaning they weren't actually added to Instantly)
--
-- This fixes the data inconsistency by resetting those leads back to 'pending'

UPDATE campaign_leads
SET
  instantly_status = 'pending',
  instantly_synced_at = NULL,
  updated_at = NOW()
WHERE instantly_lead_id IS NULL
  AND instantly_status != 'pending';

-- Show how many leads were reset
DO $$
DECLARE
  reset_count INTEGER;
BEGIN
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RAISE NOTICE 'Reset % leads from incorrect "synced" status back to "pending"', reset_count;
END $$;