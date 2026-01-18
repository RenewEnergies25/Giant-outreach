// ============================================
// CONVERSATION STAGES
// ============================================
export type ConversationStage =
  | 'initial'
  | 'in_conversation'
  | 'calendar_link_sent'
  | 'booked'
  | 'stalled'
  | 'opted_out'
  | 'completed'

// ============================================
// CAMPAIGN STATUS
// ============================================
export type CampaignStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived'

// ============================================
// CHANNEL TYPES
// ============================================
export type Channel = 'sms' | 'whatsapp' | 'email'

// ============================================
// CHANNEL STATUS (for campaign contacts)
// ============================================
export type ChannelStatus =
  | 'active'
  | 'paused'
  | 'opted_out'
  | 'completed'
  | 'bounced'

// ============================================
// MESSAGE TYPES
// ============================================
export type MessageType =
  | 'conversation'
  | 'bump'
  | 'calendar_sent'
  | 'opt_out'
  | 'manual'

// ============================================
// MESSAGE INTENT (detected by AI)
// ============================================
export type MessageIntent =
  | 'answer'
  | 'question'
  | 'objection'
  | 'agreement'
  | 'rejection'
  | 'unclear'

// ============================================
// ESCALATION TYPES
// ============================================
export type EscalationType =
  | 'booked'
  | 'calendar_sent'
  | 'needs_review'

// ============================================
// CONTACT INTERFACE
// ============================================
export interface Contact {
  id: string;
  ghl_contact_id: string | null;
  ghl_location_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  full_name: string | null;

  // Conversation stage tracking
  conversation_stage: ConversationStage;

  // Status flags
  is_qualified: boolean;
  qualified_at: string | null;
  is_opted_out: boolean;
  opted_out_at: string | null;
  calendar_link_sent: boolean;
  calendar_link_sent_at: string | null;
  call_back_time: string | null;

  // Conversation metrics
  bump_count: number;
  last_bump_at: string | null;
  questions_asked: number;
  message_count: number;
  last_message_at: string | null;

  // Escalation flag
  needs_human_review: boolean;

  // GHL Tags
  ghl_tags: string[] | null;

  // Legacy fields (keeping for backwards compatibility)
  status: string;

  // Channel preferences
  preferred_channel: Channel;

  // Per-channel opt-out status
  sms_opted_out: boolean;
  sms_opted_out_at: string | null;
  whatsapp_opted_out: boolean;
  whatsapp_opted_out_at: string | null;
  email_opted_out: boolean;
  email_opted_out_at: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================
// MESSAGE INTERFACE
// ============================================
export interface Message {
  id: string;
  contact_id: string | null;
  ghl_contact_id: string | null;
  contact_email: string | null;
  campaign_id: string | null;
  direction: 'inbound' | 'outbound';
  channel: Channel;
  content: string;

  // Message type
  message_type: MessageType;

  // AI tracking
  ai_generated: boolean;
  ai_classification: string | null;
  detected_intent: MessageIntent | null;

  // Bump tracking
  bump_number: number | null;

  // Legacy fields
  template_used: string | null;

  // Timestamps
  created_at: string;
}

// ============================================
// ESCALATION INTERFACE
// ============================================
export interface Escalation {
  id: string;
  contact_id: string | null;
  message_id: string | null;
  campaign_id: string | null;
  channel: Channel | null;

  // Escalation details
  escalation_type: EscalationType;
  reason: string;

  // Appointment details (for booked type)
  appointment_time: string | null;
  calendar_name: string | null;

  // Status
  status: 'pending' | 'resolved' | 'dismissed';
  resolved_by: string | null;
  resolved_at: string | null;

  // Legacy fields
  suggested_reply: string | null;

  // Timestamps
  created_at: string;
}

// ============================================
// DAILY METRICS INTERFACE
// ============================================
export interface DailyMetric {
  id: string;
  date: string;

  // Message counts
  messages_sent: number;
  messages_received: number;
  bumps_sent: number;

  // Outcome counts
  calendar_links_sent: number;
  bookings: number;
  opt_outs: number;
  human_reviews: number;

