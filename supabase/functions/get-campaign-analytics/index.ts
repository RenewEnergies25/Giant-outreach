import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyticsRequest {
  campaign_id: string;
  start_date?: string;
  end_date?: string;
}

interface InstantlyAnalytics {
  sent: number;
  delivered: number;
  opened: number;
  opened_unique: number;
  clicked: number;
  clicked_unique: number;
  replied: number;
  replied_unique: number;
  bounced: number;
  opportunities: number;
  opportunities_unique: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: AnalyticsRequest = await req.json();
    const { campaign_id, start_date, end_date } = body;

    // Get Instantly API key
    const { data: config, error: configError } = await supabase
      .from('instantly_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('Instantly API not configured');
    }

    // Get campaign with Instantly ID
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign || !campaign.instantly_campaign_id) {
      throw new Error('Campaign not found or not synced to Instantly');
    }

    const instantlyCampaignId = campaign.instantly_campaign_id as string;

    // Build query params
    const params = new URLSearchParams({
      campaign_id: instantlyCampaignId,
    });

    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);

    // Fetch analytics from Instantly API
    const analyticsUrl = `https://api.instantly.ai/api/v2/analytics/campaigns?${params}`;

    console.log(`Fetching analytics from: ${analyticsUrl}`);

    const response = await fetch(analyticsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.api_key}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Instantly API error:', errorData);
      throw new Error(`Instantly API error: ${errorData.message || response.statusText}`);
    }

    const analyticsData = await response.json();

    console.log('Analytics data received:', JSON.stringify(analyticsData, null, 2));

    // Parse and structure the response
    const analytics: InstantlyAnalytics = {
      sent: analyticsData.emails_sent_count || 0,
      delivered: (analyticsData.emails_sent_count || 0) - (analyticsData.bounced_count || 0),
      opened: analyticsData.open_count || 0,
      opened_unique: analyticsData.open_count_unique || 0,
      clicked: analyticsData.link_click_count || 0,
      clicked_unique: analyticsData.link_click_count_unique || 0,
      replied: analyticsData.reply_count || 0,
      replied_unique: analyticsData.reply_count_unique || 0,
      bounced: analyticsData.bounced_count || 0,
      opportunities: analyticsData.opportunity_count || 0,
      opportunities_unique: analyticsData.opportunity_count_unique || 0,
    };

    return new Response(
      JSON.stringify({
        success: true,
        analytics,
        raw: analyticsData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fetching analytics:', error);
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
