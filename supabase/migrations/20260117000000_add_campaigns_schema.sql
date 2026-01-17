/*
  # Giant Outreach - Multi-Channel Campaign Management Schema

  This migration adds campaign management capabilities for monitoring
  multiple campaigns across SMS, WhatsApp, and Email channels.

  ## New Tables

  ### 1. campaigns
  - Core campaign entity with status and channel configuration
  - Supports independent channels (each runs separately)

  ### 2. campaign_contacts
  - Junction table linking contacts to campaigns
  - Tracks enrollment and exit status

  ### 3. campaign_metrics
  - Per-campaign, per-channel daily metrics
  - Enables channel-specific analytics

  ## Changes to Existing Tables

  ### messages
  - Added campaign_id foreign key
  - Enables tracking which campaign a message belongs to

  ### contacts
  - Added preferred_channel column
*/

-- ============================================
-- CREATE CAMPAIGNS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  name text NOT NULL,
  description text,

  -- Status: draft, active, paused, completed, archived
  status text DEFAULT 'draft',

  -- Channel configuration (independent channels)
  sms_enabled boolean DEFAULT true,
  whatsapp_enabled boolean DEFAULT true,
  email_enabled boolean DEFAULT true,

  -- Campaign settings
  daily_message_limit int DEFAULT 100,
  bump_delay_hours int DEFAULT 24,
  max_bumps int DEFAULT 3,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz
);

-- Add constraint for campaign status
ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived'));

-- Indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON campaigns(created_at DESC);


-- ============================================
-- CREATE CAMPAIGN_CONTACTS JUNCTION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS campaign_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Enrollment tracking
  enrolled_at timestamptz DEFAULT now(),
  enrolled_by text, -- 'manual', 'import', 'automation'

  -- Channel-specific status for this contact in this campaign
  sms_status text DEFAULT 'active',
  whatsapp_status text DEFAULT 'active',
  email_status text DEFAULT 'active',

  -- Exit tracking
  exited_at timestamptz,
  exit_reason text, -- 'completed', 'opted_out', 'qualified', 'removed', 'bounced'

  -- Campaign-specific conversation stage
  campaign_stage text DEFAULT 'initial',

  -- Channel-specific metrics within campaign
  sms_sent int DEFAULT 0,
  sms_received int DEFAULT 0,
  whatsapp_sent int DEFAULT 0,
  whatsapp_received int DEFAULT 0,
  email_sent int DEFAULT 0,
  email_received int DEFAULT 0,

  -- Timestamps
  last_sms_at timestamptz,
  last_whatsapp_at timestamptz,
  last_email_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Unique constraint: contact can only be enrolled once per campaign
  UNIQUE(campaign_id, contact_id)
);

-- Add constraints for channel status
ALTER TABLE campaign_contacts ADD CONSTRAINT cc_sms_status_check
  CHECK (sms_status IN ('active', 'paused', 'opted_out', 'completed', 'bounced'));
ALTER TABLE campaign_contacts ADD CONSTRAINT cc_whatsapp_status_check
  CHECK (whatsapp_status IN ('active', 'paused', 'opted_out', 'completed', 'bounced'));
ALTER TABLE campaign_contacts ADD CONSTRAINT cc_email_status_check
  CHECK (email_status IN ('active', 'paused', 'opted_out', 'completed', 'bounced'));

-- Add constraint for campaign stage
ALTER TABLE campaign_contacts ADD CONSTRAINT cc_campaign_stage_check
  CHECK (campaign_stage IN (
    'initial',
    'in_conversation',
    'calendar_link_sent',
    'booked',
    'stalled',
    'opted_out',
    'completed'
  ));

-- Indexes for campaign_contacts
CREATE INDEX IF NOT EXISTS idx_cc_campaign ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cc_contact ON campaign_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_cc_campaign_stage ON campaign_contacts(campaign_id, campaign_stage);
CREATE INDEX IF NOT EXISTS idx_cc_active ON campaign_contacts(campaign_id) WHERE exited_at IS NULL;