  // Legacy fields
  ai_replies: number;
  manual_replies: number;
  escalations: number;
}

// ============================================
// DASHBOARD STATS INTERFACE
// ============================================
export interface DashboardStats {
  total_contacts: number;
  active_conversations: number;
  calendar_links_sent: number;
  qualified_pending: number;
  needs_review_pending: number;
  messages_today: number;
  bookings_today: number;
  opt_outs_today: number;
}

// ============================================
// COMPOSITE TYPES
// ============================================
export interface ContactWithLastMessage extends Contact {
  last_message?: Message;
}

export interface EscalationWithContact extends Escalation {
  contact?: Contact;
}

// ============================================
// CAMPAIGN INTERFACE
// ============================================

// VSL (Video Sales Letter) object structure
export interface CampaignVSL {
  url: string;
  title?: string;
  thumbnail_url?: string;
  channel?: Channel; // Optional: specific channel this VSL is for
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;

  // Channel configuration
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;

  // Campaign settings
  daily_message_limit: number;
  bump_delay_hours: number;
  max_bumps: number;

  // VSL (Video Sales Letter) configuration
  vsl_url: string | null;
  vsl_thumbnail_url: string | null;
  vsl_title: string | null;
  vsls: CampaignVSL[]; // Multiple VSLs support

  // Timestamps
  created_at: string;
  updated_at: string;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
}

// ============================================
// CAMPAIGN CONTACT INTERFACE
// ============================================
export interface CampaignContact {
  id: string;
  campaign_id: string;
  contact_id: string;

  // Enrollment tracking
  enrolled_at: string;
  enrolled_by: string | null;

  // Channel-specific status
  sms_status: ChannelStatus;
  whatsapp_status: ChannelStatus;
  email_status: ChannelStatus;

  // Exit tracking
  exited_at: string | null;
  exit_reason: string | null;

  // Campaign-specific stage
  campaign_stage: ConversationStage;

  // Channel-specific metrics
  sms_sent: number;
  sms_received: number;
  whatsapp_sent: number;
  whatsapp_received: number;
  email_sent: number;
  email_received: number;

  // Timestamps
  last_sms_at: string | null;
  last_whatsapp_at: string | null;
  last_email_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// CAMPAIGN METRICS INTERFACE
// ============================================
export interface CampaignMetric {
  id: string;
  campaign_id: string;
  date: string;
  channel: Channel | 'all';

  // Message counts
  messages_sent: number;
  messages_received: number;
  bumps_sent: number;

  // Outcomes
  calendar_links_sent: number;
  bookings: number;
  opt_outs: number;
  bounces: number;

  // Engagement metrics
  response_rate: number;
  avg_response_time_minutes: number | null;

  created_at: string;
  updated_at: string;
}

// ============================================
// CAMPAIGN STATS INTERFACE
// ============================================
export interface CampaignStats {
  total_contacts: number;
  active_contacts: number;
  in_conversation: number;
  calendar_sent: number;
  booked: number;
  opted_out: number;
  messages_sent_today: number;
  messages_received_today: number;
  channel_breakdown: {
    [key in Channel]?: {
      sent: number;
      received: number;
      opt_outs: number;
      bookings: number;
    };
  } | null;
}

// ============================================
// ENHANCED DASHBOARD STATS
// ============================================
export interface EnhancedDashboardStats extends DashboardStats {
  active_campaigns: number;
  total_campaigns: number;
}

// ============================================
// COMPOSITE TYPES FOR CAMPAIGNS
// ============================================
export interface CampaignWithStats extends Campaign {
  stats?: CampaignStats;
}

export interface CampaignContactWithContact extends CampaignContact {
  contact?: Contact;
}

export interface CampaignContactWithCampaign extends CampaignContact {
  campaign?: Campaign;
}

// ============================================
// INSTANTLY CONFIGURATION
// ============================================
export interface InstantlyConfig {
  id: string;
  api_key: string;
  workspace_id: string | null;
  webhook_secret: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// EMAIL TEMPLATES
// ============================================
export interface EmailTemplate {
  id: string;
  name: string;
  description: string | null;

