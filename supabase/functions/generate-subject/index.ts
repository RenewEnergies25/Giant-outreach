import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateSubjectRequest {
  campaign_id: string;
  contact_id: string;
  template_id: string;
  sequence_id?: string;
  contact_data: {
    first_name?: string;
    last_name?: string;
    email: string;
    company?: string;
    job_title?: string;
    custom_variables?: Record<string, string>;
  };
  campaign_data: {
    name: string;
    channel_type: string;
    target_audience?: string;
  };
  template_data: {
    name: string;
    category?: string;
    ai_subject_prompt?: string;
    body_preview?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: GenerateSubjectRequest = await req.json();
    const { campaign_id, contact_id, template_id, sequence_id, contact_data, campaign_data, template_data } = body;

    // Build the prompt for subject line generation
    const systemPrompt = `You are an expert email copywriter specializing in creating compelling, personalized subject lines that drive high open rates.

Guidelines:
- Keep subject lines under 60 characters
- Make them personalized when possible
- Create curiosity or urgency without being spammy
- Avoid ALL CAPS or excessive punctuation
- Don't use words that trigger spam filters
- Match the tone to the campaign type and audience
- Return ONLY the subject line, nothing else`;

    let userPrompt = template_data.ai_subject_prompt || '';

    if (!userPrompt) {
      userPrompt = `Generate a compelling email subject line for the following context:

Campaign: ${campaign_data.name}
Campaign Type: ${campaign_data.channel_type}
${campaign_data.target_audience ? `Target Audience: ${campaign_data.target_audience}` : ''}

Recipient:
- Name: ${contact_data.first_name || 'Unknown'} ${contact_data.last_name || ''}
- Company: ${contact_data.company || 'Unknown'}
${contact_data.job_title ? `- Job Title: ${contact_data.job_title}` : ''}

Email Template: ${template_data.name}
${template_data.category ? `Category: ${template_data.category}` : ''}
${template_data.body_preview ? `Email Preview: ${template_data.body_preview.substring(0, 200)}...` : ''}

Generate a single, personalized subject line.`;
    } else {
      // Replace variables in custom prompt
      userPrompt = userPrompt
        .replace(/\{\{first_name\}\}/g, contact_data.first_name || '')
        .replace(/\{\{last_name\}\}/g, contact_data.last_name || '')
        .replace(/\{\{company\}\}/g, contact_data.company || '')
        .replace(/\{\{job_title\}\}/g, contact_data.job_title || '')
        .replace(/\{\{campaign_name\}\}/g, campaign_data.name);

      // Replace custom variables
      if (contact_data.custom_variables) {
        for (const [key, value] of Object.entries(contact_data.custom_variables)) {
          userPrompt = userPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }
      }
    }

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
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

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const openaiData = await openaiResponse.json();
    const generatedSubject = openaiData.choices[0]?.message?.content?.trim();

    if (!generatedSubject) {
      throw new Error('No subject line generated');
    }

    // Store the generated subject in the database
    const { data: savedSubject, error: saveError } = await supabase
      .from('generated_subjects')
      .insert({
        campaign_id,
        contact_id,
        template_id,
        sequence_id,
        subject_line: generatedSubject,
        prompt_used: userPrompt,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving generated subject:', saveError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        subject_line: generatedSubject,
        saved_id: savedSubject?.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating subject:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
