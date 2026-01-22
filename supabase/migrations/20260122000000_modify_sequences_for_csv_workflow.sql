/*
  # Modify Campaign Email Sequences for CSV Workflow

  This migration adapts the campaign_email_sequences table to work with the CSV workflow:
  - Makes template_id optional (nullable)
  - Adds body_html field for inline email bodies
  - Sequences can now work without templates (for follow-up emails in CSV campaigns)

  Workflow:
  1. Initial email comes from campaign_leads (uploaded via CSV)
  2. Follow-up sequences are defined in campaign_email_sequences
  3. Each sequence can have its own body or reference a template
*/

-- Make template_id nullable (sequences can work without templates)
ALTER TABLE campaign_email_sequences
  ALTER COLUMN template_id DROP NOT NULL;

-- Add body fields for inline email content (alternative to templates)
ALTER TABLE campaign_email_sequences
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS body_text text,
  ADD COLUMN IF NOT EXISTS subject_line text;

-- Add comments for clarity
COMMENT ON COLUMN campaign_email_sequences.template_id IS
  'Optional: Reference to email template. If null, body_html and subject_line must be provided.';

COMMENT ON COLUMN campaign_email_sequences.body_html IS
  'Inline HTML email body. Used when template_id is null (CSV workflow with follow-ups).';

COMMENT ON COLUMN campaign_email_sequences.subject_line IS
  'Email subject line. Can be literal text or use variables like {{first_name}}.';

-- Add check constraint: either template_id OR body_html must be present
ALTER TABLE campaign_email_sequences
  ADD CONSTRAINT check_sequence_has_content
  CHECK (template_id IS NOT NULL OR (body_html IS NOT NULL AND subject_line IS NOT NULL));

COMMENT ON CONSTRAINT check_sequence_has_content ON campaign_email_sequences IS
  'Ensures each sequence has content: either via template_id OR inline body_html + subject_line.';
