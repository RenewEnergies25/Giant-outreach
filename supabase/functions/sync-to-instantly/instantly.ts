/**
 * Instantly API V2 Client
 *
 * This client handles all communication with the Instantly.ai API
 * for managing campaigns, leads, and tracking email events.
 *
 * API Docs: https://developer.instantly.ai/
 */

const INSTANTLY_API_URL = 'https://api.instantly.ai/api/v2';

export interface InstantlyLead {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  personalization?: string;
  phone?: string;
  website?: string;
  custom_variables?: Record<string, string | number | boolean | null>;
}

export interface InstantlySequenceStep {
  type: 'email';
  delay?: number; // Days to wait before sending this step (0 or omitted for first step)
  variants: Array<{
    subject: string;
    body: string;
    disabled?: boolean; // Optional - defaults to false (enabled)
  }>;
}

export interface InstantlySequence {
  steps: InstantlySequenceStep[];
}

export interface InstantlyCampaignSchedule {
  schedules: Array<{
    name?: string;
    timing: {
      from: string; // HH:MM format (e.g., "09:00")
      to: string;   // HH:MM format (e.g., "17:00")
    };
    days?: Record<string, boolean>; // { monday: true, tuesday: true, etc. }
    timezone: string; // REQUIRED - Must be from Instantly's 102-value IANA timezone enum
                      // Examples: "America/Chicago", "America/Boise", "Etc/GMT+12"
  }>;
}

export interface InstantlyCampaignCreate {
  name: string;
  sequences: InstantlySequence[];
  campaign_schedule: InstantlyCampaignSchedule;
  daily_limit?: number;
  stop_on_reply?: boolean;
  stop_on_auto_reply?: boolean;
  text_only?: boolean;
  link_tracking?: boolean;
  open_tracking?: boolean;
}

export interface InstantlyCampaign {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'draft' | 'error';
  created_at: string;
  updated_at: string;
}

export interface InstantlyLeadResponse {
  id: string;
  email: string;
  campaign_id: string;
  status: string;
  created_at: string;
}

