import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================
// INSTANTLY API CLIENT (INLINED)
// ============================================

const INSTANTLY_API_URL = 'https://api.instantly.ai/api/v2';

interface InstantlyLead {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  personalization?: string;
  phone?: string;
  website?: string;
  custom_variables?: Record<string, string | number | boolean | null>;
}

interface InstantlySequenceStep {
  type: 'email';
  delay?: number;
  variants: Array<{
    subject: string;
    body: string;
    disabled?: boolean;
  }>;
}

interface InstantlySequence {
  steps: InstantlySequenceStep[];
}

interface InstantlyCampaignSchedule {
  schedules: Array<{
    name?: string;
    timing: {
      from: string;
      to: string;
    };
    days?: Record<string, boolean>;
    timezone: string;
  }>;
}

interface InstantlyCampaignCreate {
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

interface InstantlyCampaign {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'draft' | 'error';
  created_at: string;
  updated_at: string;
}

class InstantlyClient {
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

      // For DELETE requests, don't send Content-Type or body
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.apiKey}`,
        ...(options.headers as Record<string, string> || {}),
      };

      // Only add Content-Type for non-DELETE requests
      if (options.method !== 'DELETE') {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(`[Instantly API Error] HTTP Status: ${response.status}`);
        console.error(`[Instantly API Error] Status Text: ${response.statusText}`);
        console.error(`[Instantly API Error] data.message: ${data.message || 'none'}`);
        console.error(`[Instantly API Error] data.error: ${data.error || 'none'}`);
        console.error(`[Instantly API Error] Full error keys: ${Object.keys(data).join(', ')}`);

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

      console.log(`[Instantly API Success] HTTP Status: ${response.status}`);
      console.log(`[Instantly API Success] Response data:`, JSON.stringify(data, null, 2));
      console.log(`[Instantly API Success] Response keys:`, Object.keys(data || {}).join(', '));

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async createCampaign(campaign: InstantlyCampaignCreate): Promise<{ success: boolean; data?: InstantlyCampaign; error?: string }> {
    return this.request<InstantlyCampaign>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(campaign),
    });
  }

  async addLeadsToCampaign(
    campaignId: string,
    leads: InstantlyLead[]
  ): Promise<{ success: boolean; data?: { added: number; failed: number }; error?: string }> {
    const payload = {
      campaign_id: campaignId,
      leads: leads,
      skip_if_in_campaign: true,
      skip_if_in_workspace: false,
    };

    console.log(`[Instantly API] Adding ${leads.length} leads to campaign ${campaignId}`);

    const payloadString = JSON.stringify(payload);
    console.log(`[Instantly API] Payload length: ${payloadString.length} chars`);
    console.log(`[Instantly API] Payload first 500 chars:`, payloadString.substring(0, 500));

    const hasEmailInPayload = payloadString.includes('"email":"');
    console.log(`[Instantly API] Payload contains email field: ${hasEmailInPayload}`);

    if (leads.length > 0) {
      const first = leads[0];
      console.log(`[Instantly API] First lead email BEFORE stringify: "${first.email}"`);
      console.log(`[Instantly API] First lead email type: ${typeof first.email}`);
      console.log(`[Instantly API] First lead has email: ${!!first.email}`);
      console.log(`[Instantly API] Payload campaign_id: ${campaignId}`);
      console.log(`[Instantly API] Payload has leads array: ${Array.isArray(leads)}`);
    }

    const result = await this.request(`/leads/add`, {
      method: 'POST',
      body: payloadString,
    });

    if (result.success && result.data) {
      const responseData = result.data as any;
      return {
        success: true,
        data: {
          added: responseData.leads_uploaded || 0,
          failed: (responseData.total_sent || 0) - (responseData.leads_uploaded || 0),
        },
      };
    }

    return result;
  }

  async deleteCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[Instantly API] Deleting campaign ${campaignId}`);
    return this.request(`/campaigns/${campaignId}`, {
      method: 'DELETE',
    });
  }

  async activateCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
    return this.request(`/campaigns/${campaignId}/activate`, {
      method: 'POST',
    });
  }

  async pauseCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
    return this.request(`/campaigns/${campaignId}/pause`, {
      method: 'POST',
    });
  }
}

