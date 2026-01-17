/*
  # Dead Lead Reactivation System Schema

  This migration creates the complete database schema for the dead lead reactivation system.

  ## Tables Created
  
  ### 1. contacts
  - Stores contact information from GHL
  - Fields: id (uuid), ghl_contact_id (text), email (text), first_name (text), phone (text), status (text), created_at, updated_at
  
  ### 2. messages
  - Stores all inbound and outbound messages
  - Fields: id (uuid), contact_id (uuid FK), contact_email (text), direction (text), channel (text), content (text), ai_generated (boolean), ai_classification (text), template_used (text), created_at
  
  ### 3. escalations
  - Stores qualified leads that need manual attention
  - Fields: id (uuid), contact_id (uuid FK), message_id (uuid FK), reason (text), suggested_reply (text), status (text), resolved_by (text), resolved_at (timestamptz), created_at
  
  ### 4. daily_metrics
  - Aggregated daily statistics
  - Fields: id (uuid), date (date), messages_sent (int), messages_received (int), ai_replies (int), manual_replies (int), escalations (int), opt_outs (int)

  ## Security
  - RLS enabled on all tables
  - Public read access for internal monitoring tool (no auth required)
  - Public write access for escalations updates
*/

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_contact_id text,
  email text,
  first_name text,
  phone text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  contact_email text,
  direction text CHECK (direction IN ('inbound', 'outbound')),
  channel text CHECK (channel IN ('sms', 'whatsapp')),
  content text NOT NULL,
  ai_generated boolean DEFAULT false,
  ai_classification text,
  template_used text,
  created_at timestamptz DEFAULT now()
);

-- Create escalations table
CREATE TABLE IF NOT EXISTS escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  reason text NOT NULL,
  suggested_reply text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create daily_metrics table
CREATE TABLE IF NOT EXISTS daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date UNIQUE NOT NULL,
  messages_sent int DEFAULT 0,
  messages_received int DEFAULT 0,
  ai_replies int DEFAULT 0,
  manual_replies int DEFAULT 0,
  escalations int DEFAULT 0,
  opt_outs int DEFAULT 0
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_contact_id ON escalations(contact_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date DESC);

-- Enable Row Level Security
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contacts (public read access for internal tool)
CREATE POLICY "Allow public read access to contacts"
  ON contacts
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- RLS Policies for messages (public read access)
CREATE POLICY "Allow public read access to messages"
  ON messages
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert to messages"
  ON messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- RLS Policies for escalations (public read and update access)
CREATE POLICY "Allow public read access to escalations"
  ON escalations
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public update to escalations"
  ON escalations
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for daily_metrics (public read access)
CREATE POLICY "Allow public read access to daily_metrics"
  ON daily_metrics
  FOR SELECT
  TO anon, authenticated
  USING (true);