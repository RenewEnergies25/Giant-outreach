import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'

interface UpdateEscalationPayload {
  escalation_id: string
  status: 'pending' | 'resolved' | 'dismissed'
  resolved_by?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: UpdateEscalationPayload = await req.json()
    const supabase = getSupabaseClient()

    const updateData: any = { status: payload.status }

    if (payload.status !== 'pending') {
      updateData.resolved_by = payload.resolved_by || 'dashboard_user'
      updateData.resolved_at = new Date().toISOString()
    }

    const { data: escalation } = await supabase
      .from('escalations')
      .update(updateData)
      .eq('id', payload.escalation_id)
      .select('contact_id')
      .single()

    if (payload.status !== 'pending' && escalation?.contact_id) {
      await supabase.from('contacts').update({
        needs_human_review: false,
        updated_at: new Date().toISOString()
      }).eq('id', escalation.contact_id)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error updating escalation:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})