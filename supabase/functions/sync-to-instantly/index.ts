import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { InstantlyClient, createInstantlyClientWithKey } from '../_shared/instantly.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  campaign_id: string;
  action: 'create' | 'sync_leads' | 'activate' | 'pause' | 'full_sync';
  lead_ids?: string[]; // Optional: only sync these specific leads (for filtered syncing)
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
    const { campaign_id, action, lead_ids } = body;

    // Get Instantly API key from config
    const { data: config, error: configError } = await supabase
      .from('instantly_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('Instantly API not configured. Please add your API key in Settings.');
    }

    const instantly = createInstantlyClientWithKey(config.api_key);

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
        result = await handleCreateOrFullSync(supabase, instantly, campaign, action === 'full_sync', lead_ids);
        break;
      case 'sync_leads':
        result = await handleSyncLeads(supabase, instantly, campaign, lead_ids);
        break;
      case 'activate':
        result = await handleActivate(supabase, instantly, campaign);
        break;
      case 'pause':
        result = await handlePause(supabase, instantly, campaign);
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
  syncLeads: boolean,
  leadIds?: string[]
) {
  // Get email sequences for this campaign
  const { data: sequences, error: seqError } = await supabase
    .from('campaign_email_sequences')
    .select(`
      *,
      template:email_templates(*)
    `)
    .eq('campaign_id', campaign.id)
    .eq('is_active', true)
    .order('sequence_order', { ascending: true });

  if (seqError) {
    throw new Error('Failed to fetch email sequences');
  }

  if (!sequences || sequences.length === 0) {
    throw new Error('No email sequences configured for this campaign. Add email templates first.');
  }

  // Build Instantly sequence steps
  const instantlySteps = sequences.map((seq: Record<string, unknown>) => {
    const template = seq.template as Record<string, unknown>;
    return {
      type: 'email' as const,
      subject: seq.subject_override || template.subject_line || '{{ai_subject}}',
      body: template.body_html as string,
      delay: (seq.delay_days as number) * 24 * 60 + (seq.delay_hours as number || 0) * 60,
    };
  });

  let instantlyCampaignId = campaign.instantly_campaign_id as string | null;

  // Create campaign in Instantly if not exists
  if (!instantlyCampaignId) {
    const createResult = await instantly.createCampaign({
      name: campaign.name as string,
      sequences: [{ steps: instantlySteps }],
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

  let leadsResult = { added: 0, failed: 0, skipped: 0 };

  if (syncLeads) {
    leadsResult = await syncCampaignLeadsToInstantly(supabase, instantly, campaign, instantlyCampaignId, leadIds);
  }

  return {
    instantly_campaign_id: instantlyCampaignId,
    sequences_synced: sequences.length,
    leads_added: leadsResult.added,
    leads_failed: leadsResult.failed,
    leads_skipped: leadsResult.skipped,
  };
}

async function handleSyncLeads(
  supabase: ReturnType<typeof createClient>,
  instantly: InstantlyClient,
  campaign: Record<string, unknown>,
  leadIds?: string[]
) {
  if (!campaign.instantly_campaign_id) {
    throw new Error('Campaign not yet synced to Instantly. Run full sync first.');
  }

  const result = await syncCampaignLeadsToInstantly(
    supabase,
    instantly,
    campaign,
    campaign.instantly_campaign_id as string,
    leadIds
  );

  return result;
}

async function syncLeadsToInstantly(
  supabase: ReturnType<typeof createClient>,
  instantly: InstantlyClient,
  campaign: Record<string, unknown>,
  instantlyCampaignId: string
) {
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

  return { added: totalAdded, failed: totalFailed, skipped: 0 };
}

/**
 * Sync campaign leads (from CSV upload) to Instantly.
 * This function works with the campaign_leads table which contains:
 * - email_body: The personalized email content from CSV
 * - email_address: The email found via Hunter.io
 * - subject_line: AI-generated subject line
 *
 * @param leadIds - Optional array of lead IDs to sync. If provided, only these leads are synced.
 *                  This is used for filtered syncing (only valid leads).
 */
async function syncCampaignLeadsToInstantly(
  supabase: ReturnType<typeof createClient>,
  instantly: InstantlyClient,
  campaign: Record<string, unknown>,
  instantlyCampaignId: string,
  leadIds?: string[]
) {
  // Build query for campaign leads
  let query = supabase
    .from('campaign_leads')
    .select('*')
    .eq('campaign_id', campaign.id)
    .is('instantly_lead_id', null); // Only get leads not yet synced

  // Filter by specific lead IDs if provided
  if (leadIds && leadIds.length > 0) {
    query = query.in('id', leadIds);
  }

  const { data: campaignLeads, error: leadsError } = await query;

  if (leadsError) {
    throw new Error('Failed to fetch campaign leads: ' + leadsError.message);
  }

  if (!campaignLeads || campaignLeads.length === 0) {
    return { added: 0, failed: 0, skipped: 0, message: 'No leads to sync' };
  }

  // Prepare leads for Instantly, filtering out invalid ones
  const leads = [];
  let skippedCount = 0;

  for (const lead of campaignLeads) {
    // Server-side validation: Skip leads without valid email or body
    if (!lead.email_address || lead.email_status !== 'found') {
      console.log(`Skipping lead ${lead.id}: No valid email address`);
      skippedCount++;
      continue;
    }

    if (!lead.email_body || lead.email_body.length < 50) {
      console.log(`Skipping lead ${lead.id}: Invalid email body`);
      skippedCount++;
      continue;
    }

    if (!lead.subject_line) {
      console.log(`Skipping lead ${lead.id}: No subject line`);
      skippedCount++;
      continue;
    }

    // Check for placeholder patterns in email body
    const placeholderPatterns = [
      /\{\{[^}]+\}\}/i,
      /\[\s*INSERT[^\]]*\]/i,
      /PLACEHOLDER/i,
      /lorem\s+ipsum/i,
    ];

    const hasPlaceholder = placeholderPatterns.some(pattern => pattern.test(lead.email_body));
    if (hasPlaceholder) {
      console.log(`Skipping lead ${lead.id}: Email body contains placeholder text`);
      skippedCount++;
      continue;
    }

    leads.push({
      email: lead.email_address,
      first_name: lead.first_name || '',
      company_name: lead.company_name || '',
      website: lead.website || '',
      custom_variables: {
        ...(lead.custom_variables || {}),
        email_body: lead.email_body,
        subject_line: lead.subject_line,
        opening_line: lead.opening_line || '',
        second_line: lead.second_line || '',
        call_to_action: lead.call_to_action || '',
        campaign_lead_id: lead.id,
      },
    });
  }

  if (leads.length === 0) {
    return { added: 0, failed: 0, skipped: skippedCount, message: 'All leads were filtered out' };
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
      console.error('Instantly batch add failed:', result.error);
      totalFailed += batch.length;
    }
  }

  // Update successfully synced leads in database
  const syncedLeadIds = leads.map(l => l.custom_variables.campaign_lead_id);

  for (const leadId of syncedLeadIds) {
    await supabase
      .from('campaign_leads')
      .update({
        instantly_status: 'synced',
        instantly_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);
  }

  // Update campaign sync timestamp
  await supabase
    .from('campaigns')
    .update({ instantly_synced_at: new Date().toISOString() })
    .eq('id', campaign.id);

  return { added: totalAdded, failed: totalFailed, skipped: skippedCount };
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
