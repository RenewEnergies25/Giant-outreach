/*
  # Instantly Integration & Email Templates Schema

  This migration adds:
  1. Email templates table for bulk uploaded email bodies
  2. Instantly configuration table for API settings
  3. Campaign email sequences linking templates to campaigns
  4. Instantly tracking fields on existing tables
*/

-- ============================================
-- INSTANTLY CONFIGURATION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS instantly_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key text NOT NULL,
  workspace_id text,
  webhook_secret text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Only allow one config row
CREATE UNIQUE INDEX IF NOT EXISTS idx_instantly_config_singleton ON instantly_config ((true));

-- Enable RLS
ALTER TABLE instantly_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to instantly_config"
  ON instantly_config FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert to instantly_config"
  ON instantly_config FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update to instantly_config"
  ON instantly_config FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);


-- ============================================
-- EMAIL TEMPLATES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template identification
  name text NOT NULL,
  description text,

  -- Email content
  body_html text NOT NULL,
  body_text text, -- Plain text version (optional)

  -- Dynamic subject line settings
  subject_line text, -- Can be null if using AI generation
  use_ai_subject boolean DEFAULT true,
  ai_subject_prompt text, -- Custom prompt for AI subject generation

  -- Template variables (e.g., {{first_name}}, {{company}})
  variables jsonb DEFAULT '[]'::jsonb,

  -- Categorization
  category text, -- 'initial', 'follow_up', 'closing', etc.
  tags text[],

  -- Status
  is_active boolean DEFAULT true,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to email_templates"
  ON email_templates FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert to email_templates"
  ON email_templates FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update to email_templates"
  ON email_templates FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete to email_templates"
  ON email_templates FOR DELETE TO anon, authenticated USING (true);


-- ============================================
-- CAMPAIGN EMAIL SEQUENCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS campaign_email_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,

  -- Sequence order and timing
  sequence_order int NOT NULL DEFAULT 1,
  delay_days int NOT NULL DEFAULT 0, -- Days after previous email (0 for first email)
  delay_hours int DEFAULT 0, -- Additional hours

  -- Override template settings
  subject_override text, -- Override template subject
  use_ai_subject boolean DEFAULT true,

  -- Sending conditions
  send_condition text, -- 'always', 'if_no_reply', 'if_opened', etc.

  -- Status
  is_active boolean DEFAULT true,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(campaign_id, sequence_order)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ces_campaign ON campaign_email_sequences(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ces_template ON campaign_email_sequences(template_id);

-- Enable RLS
ALTER TABLE campaign_email_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to campaign_email_sequences"
  ON campaign_email_sequences FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert to campaign_email_sequences"
  ON campaign_email_sequences FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update to campaign_email_sequences"
  ON campaign_email_sequences FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete to campaign_email_sequences"
  ON campaign_email_sequences FOR DELETE TO anon, authenticated USING (true);


-- ============================================
-- ENHANCE CAMPAIGNS TABLE FOR INSTANTLY
-- ============================================

-- Add Instantly integration fields
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS instantly_campaign_id text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS instantly_status text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS instantly_synced_at timestamptz;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS instantly_account_id text; -- Sending account

-- Email-specific campaign settings
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS from_name text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS reply_to_email text;

-- Index for Instantly campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_instantly ON campaigns(instantly_campaign_id) WHERE instantly_campaign_id IS NOT NULL;


-- ============================================
-- ENHANCE CONTACTS FOR INSTANTLY LEADS
-- ============================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instantly_lead_id text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS custom_variables jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_contacts_instantly ON contacts(instantly_lead_id) WHERE instantly_lead_id IS NOT NULL;


-- ============================================
-- ENHANCE CAMPAIGN_CONTACTS FOR INSTANTLY
-- ============================================

ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS instantly_lead_id text;
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS instantly_status text; -- 'pending', 'active', 'completed', 'bounced', 'replied'
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS email_sent_count int DEFAULT 0;
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS email_opened_count int DEFAULT 0;
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS email_clicked_count int DEFAULT 0;
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS email_replied boolean DEFAULT false;
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS email_bounced boolean DEFAULT false;
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS last_email_sent_at timestamptz;
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS last_email_opened_at timestamptz;


-- ============================================
-- INSTANTLY EVENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS instantly_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  campaign_contact_id uuid REFERENCES campaign_contacts(id) ON DELETE SET NULL,

  -- Instantly IDs
  instantly_campaign_id text,
  instantly_lead_id text,
  instantly_email_id text,

  -- Event details
  event_type text NOT NULL, -- 'sent', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed'
  event_data jsonb,

  -- Timestamps
  event_timestamp timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_instantly_events_campaign ON instantly_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_instantly_events_contact ON instantly_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_instantly_events_type ON instantly_events(event_type);
CREATE INDEX IF NOT EXISTS idx_instantly_events_timestamp ON instantly_events(event_timestamp DESC);

-- Enable RLS
ALTER TABLE instantly_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to instantly_events"
  ON instantly_events FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert to instantly_events"
  ON instantly_events FOR INSERT TO anon, authenticated WITH CHECK (true);


-- ============================================
-- GENERATED SUBJECTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS generated_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  sequence_id uuid REFERENCES campaign_email_sequences(id) ON DELETE SET NULL,

  -- Generated content
  subject_line text NOT NULL,
  prompt_used text,

  -- Status
  is_used boolean DEFAULT false,
  used_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_generated_subjects_campaign ON generated_subjects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_generated_subjects_contact ON generated_subjects(contact_id, campaign_id);

-- Enable RLS
ALTER TABLE generated_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to generated_subjects"
  ON generated_subjects FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert to generated_subjects"
  ON generated_subjects FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update to generated_subjects"
  ON generated_subjects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);


-- ============================================
-- BULK UPLOAD TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS bulk_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Upload details
  upload_type text NOT NULL, -- 'email_templates', 'contacts', 'email_bodies'
  file_name text,

  -- Stats
  total_rows int DEFAULT 0,
  successful_rows int DEFAULT 0,
  failed_rows int DEFAULT 0,

  -- Status
  status text DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_message text,
  errors jsonb DEFAULT '[]'::jsonb, -- Array of row-level errors

  -- Timestamps
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE bulk_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to bulk_uploads"
  ON bulk_uploads FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert to bulk_uploads"
  ON bulk_uploads FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update to bulk_uploads"
  ON bulk_uploads FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);


-- ============================================
-- ENABLE REAL-TIME
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'email_templates'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE email_templates;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'instantly_events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE instantly_events;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'bulk_uploads'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE bulk_uploads;
    END IF;
  END IF;
END $$;