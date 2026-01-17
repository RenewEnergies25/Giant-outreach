/*
  # Enhanced Dead Lead Reactivation System Schema

  This migration enhances the existing schema with:
  - Additional columns for conversation tracking
  - Conversation stage management
  - Message type tracking (bump, calendar, opt-out)
  - Database functions for common operations
  - Real-time subscription setup
*/

-- ============================================
-- ENHANCE CONTACTS TABLE
-- ============================================

-- Add conversation stage tracking
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ghl_location_id text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS full_name text;

-- Conversation stage (with default for existing rows)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS conversation_stage text DEFAULT 'initial';

-- Add constraint for conversation_stage (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_conversation_stage_check'
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_conversation_stage_check
    CHECK (conversation_stage IN (
      'initial',
      'in_conversation',
      'calendar_link_sent',
      'booked',
      'stalled',
      'opted_out'
    ));
  END IF;
END $$;

-- Status flags
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_qualified boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS qualified_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_opted_out boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opted_out_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS calendar_link_sent boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS calendar_link_sent_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS call_back_time text;

-- Conversation metrics
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bump_count int DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_bump_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS questions_asked int DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS message_count int DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_message_at timestamptz;

-- Escalation flag
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS needs_human_review boolean DEFAULT false;

-- GHL Tags
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ghl_tags text[];

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_ghl_id ON contacts(ghl_contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(conversation_stage);
CREATE INDEX IF NOT EXISTS idx_contacts_qualified ON contacts(is_qualified) WHERE is_qualified = true;
CREATE INDEX IF NOT EXISTS idx_contacts_calendar_sent ON contacts(calendar_link_sent) WHERE calendar_link_sent = true;
CREATE INDEX IF NOT EXISTS idx_contacts_needs_review ON contacts(needs_human_review) WHERE needs_human_review = true;

-- Make ghl_contact_id unique (if not already)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_ghl_contact_id_key'
  ) THEN
    -- First, handle any existing duplicates by keeping the most recent one
    DELETE FROM contacts a USING contacts b
    WHERE a.ghl_contact_id = b.ghl_contact_id
      AND a.ghl_contact_id IS NOT NULL
      AND a.created_at < b.created_at;

    ALTER TABLE contacts ADD CONSTRAINT contacts_ghl_contact_id_key UNIQUE (ghl_contact_id);
  END IF;
END $$;


-- ============================================
-- ENHANCE MESSAGES TABLE
-- ============================================

-- Add email channel option
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_channel_check;
ALTER TABLE messages ADD CONSTRAINT messages_channel_check
  CHECK (channel IN ('sms', 'whatsapp', 'email'));

-- Add GHL contact ID for direct lookup
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ghl_contact_id text;

-- Message type tracking
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'conversation';

-- Add constraint for message_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_message_type_check'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
    CHECK (message_type IN (
      'conversation',
      'bump',
      'calendar_sent',
      'opt_out',
      'manual'
    ));
  END IF;
END $$;

-- Detected intent
ALTER TABLE messages ADD COLUMN IF NOT EXISTS detected_intent text;

-- Add constraint for detected_intent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_detected_intent_check'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_detected_intent_check
    CHECK (detected_intent IS NULL OR detected_intent IN (
      'answer',
      'question',
      'objection',
      'agreement',
      'rejection',
      'unclear'
    ));
  END IF;
END $$;

-- Bump tracking
ALTER TABLE messages ADD COLUMN IF NOT EXISTS bump_number int;

-- Create index for ghl_contact_id
CREATE INDEX IF NOT EXISTS idx_messages_ghl_contact ON messages(ghl_contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);


-- ============================================
-- ENHANCE ESCALATIONS TABLE
-- ============================================

-- Escalation type
ALTER TABLE escalations ADD COLUMN IF NOT EXISTS escalation_type text DEFAULT 'needs_review';

-- Add constraint for escalation_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'escalations_escalation_type_check'
  ) THEN
    ALTER TABLE escalations ADD CONSTRAINT escalations_escalation_type_check
    CHECK (escalation_type IN (
      'booked',
      'calendar_sent',
      'needs_review'
    ));
  END IF;
END $$;

-- Appointment details
ALTER TABLE escalations ADD COLUMN IF NOT EXISTS appointment_time timestamptz;
ALTER TABLE escalations ADD COLUMN IF NOT EXISTS calendar_name text;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_escalations_type ON escalations(escalation_type);
CREATE INDEX IF NOT EXISTS idx_escalations_pending ON escalations(status) WHERE status = 'pending';


