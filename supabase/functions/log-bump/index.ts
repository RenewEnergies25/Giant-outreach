import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'

interface GHLBumpPayload {
  id: string
  locationId?: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  name?: string
  bump_number?: number
  bump_message?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: GHLBumpPayload = await req.json()
    console.log('Logging bump:', JSON.stringify(payload))

    const supabase = getSupabaseClient()

    const { data: contactId } = await supabase.rpc('upsert_contact_from_ghl', {
      p_ghl_contact_id: payload.id,
      p_ghl_location_id: payload.locationId,
      p_email: payload.email,
      p_first_name: payload.firstName,
      p_phone: payload.phone,
      p_full_name: payload.name
    })

    const { data: contactData } = await supabase
      .from('contacts')
      .select('bump_count')
      .eq('id', contactId)
      .single()

    const newBumpCount = (contactData?.bump_count || 0) + 1

    await supabase.from('messages').insert({
      contact_id: contactId,
      ghl_contact_id: payload.id,
      direction: 'outbound',
      channel: 'sms',
      content: payload.bump_message || `[Bump ${newBumpCount} sent]`,
      message_type: 'bump',
      ai_generated: false,
      bump_number: payload.bump_number || newBumpCount
    })

    await supabase.from('contacts').update({
      bump_count: newBumpCount,
      last_bump_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', contactId)

    await supabase.rpc('increment_metric', { metric_name: 'bumps_sent' })
    await supabase.rpc('increment_metric', { metric_name: 'messages_sent' })

    return new Response(
      JSON.stringify({ success: true, bump_count: newBumpCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error logging bump:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})