  // Email content
  body_html: string;
  body_text: string | null;

  // Subject line settings
  subject_line: string | null;
  use_ai_subject: boolean;
  ai_subject_prompt: string | null;

  // Template variables
  variables: string[];

  // Categorization
  category: 'initial' | 'follow_up' | 'closing' | 'reminder' | 'other' | null;
  tags: string[] | null;

  // Status
  is_active: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================
// CAMPAIGN EMAIL SEQUENCES
// ============================================
export interface CampaignEmailSequence {
  id: string;
  campaign_id: string;
  template_id: string;

  // Sequence order and timing
  sequence_order: number;
  delay_days: number;
  delay_hours: number;

  // Override settings
  subject_override: string | null;
  use_ai_subject: boolean;

  // Sending conditions
  send_condition: 'always' | 'if_no_reply' | 'if_opened' | 'if_clicked' | null;

  // Status
  is_active: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Joined data
  template?: EmailTemplate;
}

// ============================================
// INSTANTLY EVENTS
// ============================================
export type InstantlyEventType =
  | 'sent'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounced'
  | 'unsubscribed';

export interface InstantlyEvent {
  id: string;
  campaign_id: string | null;
  contact_id: string | null;
  campaign_contact_id: string | null;

  // Instantly IDs
  instantly_campaign_id: string | null;
  instantly_lead_id: string | null;
  instantly_email_id: string | null;

  // Event details
  event_type: InstantlyEventType;
  event_data: Record<string, unknown> | null;

  // Timestamps
  event_timestamp: string | null;
  created_at: string;
}

// ============================================
// GENERATED SUBJECTS
// ============================================
export interface GeneratedSubject {
  id: string;
  campaign_id: string | null;
  contact_id: string | null;
  template_id: string | null;
  sequence_id: string | null;

  subject_line: string;
  prompt_used: string | null;

  is_used: boolean;
  used_at: string | null;

  created_at: string;
}

// ============================================
// BULK UPLOADS
// ============================================
export type BulkUploadType = 'email_templates' | 'contacts' | 'email_bodies';
export type BulkUploadStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BulkUpload {
  id: string;
  upload_type: BulkUploadType;
  file_name: string | null;

  total_rows: number;
  successful_rows: number;
  failed_rows: number;

  status: BulkUploadStatus;
  error_message: string | null;
  errors: Array<{ row: number; error: string }>;

  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// ============================================
// EXTENDED CAMPAIGN WITH INSTANTLY FIELDS
// ============================================
export interface CampaignWithInstantly extends Campaign {
  instantly_campaign_id: string | null;
  instantly_status: string | null;
  instantly_synced_at: string | null;
  instantly_account_id: string | null;
  from_name: string | null;
  reply_to_email: string | null;
}

// ============================================
// EXTENDED CONTACT WITH INSTANTLY FIELDS
// ============================================
export interface ContactWithInstantly extends Contact {
  instantly_lead_id: string | null;
  company: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  website: string | null;
  custom_variables: Record<string, string | number | boolean>;
}

// ============================================
// EXTENDED CAMPAIGN CONTACT WITH EMAIL STATS
// ============================================
export interface CampaignContactWithEmailStats extends CampaignContact {
  instantly_lead_id: string | null;
  instantly_status: string | null;
  email_sent_count: number;
  email_opened_count: number;
  email_clicked_count: number;
  email_replied: boolean;
  email_bounced: boolean;
  last_email_sent_at: string | null;
  last_email_opened_at: string | null;
}

// ============================================
// INSTANTLY API TYPES
// ============================================
export interface InstantlyLead {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  personalization?: string;
  phone?: string;
  website?: string;
  custom_variables?: Record<string, string>;
}

export interface InstantlyCampaignCreate {
  name: string;
  sequences: InstantlySequence[];
}

export interface InstantlySequence {
  steps: InstantlySequenceStep[];
}

export interface InstantlySequenceStep {
  type: 'email';
  subject: string;
  body: string;
  delay?: number; // Delay in days
}

export interface InstantlyApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