-- ============================================
-- ENHANCE DAILY METRICS TABLE
-- ============================================

-- Add new metric columns
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS bumps_sent int DEFAULT 0;
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS calendar_links_sent int DEFAULT 0;
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS bookings int DEFAULT 0;
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS human_reviews int DEFAULT 0;

-- Rename columns for consistency (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_metrics' AND column_name = 'escalations') THEN
    ALTER TABLE daily_metrics RENAME COLUMN escalations TO human_reviews_legacy;
  END IF;
END $$;


-- ============================================
-- DATABASE FUNCTIONS
-- ============================================

-- Increment daily metric
CREATE OR REPLACE FUNCTION increment_metric(metric_name text, increment_by int DEFAULT 1)
RETURNS void AS $$
BEGIN
  INSERT INTO daily_metrics (date, messages_sent, messages_received, bumps_sent, calendar_links_sent, bookings, opt_outs, human_reviews)
  VALUES (current_date, 0, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (date) DO NOTHING;

  EXECUTE format('UPDATE daily_metrics SET %I = COALESCE(%I, 0) + $1 WHERE date = current_date', metric_name, metric_name)
  USING increment_by;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Upsert contact from GHL webhook
CREATE OR REPLACE FUNCTION upsert_contact_from_ghl(
  p_ghl_contact_id text,
  p_ghl_location_id text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_full_name text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  INSERT INTO contacts (
    ghl_contact_id,
    ghl_location_id,
    email,
    first_name,
    last_name,
    phone,
    full_name
  )
  VALUES (
    p_ghl_contact_id,
    p_ghl_location_id,
    p_email,
    p_first_name,
    p_last_name,
    p_phone,
    p_full_name
  )
  ON CONFLICT (ghl_contact_id) DO UPDATE SET
    ghl_location_id = COALESCE(EXCLUDED.ghl_location_id, contacts.ghl_location_id),
    email = COALESCE(EXCLUDED.email, contacts.email),
    first_name = COALESCE(EXCLUDED.first_name, contacts.first_name),
    last_name = COALESCE(EXCLUDED.last_name, contacts.last_name),
    phone = COALESCE(EXCLUDED.phone, contacts.phone),
    full_name = COALESCE(EXCLUDED.full_name, contacts.full_name),
    updated_at = now()
  RETURNING id INTO v_contact_id;

  RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Get conversation history for ChatGPT
CREATE OR REPLACE FUNCTION get_conversation_history(p_ghl_contact_id text, p_limit int DEFAULT 20)
RETURNS TABLE(role text, content text) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN m.direction = 'inbound' THEN 'user' ELSE 'assistant' END AS role,
    m.content
  FROM messages m
  WHERE m.ghl_contact_id = p_ghl_contact_id
    AND m.message_type IN ('conversation', 'manual')
  ORDER BY m.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Get dashboard stats
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
    'opt_outs_today', (SELECT COALESCE(opt_outs, 0) FROM daily_metrics WHERE date = current_date)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- ADDITIONAL RLS POLICIES
-- ============================================

-- Allow insert to contacts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'Allow public insert to contacts'
  ) THEN
    CREATE POLICY "Allow public insert to contacts"
      ON contacts
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Allow update to contacts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'Allow public update to contacts'
  ) THEN
    CREATE POLICY "Allow public update to contacts"
      ON contacts
      FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Allow insert to escalations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'escalations' AND policyname = 'Allow public insert to escalations'
  ) THEN
    CREATE POLICY "Allow public insert to escalations"
      ON escalations
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Allow insert to daily_metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_metrics' AND policyname = 'Allow public insert to daily_metrics'
  ) THEN
    CREATE POLICY "Allow public insert to daily_metrics"
      ON daily_metrics
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Allow update to daily_metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_metrics' AND policyname = 'Allow public update to daily_metrics'
  ) THEN
    CREATE POLICY "Allow public update to daily_metrics"
      ON daily_metrics
      FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;


-- ============================================
-- ENABLE REAL-TIME FOR ALL TABLES
-- ============================================

-- Enable real-time subscriptions
DO $$
BEGIN
  -- Check if publication exists, if not it will be created by Supabase
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Add tables to real-time publication if not already added
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'escalations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE escalations;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'contacts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
    END IF;
  END IF;
END $$;


-- ============================================
-- GRANT PERMISSIONS FOR FUNCTIONS
-- ============================================

GRANT EXECUTE ON FUNCTION increment_metric(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_contact_from_ghl(text, text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_history(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO anon, authenticated;