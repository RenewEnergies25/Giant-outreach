import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReviewRequest {
  campaign_id: string;
}

interface ReviewResult {
  lead_id: string;
  status: 'valid' | 'invalid';
  reason: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ReviewRequest = await req.json();
    const { campaign_id } = body;

    if (!campaign_id) {
      throw new Error('campaign_id is required');
    }

    const { data: unreviewedLeads, error: fetchError } = await supabase
      .from('campaign_leads')
      .select('id, email_body, first_name, company_name')
      .eq('campaign_id', campaign_id)
      .eq('is_reviewed', false)
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch leads: ${fetchError.message}`);
    }

    if (!unreviewedLeads || unreviewedLeads.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No unreviewed leads found',
          results: [],
          stats: {
            total_reviewed: 0,
            valid_count: 0,
            invalid_count: 0,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const systemPrompt = `You are an email content validator. Your task is to determine if an email body contains legitimate outreach content or if it contains invalid content.

INVALID content includes:
- AI refusal messages (e.g., "I appreciate your request, but I need to clarify...", "I can't help with that")
- Meta-commentary about writing emails instead of actual email content
- System error messages or placeholder text
- Incomplete or truncated emails that don't make sense
- Non-English gibberish or random characters
- AI disclaimers or explanations about not being able to generate content

VALID content includes:
- Actual personalized outreach emails
- Sales or marketing emails with clear messaging
- Follow-up or networking emails
- Any legitimate business communication

Respond ONLY with a JSON object in this exact format:
{"status": "valid", "reason": "Brief explanation"}
or
{"status": "invalid", "reason": "Brief explanation why it's invalid"}

Be strict - when in doubt, mark as invalid to protect the user from sending bad emails.`;

    const results: ReviewResult[] = [];
    const BATCH_SIZE = 25;
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < unreviewedLeads.length; i += BATCH_SIZE) {
      const batch = unreviewedLeads.slice(i, i + BATCH_SIZE);

      for (const lead of batch) {
        try {
          const userPrompt = `Analyze this email body and determine if it's valid outreach content or invalid:

Email Body:
"""
${lead.email_body}
"""

Context: This is supposedly an outreach email for ${lead.first_name || 'a contact'}${lead.company_name ? ` at ${lead.company_name}` : ''}.`;

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
              max_tokens: 150,
              temperature: 0,
              response_format: { type: "json_object" },
            }),
          });

          if (!openaiResponse.ok) {
            console.error(`OpenAI API error for lead ${lead.id}:`, await openaiResponse.text());
            continue;
          }

          const openaiData = await openaiResponse.json();
          const aiResponse = JSON.parse(openaiData.choices[0]?.message?.content || '{"status": "valid", "reason": "Unable to analyze"}');

          const status = aiResponse.status === 'invalid' ? 'invalid' : 'valid';
          const reason = aiResponse.reason || 'Analyzed by AI';

          const { error: updateError } = await supabase
            .from('campaign_leads')
            .update({
              is_reviewed: true,
              review_status: status,
              review_reason: reason,
              reviewed_at: new Date().toISOString(),
            })
            .eq('id', lead.id);

          if (updateError) {
            console.error(`Failed to update lead ${lead.id}:`, updateError);
            continue;
          }

          results.push({
            lead_id: lead.id,
            status,
            reason,
          });

          if (status === 'valid') {
            validCount++;
          } else {
            invalidCount++;
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error processing lead ${lead.id}:`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reviewed ${results.length} leads`,
        results,
        stats: {
          total_reviewed: results.length,
          valid_count: validCount,
          invalid_count: invalidCount,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in review-email-bodies:', error);
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
