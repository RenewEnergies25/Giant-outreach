import { CampaignLead } from '../types/database';

/**
 * Validation result for a single lead
 */
export interface LeadValidationResult {
  isValid: boolean;
  reasons: string[];
}

/**
 * Aggregated validation stats for a list of leads
 */
export interface LeadValidationStats {
  validCount: number;
  invalidCount: number;
  noEmailCount: number;
  lowConfidenceCount: number;
  invalidBodyCount: number;
  validLeads: CampaignLead[];
  invalidLeads: Array<{ lead: CampaignLead; reasons: string[] }>;
}

// Minimum confidence score for emails (0-100)
const MIN_EMAIL_CONFIDENCE = 50;

// Minimum email body length
const MIN_BODY_LENGTH = 100;

// Patterns that indicate placeholder/invalid content
const INVALID_BODY_PATTERNS = [
  /\{\{[^}]+\}\}/i,           // Template variables like {{name}}
  /\[\s*INSERT[^\]]*\]/i,     // [INSERT NAME], [INSERT COMPANY]
  /\[\s*NAME\s*\]/i,          // [NAME]
  /\[\s*COMPANY\s*\]/i,       // [COMPANY]
  /PLACEHOLDER/i,              // PLACEHOLDER text
  /lorem\s+ipsum/i,            // Lorem ipsum
  /\[YOUR[^\]]*\]/i,          // [YOUR NAME], [YOUR COMPANY]
  /XXX+/i,                     // XXX placeholders
  /TODO:/i,                    // TODO markers
  /FIXME:/i,                   // FIXME markers
];

// Patterns that indicate a valid email (at least one should match)
const VALID_EMAIL_INDICATORS = [
  /^(hi|hello|hey|dear|good\s+(morning|afternoon|evening))/i,  // Greeting at start
  /\?/,                                                          // Contains a question
  /(let\s+me\s+know|get\s+back|reach\s+out|schedule|call|chat|meeting|connect)/i, // CTA phrases
  /(best|regards|thanks|cheers|sincerely)/i,                    // Closing phrases
];

/**
 * Check if email address is valid
 */
export function isValidEmail(lead: CampaignLead): { valid: boolean; reason?: string } {
  // No email address
  if (!lead.email_address || lead.email_address.trim() === '') {
    return { valid: false, reason: 'No email address found' };
  }

  // Email status is not 'found'
  if (lead.email_status !== 'found') {
    return { valid: false, reason: `Email status: ${lead.email_status}` };
  }

  // Low confidence score
  if (lead.email_confidence_score !== null && lead.email_confidence_score < MIN_EMAIL_CONFIDENCE) {
    return { valid: false, reason: `Low email confidence (${lead.email_confidence_score}%)` };
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(lead.email_address)) {
    return { valid: false, reason: 'Invalid email format' };
  }

  return { valid: true };
}

/**
 * Check if email body is valid (not a hallucination or placeholder)
 */
export function isValidEmailBody(lead: CampaignLead): { valid: boolean; reason?: string } {
  const body = lead.email_body;

  // No body
  if (!body || body.trim() === '') {
    return { valid: false, reason: 'No email body' };
  }

  // Too short
  if (body.length < MIN_BODY_LENGTH) {
    return { valid: false, reason: `Email body too short (${body.length} chars, min ${MIN_BODY_LENGTH})` };
  }

  // Check for invalid patterns
  for (const pattern of INVALID_BODY_PATTERNS) {
    if (pattern.test(body)) {
      return { valid: false, reason: 'Email body contains placeholder text' };
    }
  }

  // Check if body has at least one valid email indicator
  const hasValidIndicator = VALID_EMAIL_INDICATORS.some(pattern => pattern.test(body));
  if (!hasValidIndicator) {
    return { valid: false, reason: 'Email body missing greeting or call-to-action' };
  }

  // Check for personalization (should mention company or have some specific content)
  const hasPersonalization =
    (lead.company_name && body.toLowerCase().includes(lead.company_name.toLowerCase())) ||
    (lead.first_name && body.toLowerCase().includes(lead.first_name.toLowerCase())) ||
    body.length > 200; // Longer emails likely have specific content

  if (!hasPersonalization) {
    return { valid: false, reason: 'Email body lacks personalization' };
  }

  return { valid: true };
}

/**
 * Validate a single lead
 */
export function validateLead(lead: CampaignLead): LeadValidationResult {
  const reasons: string[] = [];

  const emailCheck = isValidEmail(lead);
  if (!emailCheck.valid && emailCheck.reason) {
    reasons.push(emailCheck.reason);
  }

  const bodyCheck = isValidEmailBody(lead);
  if (!bodyCheck.valid && bodyCheck.reason) {
    reasons.push(bodyCheck.reason);
  }

  // Must have a subject line
  if (!lead.subject_line || lead.subject_line.trim() === '') {
    reasons.push('No subject line generated');
  }

  return {
    isValid: reasons.length === 0,
    reasons,
  };
}

/**
 * Validate a list of leads and return stats
 */
export function validateLeads(leads: CampaignLead[]): LeadValidationStats {
  const validLeads: CampaignLead[] = [];
  const invalidLeads: Array<{ lead: CampaignLead; reasons: string[] }> = [];

  let noEmailCount = 0;
  let lowConfidenceCount = 0;
  let invalidBodyCount = 0;

  for (const lead of leads) {
    const result = validateLead(lead);

    if (result.isValid) {
      validLeads.push(lead);
    } else {
      invalidLeads.push({ lead, reasons: result.reasons });

      // Count specific issues
      if (result.reasons.some(r => r.includes('No email') || r.includes('email status'))) {
        noEmailCount++;
      }
      if (result.reasons.some(r => r.includes('confidence'))) {
        lowConfidenceCount++;
      }
      if (result.reasons.some(r =>
        r.includes('body') || r.includes('placeholder') || r.includes('personalization')
      )) {
        invalidBodyCount++;
      }
    }
  }

  return {
    validCount: validLeads.length,
    invalidCount: invalidLeads.length,
    noEmailCount,
    lowConfidenceCount,
    invalidBodyCount,
    validLeads,
    invalidLeads,
  };
}

/**
 * Get a summary string for validation stats
 */
export function getValidationSummary(stats: LeadValidationStats): string {
  if (stats.invalidCount === 0) {
    return `All ${stats.validCount} leads are valid and ready to send.`;
  }

  const parts: string[] = [];
  if (stats.noEmailCount > 0) {
    parts.push(`${stats.noEmailCount} missing email`);
  }
  if (stats.lowConfidenceCount > 0) {
    parts.push(`${stats.lowConfidenceCount} low confidence`);
  }
  if (stats.invalidBodyCount > 0) {
    parts.push(`${stats.invalidBodyCount} invalid body`);
  }

  return `${stats.validCount} valid, ${stats.invalidCount} skipped (${parts.join(', ')})`;
}
