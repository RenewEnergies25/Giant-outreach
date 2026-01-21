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
  // Try to get email sequences for this campaign (template-based workflow)
  const { data: sequences, error: seqError } = await supabase
    .from('campaign_email_sequences')
    .select(`
      *,
      template:email_templates(*)
    `)
    .eq('campaign_id', campaign.id)
    .eq('is_active', true)
    .order('sequence_order', { ascending: true });

  // If sequences query failed or returned no results, try campaign_leads workflow
  let instantlySteps;
  let usesLeadsWorkflow = false;

  if (seqError || !sequences || sequences.length === 0) {
    // Check if this campaign uses the campaign_leads workflow (per-lead custom emails)
    const { data: leads, error: leadsError } = await supabase
      .from('campaign_leads')
      .select('id')
      .eq('campaign_id', campaign.id)
      .limit(1);

    if (leadsError) {
      throw new Error('Failed to check campaign leads');
    }

    if (!leads || leads.length === 0) {
      // Both queries failed or returned no results
      const errorDetails = seqError ? ` Sequences error: ${seqError.message}.` : '';
      throw new Error(`No email sequences or leads configured for this campaign. Add email templates or leads first.${errorDetails}`);
    }

    // Use campaign_leads workflow - create a simple sequence with variable placeholders
    usesLeadsWorkflow = true;
    instantlySteps = [
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
  } else {
    // Use campaign_email_sequences workflow - build steps from templates
    instantlySteps = sequences.map((seq: Record<string, unknown>) => {
      const template = seq.template as Record<string, unknown>;
      // Calculate delay in days (Instantly API expects days, not minutes)
      const delayDays = (seq.delay_days as number) || 0;
      const delayHours = (seq.delay_hours as number) || 0;
      const totalDelayDays = delayDays + Math.round(delayHours / 24);

      return {
        type: 'email' as const,
        delay: totalDelayDays, // Delay in days, not minutes
        variants: [
          {
            subject: seq.subject_override || template.subject_line || '{{ai_subject}}',
            body: template.body_html as string,
          }
        ],
      };
    });
  }

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

async function syncCampaignLeadsToInstantly(
  supabase: ReturnType<typeof createClient>,
  instantly: InstantlyClient,
  campaign: Record<string, unknown>,
  instantlyCampaignId: string
) {
  // Get campaign_leads that haven't been synced yet
  // IMPORTANT: Only sync leads with VERIFIED emails (email_status = 'found')
  // These are deliverable emails found via Hunter.io - unverified emails won't work
  const { data: campaignLeads, error: leadsError } = await supabase
    .from('campaign_leads')
    .select('*')
    .eq('campaign_id', campaign.id)
    .is('instantly_lead_id', null)
    .eq('email_status', 'found'); // Only sync verified, deliverable emails

  if (leadsError) {
    console.error('Failed to fetch campaign leads:', leadsError);
    throw new Error('Failed to fetch campaign leads');
  }

  if (!campaignLeads || campaignLeads.length === 0) {
    console.log('No leads with verified emails found for campaign:', campaign.id);
    return {
      added: 0,
      failed: 0,
      message: 'No leads with verified emails to sync. Run "Find Emails" first to verify email addresses.'
    };
  }

  console.log(`Found ${campaignLeads.length} leads with verified emails ready to sync to Instantly`);

  // Prepare leads for Instantly
  const leads = campaignLeads.map((lead: Record<string, unknown>) => {
    // Ensure all custom variable values are valid types (string, number, boolean, or null)
    const customVars: Record<string, string | number | boolean | null> = {
      ...((lead.custom_variables as Record<string, string>) || {}),
    };

    // Add email content as custom variables (must be strings or null)
    if (lead.email_body) customVars.email_body = lead.email_body as string;
    if (lead.subject_line) customVars.subject_line = lead.subject_line as string;
    if (lead.opening_line) customVars.opening_line = lead.opening_line as string;
    if (lead.call_to_action) customVars.call_to_action = lead.call_to_action as string;

    return {
      email: lead.email_address as string,
      first_name: (lead.first_name as string) || '',
      last_name: '', // campaign_leads doesn't store last name separately
      company_name: (lead.company_name as string) || '',
      website: (lead.website as string) || '',
      custom_variables: customVars,
    };
  });

  // Add leads to Instantly in batches
  const batchSize = 100;
  let totalAdded = 0;
  let totalFailed = 0;
  const failedLeadIds: string[] = [];

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const batchLeadIds = campaignLeads.slice(i, i + batchSize).map(l => l.id as string);

    console.log(`Adding batch ${Math.floor(i / batchSize) + 1}: ${batch.length} leads to Instantly campaign ${instantlyCampaignId}`);

    const result = await instantly.addLeadsToCampaign(instantlyCampaignId, batch);

    if (result.success && result.data) {
      totalAdded += result.data.added;
      totalFailed += result.data.failed;
      console.log(`Batch result: ${result.data.added} added, ${result.data.failed} failed`);

      // If some failed in this batch, we don't know which ones, so mark all as potentially failed
      if (result.data.failed > 0) {
        failedLeadIds.push(...batchLeadIds);
        console.warn(`Some leads rejected by Instantly - may need manual review`);
      }
    } else {
      // Entire batch failed
      totalFailed += batch.length;
      failedLeadIds.push(...batchLeadIds);
      console.error(`Entire batch FAILED:`, result.error || 'Unknown error');
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
