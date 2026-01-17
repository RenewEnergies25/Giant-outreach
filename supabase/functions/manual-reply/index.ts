import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'
import { updateGHLContact } from '../_shared/ghl.ts'

interface ManualReplyPayload {
  contact_id: string
  ghl_contact_id: string
  message: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: ManualReplyPayload = await req.json()
    console.log('Manual reply:', JSON.stringify(payload))

    const supabase = getSupabaseClient()

    const { data: contactData } = await supabase
      .from('contacts')
      .select('message_count')
      .eq('id', payload.contact_id)
      .single()

    await supabase.from('messages').insert({
      contact_id: payload.contact_id,
      ghl_contact_id: payload.ghl_contact_id,
      direction: 'outbound',
      channel: 'sms',
      content: payload.message,
      message_type: 'manual',
      ai_generated: false
    })

    await supabase.from('contacts').update({
      message_count: (contactData?.message_count || 0) + 1,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', payload.contact_id)

    await updateGHLContact(payload.ghl_contact_id, {
      'Chat GPT': payload.message
    })

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending manual reply:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})