export interface InstantlyApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export class InstantlyClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const url = `${INSTANTLY_API_URL}${endpoint}`;

      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // Log the full error response for debugging - SAFER LOGGING
        console.error(`[Instantly API Error] HTTP Status: ${response.status}`);
        console.error(`[Instantly API Error] Status Text: ${response.statusText}`);
        console.error(`[Instantly API Error] data.message: ${data.message || 'none'}`);
        console.error(`[Instantly API Error] data.error: ${data.error || 'none'}`);
        console.error(`[Instantly API Error] Full error keys: ${Object.keys(data).join(', ')}`);

        // Try to stringify but catch any errors
        try {
          console.error(`[Instantly API Error] Full response: ${JSON.stringify(data)}`);
        } catch (e) {
          console.error(`[Instantly API Error] Could not stringify response`);
        }

        return {
          success: false,
          error: data.message || data.error || `API Error: ${response.status}`,
        };
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // ============================================
  // CAMPAIGN ENDPOINTS
  // ============================================

  /**
   * Create a new campaign in Instantly
   */
  async createCampaign(campaign: InstantlyCampaignCreate): Promise<{ success: boolean; data?: InstantlyCampaign; error?: string }> {
    return this.request<InstantlyCampaign>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(campaign),
    });
  }

  /**
   * Get a campaign by ID
   */
  async getCampaign(campaignId: string): Promise<{ success: boolean; data?: InstantlyCampaign; error?: string }> {
    return this.request<InstantlyCampaign>(`/campaigns/${campaignId}`);
  }

  /**
   * List all campaigns
   */
  async listCampaigns(options?: {
    status?: string;
    limit?: number;
    skip?: number;
  }): Promise<{ success: boolean; data?: InstantlyCampaign[]; error?: string }> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.skip) params.append('skip', options.skip.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<InstantlyCampaign[]>(`/campaigns${query}`);
  }

  /**
   * Update a campaign
   */
  async updateCampaign(
    campaignId: string,
    updates: Partial<InstantlyCampaignCreate>
  ): Promise<{ success: boolean; data?: InstantlyCampaign; error?: string }> {
    return this.request<InstantlyCampaign>(`/campaigns/${campaignId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
    return this.request(`/campaigns/${campaignId}/pause`, {
      method: 'POST',
    });
  }

  /**
   * Activate/resume a campaign
   */
  async activateCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
    return this.request(`/campaigns/${campaignId}/activate`, {
      method: 'POST',
    });
  }

  // ============================================
  // LEAD ENDPOINTS
  // ============================================

  /**
   * Add leads to a campaign
   */
  async addLeadsToCampaign(
    campaignId: string,
    leads: InstantlyLead[]
  ): Promise<{ success: boolean; data?: { added: number; failed: number }; error?: string }> {
    const payload = {
      campaign_id: campaignId,
      leads: leads,
    };

    console.log(`[Instantly API] Adding ${leads.length} leads to campaign ${campaignId}`);

    // CRITICAL: Log the actual payload being sent
    const payloadString = JSON.stringify(payload);
    console.log(`[Instantly API] Payload length: ${payloadString.length} chars`);
    console.log(`[Instantly API] Payload first 500 chars:`, payloadString.substring(0, 500));

    // Check if email exists in stringified payload
    const hasEmailInPayload = payloadString.includes('"email":"');
    console.log(`[Instantly API] Payload contains email field: ${hasEmailInPayload}`);

    // Safer logging without JSON.stringify
    if (leads.length > 0) {
      const first = leads[0];
      console.log(`[Instantly API] First lead email BEFORE stringify: "${first.email}"`);
      console.log(`[Instantly API] First lead email type: ${typeof first.email}`);
      console.log(`[Instantly API] First lead has email: ${!!first.email}`);
      console.log(`[Instantly API] Payload campaign_id: ${campaignId}`);
      console.log(`[Instantly API] Payload has leads array: ${Array.isArray(leads)}`);
    }

    // Use the correct bulk add endpoint
    return this.request(`/lead/bulkaddleads`, {
      method: 'POST',
      body: payloadString,
    });
  }

  /**
   * Get a lead by ID
   */
  async getLead(leadId: string): Promise<{ success: boolean; data?: InstantlyLeadResponse; error?: string }> {
    return this.request<InstantlyLeadResponse>(`/leads/${leadId}`);
  }

  /**
   * List leads (POST endpoint due to complex filtering)
   */
  async listLeads(options: {
    campaign_id?: string;
    email?: string;
    status?: string;
    limit?: number;
    skip?: number;
  }): Promise<{ success: boolean; data?: InstantlyLeadResponse[]; error?: string }> {
    return this.request<InstantlyLeadResponse[]>('/leads/list', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  /**
   * Update a lead
   */
  async updateLead(
    leadId: string,
    updates: Partial<InstantlyLead>
  ): Promise<{ success: boolean; data?: InstantlyLeadResponse; error?: string }> {
    return this.request<InstantlyLeadResponse>(`/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete leads
   */
  async deleteLeads(leadIds: string[]): Promise<{ success: boolean; error?: string }> {
    return this.request('/leads', {
      method: 'DELETE',
      body: JSON.stringify({ lead_ids: leadIds }),
    });
  }

  /**
   * Move leads to another campaign
   */
  async moveLeads(
    leadIds: string[],
    targetCampaignId: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.request('/leads/move', {
      method: 'POST',
      body: JSON.stringify({
        lead_ids: leadIds,
        campaign_id: targetCampaignId,
      }),
    });
  }

  // ============================================
  // ACCOUNT ENDPOINTS
  // ============================================

  /**
   * List sending accounts
   */
  async listAccounts(): Promise<{ success: boolean; data?: Array<{ id: string; email: string; name: string }>; error?: string }> {
    return this.request('/accounts');
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    const result = await this.listAccounts();
    return { success: result.success, error: result.error };
  }

  // ============================================
  // ANALYTICS ENDPOINTS
  // ============================================

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<{
    success: boolean;
    data?: {
      sent: number;
      opened: number;
      clicked: number;
      replied: number;
      bounced: number;
    };
    error?: string;
  }> {
    return this.request(`/campaigns/${campaignId}/analytics`);
  }
}

/**
 * Create an Instantly client from environment variable
 */
export function createInstantlyClient(): InstantlyClient | null {
  const apiKey = Deno.env.get('INSTANTLY_API_KEY');
  if (!apiKey) {
    console.error('INSTANTLY_API_KEY environment variable not set');
    return null;
  }
  return new InstantlyClient(apiKey);
}

/**
 * Create an Instantly client from a provided API key
 */
export function createInstantlyClientWithKey(apiKey: string): InstantlyClient {
  return new InstantlyClient(apiKey);
}
