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
