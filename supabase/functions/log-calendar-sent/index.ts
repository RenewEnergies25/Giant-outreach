import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'

interface GHLCalendarSentPayload {
  id: string
  locationId?: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  name?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: GHLCalendarSentPayload = await req.json()
    console.log('Calendar link sent:', JSON.stringify(payload))

    const supabase = getSupabaseClient()

    const { data: contactId } = await supabase.rpc('upsert_contact_from_ghl', {
      p_ghl_contact_id: payload.id,
      p_ghl_location_id: payload.locationId,
      p_email: payload.email,
      p_first_name: payload.firstName,
      p_phone: payload.phone,
      p_full_name: payload.name
    })

    await supabase.from('contacts').update({
      conversation_stage: 'calendar_link_sent',
      calendar_link_sent: true,
      calendar_link_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', contactId)

    await supabase.from('escalations').insert({
      contact_id: contactId,
      escalation_type: 'calendar_sent',
      reason: 'Calendar link sent - awaiting booking',
      status: 'pending'
    })

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error logging calendar sent:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})