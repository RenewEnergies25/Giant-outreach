/*
  # Add VSL (Video Sales Letter) Support to Campaigns

  This migration adds video URL fields to campaigns for storing VSL links
  that can be sent to contacts during outreach.

  ## Changes to campaigns table
  - vsl_url: Primary VSL video URL
  - vsl_thumbnail_url: Optional thumbnail image URL for the VSL
  - vsl_title: Optional title/description for the VSL
  - vsls: JSONB array for multiple VSLs per campaign
*/

-- Add VSL fields to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS vsl_url text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS vsl_thumbnail_url text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS vsl_title text;

-- Add JSONB column for multiple VSLs (allows storing an array of VSL objects)
-- Each VSL object: { url: string, title: string, thumbnail_url?: string, channel?: string }
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS vsls jsonb DEFAULT '[]'::jsonb;

-- Create index for campaigns with VSLs
CREATE INDEX IF NOT EXISTS idx_campaigns_has_vsl ON campaigns((vsl_url IS NOT NULL));

-- Add comment for documentation
COMMENT ON COLUMN campaigns.vsl_url IS 'Primary VSL video URL for the campaign';
COMMENT ON COLUMN campaigns.vsl_thumbnail_url IS 'Thumbnail image URL for the primary VSL';
COMMENT ON COLUMN campaigns.vsl_title IS 'Title or description for the primary VSL';
COMMENT ON COLUMN campaigns.vsls IS 'Array of VSL objects: [{url, title, thumbnail_url, channel}]';