-- ============================================
-- CREATE CAMPAIGN_METRICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS campaign_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  date date NOT NULL,
  channel text NOT NULL,

  -- Message counts
  messages_sent int DEFAULT 0,
  messages_received int DEFAULT 0,
  bumps_sent int DEFAULT 0,

  -- Outcomes
  calendar_links_sent int DEFAULT 0,
  bookings int DEFAULT 0,
  opt_outs int DEFAULT 0,
  bounces int DEFAULT 0,

  -- Engagement metrics
  response_rate numeric(5,2) DEFAULT 0,
  avg_response_time_minutes int,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Unique constraint per campaign/date/channel
  UNIQUE(campaign_id, date, channel)
);

-- Add constraint for channel
ALTER TABLE campaign_metrics ADD CONSTRAINT cm_channel_check
  CHECK (channel IN ('sms', 'whatsapp', 'email', 'all'));

-- Indexes for campaign_metrics
CREATE INDEX IF NOT EXISTS idx_cm_campaign_date ON campaign_metrics(campaign_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_cm_campaign_channel ON campaign_metrics(campaign_id, channel);


-- ============================================
-- ENHANCE MESSAGES TABLE
-- ============================================

-- Add campaign reference to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;

-- Index for campaign messages
CREATE INDEX IF NOT EXISTS idx_messages_campaign ON messages(campaign_id, created_at DESC);


-- ============================================
-- ENHANCE CONTACTS TABLE
-- ============================================

-- Add preferred channel for contact
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_channel text DEFAULT 'sms';

-- Add per-channel opt-out status
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sms_opted_out boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sms_opted_out_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS whatsapp_opted_out boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS whatsapp_opted_out_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_opted_out boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_opted_out_at timestamptz;

-- Add constraint for preferred_channel
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_preferred_channel_check'
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_preferred_channel_check
    CHECK (preferred_channel IN ('sms', 'whatsapp', 'email'));
  END IF;
END $$;


-- ============================================
-- ENHANCE ESCALATIONS TABLE
-- ============================================

-- Add campaign reference to escalations
ALTER TABLE escalations ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;
ALTER TABLE escalations ADD COLUMN IF NOT EXISTS channel text;

-- Add constraint for channel
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'escalations_channel_check'
  ) THEN
    ALTER TABLE escalations ADD CONSTRAINT escalations_channel_check
    CHECK (channel IS NULL OR channel IN ('sms', 'whatsapp', 'email'));
  END IF;
END $$;

-- Index for campaign escalations
CREATE INDEX IF NOT EXISTS idx_escalations_campaign ON escalations(campaign_id);


-- ============================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================

-- Enable RLS on campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to campaigns"
  ON campaigns FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert to campaigns"
  ON campaigns FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update to campaigns"
  ON campaigns FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete to campaigns"
  ON campaigns FOR DELETE TO anon, authenticated USING (true);

-- Enable RLS on campaign_contacts
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to campaign_contacts"
  ON campaign_contacts FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert to campaign_contacts"
  ON campaign_contacts FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update to campaign_contacts"
  ON campaign_contacts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete to campaign_contacts"
  ON campaign_contacts FOR DELETE TO anon, authenticated USING (true);

-- Enable RLS on campaign_metrics
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to campaign_metrics"
  ON campaign_metrics FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert to campaign_metrics"
  ON campaign_metrics FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update to campaign_metrics"
  ON campaign_metrics FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);


-- ============================================
-- DATABASE FUNCTIONS FOR CAMPAIGNS
-- ============================================

