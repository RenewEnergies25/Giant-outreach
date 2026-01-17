import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'

interface GHLOptoutPayload {
  id: string
  locationId?: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  name?: string
  optout_message?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: GHLOptoutPayload = await req.json()
    console.log('Opt-out received:', JSON.stringify(payload))

    const supabase = getSupabaseClient()

    const { data: contactId } = await supabase.rpc('upsert_contact_from_ghl', {
      p_ghl_contact_id: payload.id,
      p_ghl_location_id: payload.locationId,
      p_email: payload.email,
      p_first_name: payload.firstName,
      p_phone: payload.phone,
      p_full_name: payload.name
    })

    if (payload.optout_message) {
      await supabase.from('messages').insert({
        contact_id: contactId,
        ghl_contact_id: payload.id,
        direction: 'inbound',
        channel: 'sms',
        content: payload.optout_message,
        message_type: 'opt_out'
      })
    }

    await supabase.from('contacts').update({
      conversation_stage: 'opted_out',
      is_opted_out: true,
      opted_out_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', contactId)

    await supabase
      .from('escalations')
      .update({
        status: 'dismissed',
        resolved_by: 'system_optout',
        resolved_at: new Date().toISOString()
      })
      .eq('contact_id', contactId)
      .eq('status', 'pending')

    await supabase.rpc('increment_metric', { metric_name: 'opt_outs' })

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error logging opt-out:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})