// ============================================
// EDGE FUNCTION
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  campaign_id: string;
  action: 'create' | 'sync_leads' | 'activate' | 'pause' | 'full_sync' | 'reset_and_resync';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SyncRequest = await req.json();
    const { campaign_id, action } = body;

    // Get Instantly API key from config
    const { data: config, error: configError } = await supabase
      .from('instantly_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('Instantly API not configured. Please add your API key in Settings.');
    }

    const instantly = new InstantlyClient(config.api_key);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    let result: Record<string, unknown> = {};

    switch (action) {
      case 'create':
      case 'full_sync':
        result = await handleCreateOrFullSync(supabase, instantly, campaign, action === 'full_sync');
        break;
      case 'sync_leads':
        result = await handleSyncLeads(supabase, instantly, campaign);
        break;
      case 'activate':
        result = await handleActivate(supabase, instantly, campaign);
        break;
      case 'pause':
        result = await handlePause(supabase, instantly, campaign);
        break;
      case 'reset_and_resync':
        result = await handleResetAndResync(supabase, instantly, campaign);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function handleCreateOrFullSync(
  supabase: ReturnType<typeof createClient>,
  instantly: InstantlyClient,
  campaign: Record<string, unknown>,
  syncLeads: boolean
) {
  // Check if this campaign uses campaign_leads workflow (per-lead custom emails)
  const { data: leads, error: leadsError } = await supabase
    .from('campaign_leads')
    .select('id')
    .eq('campaign_id', campaign.id)
    .limit(1);

  if (leadsError) {
    throw new Error('Failed to check campaign leads');
  }

  const usesLeadsWorkflow = leads && leads.length > 0;

  if (!usesLeadsWorkflow) {
    throw new Error('No campaign leads found. Upload a CSV file with leads first.');
  }

  // Get follow-up sequences (optional - can be empty for single-email campaigns)
  const { data: sequences } = await supabase
    .from('campaign_email_sequences')
    .select('*')
    .eq('campaign_id', campaign.id)
    .eq('is_active', true)
    .order('sequence_order', { ascending: true });

  console.log(`Building Instantly sequence: Initial email (from CSV) + ${sequences?.length || 0} follow-ups`);

  // Build Instantly steps:
  // Step 1: Initial email from campaign_leads (uses {{subject_line}} and {{email_body}} variables)
  const instantlySteps = [
    {
      type: 'email' as const,
      delay: 0,
      variants: [
        {
          subject: '{{subject_line}}',
          body: '{{email_body}}',
        }
      ],
    }
  ];

  // Steps 2+: Follow-up emails from campaign_email_sequences (if any)
  if (sequences && sequences.length > 0) {
    for (const seq of sequences) {
      const delayDays = (seq.delay_days as number) || 0;
      const delayHours = (seq.delay_hours as number) || 0;

      // Instantly API expects delay in HOURS, not days
      const totalDelayInHours = (delayDays * 24) + delayHours;

      console.log(`[Sequence Delay Debug] Sequence #${seq.sequence_order}:`);
      console.log(`  - Raw delay_days from DB: ${seq.delay_days} (type: ${typeof seq.delay_days})`);
      console.log(`  - Raw delay_hours from DB: ${seq.delay_hours} (type: ${typeof seq.delay_hours})`);
      console.log(`  - Calculated totalDelayInHours: ${totalDelayInHours} hours (${delayDays}d ${delayHours}h)`);
      console.log(`  - Will send to Instantly as: delay: ${totalDelayInHours}`);

      // Check if sequence has inline content or uses template
      let subject: string;
      let body: string;

      if (seq.subject_line && seq.body_html) {
        // Inline content (CSV workflow with follow-ups)
        subject = seq.subject_line;
        body = seq.body_html;
      } else if (seq.template_id) {
        // Template-based (fetch from email_templates)
        const { data: template } = await supabase
          .from('email_templates')
          .select('*')
          .eq('id', seq.template_id)
          .single();

        if (template) {
          subject = seq.subject_override || template.subject_line || 'Follow-up';
          body = template.body_html;
        } else {
          console.warn(`Template ${seq.template_id} not found for sequence ${seq.id}`);
          continue;
        }
      } else {
        console.warn(`Sequence ${seq.id} has neither inline content nor template_id`);
        continue;
      }

      instantlySteps.push({
        type: 'email' as const,
        delay: totalDelayInHours,
        variants: [
          {
            subject,
            body,
          }
        ],
      });
    }
  }

  console.log(`Created ${instantlySteps.length} email steps for Instantly campaign`);

  let instantlyCampaignId = campaign.instantly_campaign_id as string | null;

  // Create campaign in Instantly if not exists
  if (!instantlyCampaignId) {
    // Validate campaign name
    const campaignName = campaign.name as string;
    if (!campaignName || campaignName.trim().length === 0) {
      throw new Error('Campaign name is required to create an Instantly campaign');
    }

    const createResult = await instantly.createCampaign({
      name: campaignName,
      sequences: [{ steps: instantlySteps }],
      campaign_schedule: {
        schedules: [
          {
            name: 'Business Hours',
            timing: {
              from: '09:00',
              to: '17:00',
            },
            days: {
              monday: true,
              tuesday: true,
              wednesday: true,
              thursday: true,
              friday: true,
              saturday: false,
              sunday: false,
            },
            timezone: 'America/Chicago', // Using confirmed timezone from Instantly API docs enum
          },
        ],
      },
      stop_on_reply: true,
      stop_on_auto_reply: true,
      open_tracking: true,
      link_tracking: true,
    });

    if (!createResult.success || !createResult.data) {
      throw new Error(`Failed to create Instantly campaign: ${createResult.error}`);
    }

    instantlyCampaignId = createResult.data.id;

    // Update local campaign with Instantly ID
    await supabase
      .from('campaigns')
      .update({
        instantly_campaign_id: instantlyCampaignId,
        instantly_status: 'draft',
        instantly_synced_at: new Date().toISOString(),
      })
      .eq('id', campaign.id);
  }

  let leadsResult = { added: 0, failed: 0 };

  if (syncLeads) {
    leadsResult = await syncLeadsToInstantly(supabase, instantly, campaign, instantlyCampaignId, usesLeadsWorkflow);
  }

  return {
    instantly_campaign_id: instantlyCampaignId,
    sequences_synced: usesLeadsWorkflow ? 1 : (sequences?.length || 0),
    leads_added: leadsResult.added,
    leads_failed: leadsResult.failed,
  };
}

async function handleSyncLeads(
  supabase: ReturnType<typeof createClient>,
  instantly: InstantlyClient,
  campaign: Record<string, unknown>
) {
  if (!campaign.instantly_campaign_id) {
    throw new Error('Campaign not yet synced to Instantly. Run full sync first.');
  }

  // Detect workflow type
  const { data: leads } = await supabase
    .from('campaign_leads')
    .select('id')
    .eq('campaign_id', campaign.id)
    .limit(1);

  const usesLeadsWorkflow = leads && leads.length > 0;

  const result = await syncLeadsToInstantly(
    supabase,
    instantly,
    campaign,
    campaign.instantly_campaign_id as string,
    usesLeadsWorkflow
  );

  return result;
}

async function syncLeadsToInstantly(
  supabase: ReturnType<typeof createClient>,
  instantly: InstantlyClient,
  campaign: Record<string, unknown>,
  instantlyCampaignId: string,
  usesLeadsWorkflow: boolean = false
) {
  if (usesLeadsWorkflow) {
    // Handle campaign_leads workflow (per-lead custom emails)
    return await syncCampaignLeadsToInstantly(supabase, instantly, campaign, instantlyCampaignId);
  }

  // Handle campaign_contacts workflow (template-based)
  // Get contacts for this campaign that haven't been synced
  const { data: campaignContacts, error: contactsError } = await supabase
    .from('campaign_contacts')
    .select(`
      *,
      contact:contacts(*)
    `)
    .eq('campaign_id', campaign.id)
    .is('instantly_lead_id', null);

  if (contactsError) {
    throw new Error('Failed to fetch campaign contacts');
  }

  if (!campaignContacts || campaignContacts.length === 0) {
    return { added: 0, failed: 0, message: 'No new contacts to sync' };
  }

  // Get email sequences for subject generation context
  const { data: sequences } = await supabase
    .from('campaign_email_sequences')
    .select(`*, template:email_templates(*)`)
    .eq('campaign_id', campaign.id)
    .eq('is_active', true)
    .order('sequence_order', { ascending: true })
    .limit(1);

  const firstSequence = sequences?.[0];
  const template = firstSequence?.template as Record<string, unknown> | undefined;

  // Generate subject lines and prepare leads
  const leads = [];
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

  for (const cc of campaignContacts) {
    const contact = cc.contact as Record<string, unknown>;

    let subjectLine = template?.subject_line as string | null;

    // Generate AI subject if enabled
    if (template?.use_ai_subject && openaiApiKey) {
      try {
        const subjectResponse = await generateSubjectLine(
          openaiApiKey,
          {
            first_name: contact.first_name as string,
            last_name: contact.last_name as string,
            company: contact.company as string,
            job_title: contact.job_title as string,
          },
          {
            name: campaign.name as string,
            target_audience: campaign.target_audience as string,
          },
          template
        );
        subjectLine = subjectResponse;

        // Save generated subject
        await supabase.from('generated_subjects').insert({
          campaign_id: campaign.id,
          contact_id: contact.id,
          template_id: template.id,
          sequence_id: firstSequence?.id,
          subject_line: subjectLine,
          prompt_used: template.ai_subject_prompt || 'default',
        });
      } catch (err) {
        console.error('Failed to generate subject for contact:', contact.id, err);
      }
    }

    leads.push({
      email: contact.email as string,
      first_name: contact.first_name as string,
      last_name: contact.last_name as string,
      company_name: contact.company as string,
      phone: contact.phone as string,
      website: contact.website as string,
      custom_variables: {
        ...((contact.custom_variables as Record<string, string>) || {}),
        ai_subject: subjectLine || '',
        campaign_contact_id: cc.id as string,
      },
    });
  }

  // Add leads to Instantly in batches
  const batchSize = 100;
  let totalAdded = 0;
  let totalFailed = 0;

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const result = await instantly.addLeadsToCampaign(instantlyCampaignId, batch);

    if (result.success && result.data) {
      totalAdded += result.data.added;
      totalFailed += result.data.failed;
    } else {
      totalFailed += batch.length;
    }
  }

  // Update campaign contacts with Instantly status
  for (const cc of campaignContacts) {
    await supabase
      .from('campaign_contacts')
      .update({
        instantly_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', cc.id);
  }

  // Update campaign sync timestamp
  await supabase
    .from('campaigns')
    .update({ instantly_synced_at: new Date().toISOString() })
    .eq('id', campaign.id);

  return { added: totalAdded, failed: totalFailed };
}

async function handleActivate(
  supabase: ReturnType<typeof createClient>,
  instantly: InstantlyClient,
  campaign: Record<string, unknown>
) {
  if (!campaign.instantly_campaign_id) {
    throw new Error('Campaign not yet synced to Instantly');
  }

  const result = await instantly.activateCampaign(campaign.instantly_campaign_id as string);

  if (!result.success) {
    throw new Error(`Failed to activate campaign: ${result.error}`);
  }

  await supabase
    .from('campaigns')
    .update({
      instantly_status: 'active',
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id);

  return { status: 'active' };
}

async function handlePause(
  supabase: ReturnType<typeof createClient>,
  instantly: InstantlyClient,
  campaign: Record<string, unknown>
) {
  if (!campaign.instantly_campaign_id) {
    throw new Error('Campaign not yet synced to Instantly');
  }

  const result = await instantly.pauseCampaign(campaign.instantly_campaign_id as string);

  if (!result.success) {
    throw new Error(`Failed to pause campaign: ${result.error}`);
  }

  await supabase
    .from('campaigns')
    .update({
      instantly_status: 'paused',
      status: 'paused',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id);

  return { status: 'paused' };
}

async function handleResetAndResync(
  supabase: ReturnType<typeof createClient>,
  instantly: InstantlyClient,
  campaign: Record<string, unknown>
) {
  const instantlyCampaignId = campaign.instantly_campaign_id as string | null;

  // Step 1: Delete campaign from Instantly if it exists
  if (instantlyCampaignId) {
    console.log(`Step 1: Deleting Instantly campaign: ${instantlyCampaignId}`);

    const deleteResult = await instantly.deleteCampaign(instantlyCampaignId);

    if (!deleteResult.success) {
      console.error(`Failed to delete campaign from Instantly: ${deleteResult.error}`);
      throw new Error(
        `Cannot reset: Failed to delete campaign from Instantly. ` +
        `Error: ${deleteResult.error}. ` +
        `Please delete campaign "${instantlyCampaignId}" manually in Instantly dashboard, then try again.`
      );
    }

    console.log(`✓ Successfully deleted campaign from Instantly`);
  } else {
    console.log(`Step 1: No Instantly campaign to delete (not synced yet)`);
  }

  // Step 2: Reset database fields
  console.log(`Step 2: Resetting campaign database fields`);

  const { error: updateError } = await supabase
    .from('campaigns')
    .update({
      instantly_campaign_id: null,
      instantly_status: null,
      instantly_synced_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id);

  if (updateError) {
    throw new Error(`Failed to reset campaign in database: ${updateError.message}`);
  }

  console.log(`✓ Campaign fields reset in database`);

  // Step 3: Reset all leads to pending status
  console.log(`Step 3: Resetting all lead statuses to pending`);

  const { error: leadsUpdateError } = await supabase
    .from('campaign_leads')
    .update({
      instantly_lead_id: null,
      instantly_status: 'pending',
      instantly_synced_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('campaign_id', campaign.id);

  if (leadsUpdateError) {
    throw new Error(`Failed to reset leads in database: ${leadsUpdateError.message}`);
  }

  console.log(`✓ All leads reset to pending status`);

  // Step 4: Refetch campaign object with updated NULL values
  console.log(`Step 4: Refetching campaign object from database`);

  const { data: refreshedCampaign, error: fetchError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaign.id)
    .single();

  if (fetchError || !refreshedCampaign) {
    throw new Error(`Failed to refetch campaign: ${fetchError?.message || 'Not found'}`);
  }

  console.log(`✓ Campaign refetched. instantly_campaign_id is now: ${refreshedCampaign.instantly_campaign_id || 'NULL'}`);

  // Step 5: Re-sync with updated sequences (full_sync = true)
  console.log(`Step 5: Starting re-sync with updated sequences...`);

  const resyncResult = await handleCreateOrFullSync(supabase, instantly, refreshedCampaign, true);

  console.log(`✓ Reset and re-sync complete!`);

  return {
    reset_complete: true,
    old_campaign_id: instantlyCampaignId,
    new_campaign_id: resyncResult.instantly_campaign_id,
    ...resyncResult,
  };
}

async function syncCampaignLeadsToInstantly(
  supabase: ReturnType<typeof createClient>,
  instantly: InstantlyClient,
  campaign: Record<string, unknown>,
  instantlyCampaignId: string
) {
  // Get campaign_leads that haven't been synced yet
  // LOGIC: Sync any lead with an email address that's ready to send
  // Includes both:
  // - Emails imported from CSV (email_address set, email_status NULL/pending)
  // - Emails verified via Hunter.io (email_status = 'found')
  // IMPORTANT: Must match the stats function logic for consistency
  const { data: allLeads, error: leadsError } = await supabase
    .from('campaign_leads')
    .select('*')
    .eq('campaign_id', campaign.id)
    .is('instantly_lead_id', null)
    .eq('instantly_status', 'pending')
    .not('email_address', 'is', null);

  if (leadsError) {
    console.error('Failed to fetch campaign leads:', leadsError);
    throw new Error('Failed to fetch campaign leads');
  }

  if (!allLeads || allLeads.length === 0) {
    console.log('No leads with email addresses found for campaign:', campaign.id);
    return {
      added: 0,
      failed: 0,
      message: 'No leads with email addresses to sync.'
    };
  }

  console.log(`DEBUG: Fetched ${allLeads.length} leads from database`);
  if (allLeads.length > 0) {
    console.log(`DEBUG: First lead from DB:`, JSON.stringify({
      id: allLeads[0].id,
      email_address: allLeads[0].email_address,
      email_status: allLeads[0].email_status,
      first_name: allLeads[0].first_name,
      company_name: allLeads[0].company_name
    }, null, 2));
  }

  // Filter out leads with explicitly failed email verification
  const campaignLeads = allLeads.filter((lead: Record<string, unknown>) =>
    lead.email_status !== 'not_found'
  );

  if (campaignLeads.length === 0) {
    console.log('All leads with emails were marked as invalid (not_found)');
    return {
      added: 0,
      failed: 0,
      message: 'All leads have invalid email addresses (verification failed).'
    };
  }

  console.log(`Found ${campaignLeads.length} leads with valid email addresses ready to sync to Instantly`);

  // Prepare leads for Instantly
  const leads = campaignLeads
    .map((lead: Record<string, unknown>) => {
      // Ensure all custom variable values are valid types (string, number, boolean, or null)
      const customVars: Record<string, string | number | boolean | null> = {
        ...((lead.custom_variables as Record<string, string>) || {}),
      };

      // Add email content as custom variables (must be strings or null)
      if (lead.email_body) customVars.email_body = lead.email_body as string;
      if (lead.subject_line) customVars.subject_line = lead.subject_line as string;
      if (lead.opening_line) customVars.opening_line = lead.opening_line as string;
      if (lead.call_to_action) customVars.call_to_action = lead.call_to_action as string;

      const email = typeof lead.email_address === 'string' ? lead.email_address.trim() : '';

      return {
        email,
        first_name: (lead.first_name as string) || '',
        last_name: '', // campaign_leads doesn't store last name separately
        company_name: (lead.company_name as string) || '',
        website: (lead.website as string) || '',
        custom_variables: customVars,
        _leadId: lead.id, // Track for debugging
      };
    })
    .filter((lead) => {
      // CRITICAL: Filter out leads with invalid emails
      if (!lead.email || lead.email.length === 0) {
        console.error(`INVALID LEAD: Missing email for lead ${lead._leadId}`);
        return false;
      }
      // Basic email validation
      if (!lead.email.includes('@')) {
        console.error(`INVALID LEAD: Invalid email format "${lead.email}" for lead ${lead._leadId}`);
        return false;
      }
      return true;
    })
    .map(({ _leadId, ...lead }) => lead); // Remove the debug field

  if (leads.length === 0) {
    console.error('CRITICAL: All leads filtered out due to invalid emails');
    return {
      added: 0,
      failed: campaignLeads.length,
      message: 'All leads have invalid email addresses'
    };
  }

  console.log(`Prepared ${leads.length} valid leads for Instantly (filtered out ${campaignLeads.length - leads.length} invalid)`);

  // Debug: Log first lead to verify structure - DETAILED
  if (leads.length > 0) {
    const firstLead = leads[0];
    console.log('=== CRITICAL DEBUG: FIRST LEAD STRUCTURE ===');
    console.log(`Lead has email field: ${!!firstLead.email}`);
    console.log(`Email value: "${firstLead.email}"`);
    console.log(`Email type: ${typeof firstLead.email}`);
    console.log(`Email length: ${firstLead.email?.length || 0}`);
    console.log(`First name: ${firstLead.first_name}`);
    console.log(`Company: ${firstLead.company_name}`);
    console.log(`Has custom_variables: ${!!firstLead.custom_variables}`);
    if (firstLead.custom_variables) {
      console.log(`Custom vars keys: ${Object.keys(firstLead.custom_variables).join(', ')}`);
      const emailBody = firstLead.custom_variables.email_body;
      const subjectLine = firstLead.custom_variables.subject_line;
      if (typeof emailBody === 'string') {
        console.log(`email_body length: ${emailBody.length} chars`);
      }
      if (typeof subjectLine === 'string') {
        console.log(`subject_line length: ${subjectLine.length} chars`);
      }
    }
    console.log(`All lead keys: ${Object.keys(firstLead).join(', ')}`);
  }

  // Add leads to Instantly in batches
  const batchSize = 100;
  let totalAdded = 0;
  let totalFailed = 0;
  const failedLeadIds: string[] = [];

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const batchLeadIds = campaignLeads.slice(i, i + batchSize).map(l => l.id as string);

    console.log(`Adding batch ${Math.floor(i / batchSize) + 1}: ${batch.length} leads to Instantly campaign ${instantlyCampaignId}`);
    console.log(`Batch emails being sent:`, batch.map(l => l.email).join(', '));

    const result = await instantly.addLeadsToCampaign(instantlyCampaignId, batch);

    console.log(`=== BATCH API RESPONSE ===`);
    console.log(`result.success: ${result.success}`);
    console.log(`result.error: ${result.error || 'none'}`);

    if (result.success && result.data) {
      const added = result.data.added || 0;
      const failed = result.data.failed || 0;

      totalAdded += added;
      totalFailed += failed;

      console.log(`Batch result: ${added} added, ${failed} failed`);

      // If some failed in this batch, we don't know which ones, so mark all as potentially failed
      if (result.data.failed > 0) {
        failedLeadIds.push(...batchLeadIds);
        console.warn(`Some leads rejected by Instantly - may need manual review`);
      }
    } else {
      // Entire batch failed
      totalFailed += batch.length;
      failedLeadIds.push(...batchLeadIds);
      console.error(`Entire batch FAILED with error:`, result.error || 'Unknown error');
      console.error(`Campaign ID attempted:`, instantlyCampaignId);
      console.error(`Number of leads in failed batch:`, batch.length);
    }
  }

  // FIXED: Only mark successfully added leads as synced
  // If ALL leads failed, don't mark any as synced
  if (totalAdded > 0) {
    console.log(`Marking ${totalAdded} successfully synced leads in database...`);

    // Mark leads as synced (excluding known failed ones)
    for (const lead of campaignLeads) {
      // Skip leads that were in failed batches
      if (failedLeadIds.includes(lead.id as string)) {
        console.log(`Skipping failed lead: ${lead.email_address}`);
        continue;
      }

      await supabase
        .from('campaign_leads')
        .update({
          instantly_status: 'synced',
          instantly_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id);
    }

    // Update campaign sync timestamp
    await supabase
      .from('campaigns')
      .update({ instantly_synced_at: new Date().toISOString() })
      .eq('id', campaign.id);

    console.log(`✓ Database updated: ${totalAdded} leads marked as synced`);
  } else {
    console.error(`✗ SYNC FAILED: All ${totalFailed} leads were rejected by Instantly`);
    console.error(`Common causes: 1) Invalid email format, 2) Duplicate emails, 3) Instantly account limits, 4) API key permissions`);
  }

  console.log(`=== SYNC COMPLETE: ${totalAdded} successfully added, ${totalFailed} failed ===`);
  return { added: totalAdded, failed: totalFailed };
}

async function generateSubjectLine(
  apiKey: string,
  contact: { first_name?: string; last_name?: string; company?: string; job_title?: string },
  campaign: { name: string; target_audience?: string },
  template: Record<string, unknown>
): Promise<string> {
  const systemPrompt = `You are an expert email copywriter. Generate a compelling, personalized subject line under 60 characters. Return ONLY the subject line.`;

  const userPrompt = (template.ai_subject_prompt as string) ||
    `Generate a subject line for an email to ${contact.first_name || 'a prospect'} at ${contact.company || 'their company'}. Campaign: ${campaign.name}. Template: ${template.name}.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 100,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate subject line');
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || 'Hello from ' + campaign.name;
}