-- Get campaign statistics
CREATE OR REPLACE FUNCTION get_campaign_stats(p_campaign_id uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_contacts', (
      SELECT count(*) FROM campaign_contacts
      WHERE campaign_id = p_campaign_id
    ),
    'active_contacts', (
      SELECT count(*) FROM campaign_contacts
      WHERE campaign_id = p_campaign_id AND exited_at IS NULL
    ),
    'in_conversation', (
      SELECT count(*) FROM campaign_contacts
      WHERE campaign_id = p_campaign_id AND campaign_stage = 'in_conversation'
    ),
    'calendar_sent', (
      SELECT count(*) FROM campaign_contacts
      WHERE campaign_id = p_campaign_id AND campaign_stage = 'calendar_link_sent'
    ),
    'booked', (
      SELECT count(*) FROM campaign_contacts
      WHERE campaign_id = p_campaign_id AND campaign_stage = 'booked'
    ),
    'opted_out', (
      SELECT count(*) FROM campaign_contacts
      WHERE campaign_id = p_campaign_id AND campaign_stage = 'opted_out'
    ),
    'messages_sent_today', (
      SELECT COALESCE(SUM(messages_sent), 0) FROM campaign_metrics
      WHERE campaign_id = p_campaign_id AND date = current_date
    ),
    'messages_received_today', (
      SELECT COALESCE(SUM(messages_received), 0) FROM campaign_metrics
      WHERE campaign_id = p_campaign_id AND date = current_date
    ),
    'channel_breakdown', (
      SELECT json_object_agg(channel, json_build_object(
        'sent', messages_sent,
        'received', messages_received,
        'opt_outs', opt_outs,
        'bookings', bookings
      ))
      FROM campaign_metrics
      WHERE campaign_id = p_campaign_id AND date = current_date
    )
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment campaign metric
CREATE OR REPLACE FUNCTION increment_campaign_metric(
  p_campaign_id uuid,
  p_channel text,
  p_metric_name text,
  p_increment_by int DEFAULT 1
)
RETURNS void AS $$
BEGIN
  INSERT INTO campaign_metrics (campaign_id, date, channel, messages_sent, messages_received, bumps_sent, calendar_links_sent, bookings, opt_outs, bounces)
  VALUES (p_campaign_id, current_date, p_channel, 0, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (campaign_id, date, channel) DO NOTHING;

  EXECUTE format('UPDATE campaign_metrics SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE campaign_id = $2 AND date = current_date AND channel = $3', p_metric_name, p_metric_name)
  USING p_increment_by, p_campaign_id, p_channel;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enroll contact in campaign
CREATE OR REPLACE FUNCTION enroll_contact_in_campaign(
  p_campaign_id uuid,
  p_contact_id uuid,
  p_enrolled_by text DEFAULT 'manual'
)
RETURNS uuid AS $$
DECLARE
  v_cc_id uuid;
BEGIN
  INSERT INTO campaign_contacts (campaign_id, contact_id, enrolled_by)
  VALUES (p_campaign_id, p_contact_id, p_enrolled_by)
  ON CONFLICT (campaign_id, contact_id) DO UPDATE SET
    exited_at = NULL,
    exit_reason = NULL,
    campaign_stage = 'initial',
    updated_at = now()
  RETURNING id INTO v_cc_id;

  RETURN v_cc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update dashboard stats to include campaign count
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_contacts', (SELECT count(*) FROM contacts WHERE conversation_stage != 'opted_out'),
    'active_conversations', (SELECT count(*) FROM contacts WHERE conversation_stage = 'in_conversation'),
    'calendar_links_sent', (SELECT count(*) FROM contacts WHERE calendar_link_sent = true AND is_qualified = false),
    'qualified_pending', (SELECT count(*) FROM escalations WHERE status = 'pending' AND escalation_type = 'booked'),
    'needs_review_pending', (SELECT count(*) FROM escalations WHERE status = 'pending' AND escalation_type = 'needs_review'),
    'messages_today', (SELECT COALESCE(messages_sent + messages_received, 0) FROM daily_metrics WHERE date = current_date),
    'bookings_today', (SELECT COALESCE(bookings, 0) FROM daily_metrics WHERE date = current_date),
    'opt_outs_today', (SELECT COALESCE(opt_outs, 0) FROM daily_metrics WHERE date = current_date),
    'active_campaigns', (SELECT count(*) FROM campaigns WHERE status = 'active'),
    'total_campaigns', (SELECT count(*) FROM campaigns WHERE status != 'archived')
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- ENABLE REAL-TIME FOR NEW TABLES
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'campaigns'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'campaign_contacts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE campaign_contacts;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'campaign_metrics'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE campaign_metrics;
    END IF;
  END IF;
END $$;


-- ============================================
-- GRANT PERMISSIONS FOR NEW FUNCTIONS
-- ============================================

GRANT EXECUTE ON FUNCTION get_campaign_stats(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_campaign_metric(uuid, text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION enroll_contact_in_campaign(uuid, uuid, text) TO anon, authenticated;
