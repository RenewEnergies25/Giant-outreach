-- Campaign Leads table
-- Stores individual contacts/leads for each campaign with their personalized email data
CREATE TABLE IF NOT EXISTS campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Contact information from CSV
  first_name TEXT,
  company_name TEXT,
  website TEXT,

  -- Email content fields
  email_body TEXT NOT NULL,
  opening_line TEXT,
  second_line TEXT,
  call_to_action TEXT,
  website_analysis TEXT,

  -- Email address (to be found later)
  email_address TEXT,
  email_status TEXT DEFAULT 'pending' CHECK (email_status IN ('pending', 'found', 'not_found', 'invalid')),
  email_confidence_score INTEGER, -- Hunter.io confidence score (0-100)
  email_found_at TIMESTAMPTZ,

  -- AI-generated subject line
  subject_line TEXT,
  subject_generated_at TIMESTAMPTZ,
  subject_prompt_used TEXT,

  -- Instantly sync status
  instantly_lead_id TEXT,
  instantly_status TEXT DEFAULT 'pending' CHECK (instantly_status IN ('pending', 'synced', 'sent', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed')),
  instantly_synced_at TIMESTAMPTZ,

  -- Custom variables (stores any extra CSV columns)
  custom_variables JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_email_status ON campaign_leads(email_status);
CREATE INDEX idx_campaign_leads_instantly_status ON campaign_leads(instantly_status);
CREATE INDEX idx_campaign_leads_subject_line ON campaign_leads(subject_line) WHERE subject_line IS NOT NULL;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_campaign_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_campaign_leads_updated_at
  BEFORE UPDATE ON campaign_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_leads_updated_at();

-- Function to get campaign lead stats
CREATE OR REPLACE FUNCTION get_campaign_lead_stats(p_campaign_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_leads', COUNT(*),
    'emails_found', COUNT(*) FILTER (WHERE email_status = 'found'),
    'emails_pending', COUNT(*) FILTER (WHERE email_status = 'pending'),
    'subjects_generated', COUNT(*) FILTER (WHERE subject_line IS NOT NULL),
    'subjects_pending', COUNT(*) FILTER (WHERE subject_line IS NULL),
    'synced_to_instantly', COUNT(*) FILTER (WHERE instantly_status != 'pending'),
    'ready_to_send', COUNT(*) FILTER (WHERE email_status = 'found' AND subject_line IS NOT NULL AND instantly_status = 'pending')
  ) INTO result
  FROM campaign_leads
  WHERE campaign_id = p_campaign_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policy (allow all for now, can be restricted later)
CREATE POLICY "Allow all operations on campaign_leads" ON campaign_leads
  FOR ALL USING (true) WITH CHECK (true);
