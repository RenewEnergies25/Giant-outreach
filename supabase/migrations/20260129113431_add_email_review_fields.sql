/*
  # Add Email Review Fields to Campaign Leads

  1. Changes
    - Add review tracking columns to campaign_leads table
    - Add database function to get review statistics per campaign
    - Create index on review_status for faster filtering

  2. New Columns
    - `is_reviewed` (boolean) - tracks if lead has been reviewed
    - `review_status` (text) - values: 'pending', 'valid', 'invalid'
    - `review_reason` (text) - AI-generated reason for flagging
    - `reviewed_at` (timestamptz) - timestamp of review
    - `review_overridden_by_user` (boolean) - tracks manual overrides

  3. Database Functions
    - `get_campaign_review_stats` - returns review statistics for a campaign
*/

-- Add review columns to campaign_leads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_leads' AND column_name = 'is_reviewed'
  ) THEN
    ALTER TABLE campaign_leads ADD COLUMN is_reviewed boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_leads' AND column_name = 'review_status'
  ) THEN
    ALTER TABLE campaign_leads ADD COLUMN review_status text DEFAULT 'pending' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_leads' AND column_name = 'review_reason'
  ) THEN
    ALTER TABLE campaign_leads ADD COLUMN review_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_leads' AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE campaign_leads ADD COLUMN reviewed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_leads' AND column_name = 'review_overridden_by_user'
  ) THEN
    ALTER TABLE campaign_leads ADD COLUMN review_overridden_by_user boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Create index for review_status filtering
CREATE INDEX IF NOT EXISTS idx_campaign_leads_review_status ON campaign_leads(campaign_id, review_status);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_is_reviewed ON campaign_leads(campaign_id, is_reviewed);

-- Function to get review statistics for a campaign
CREATE OR REPLACE FUNCTION get_campaign_review_stats(p_campaign_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_leads', COUNT(*),
    'reviewed_count', COUNT(*) FILTER (WHERE is_reviewed = true),
    'unreviewed_count', COUNT(*) FILTER (WHERE is_reviewed = false),
    'valid_count', COUNT(*) FILTER (WHERE review_status = 'valid'),
    'invalid_count', COUNT(*) FILTER (WHERE review_status = 'invalid'),
    'user_overridden_count', COUNT(*) FILTER (WHERE review_overridden_by_user = true),
    'review_completion_percentage',
      CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND((COUNT(*) FILTER (WHERE is_reviewed = true)::numeric / COUNT(*)::numeric) * 100, 1)
      END
  ) INTO result
  FROM campaign_leads
  WHERE campaign_id = p_campaign_id;

  RETURN result;
END;
$$;