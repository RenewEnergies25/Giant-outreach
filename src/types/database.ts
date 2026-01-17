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
  direction: 'inbound' | 'outbound';
  channel: 'sms' | 'whatsapp' | 'email';
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
