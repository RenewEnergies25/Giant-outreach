import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'

interface GHLBookingPayload {
  id: string
  locationId?: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  name?: string
  appointmentId?: string
  calendarName?: string
  'Call Back Time'?: string
  customFields?: {
    'Call Back Time'?: string
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: GHLBookingPayload = await req.json()
    console.log('Booking received:', JSON.stringify(payload))

    const supabase = getSupabaseClient()

    const callBackTime = payload['Call Back Time'] ||
                         payload.customFields?.['Call Back Time'] ||
                         null

    const { data: contactId } = await supabase.rpc('upsert_contact_from_ghl', {
      p_ghl_contact_id: payload.id,
      p_ghl_location_id: payload.locationId,
      p_email: payload.email,
      p_first_name: payload.firstName,
      p_phone: payload.phone,
      p_full_name: payload.name
    })

    await supabase.from('contacts').update({
      conversation_stage: 'booked',
      is_qualified: true,
      qualified_at: new Date().toISOString(),
      call_back_time: callBackTime,
      updated_at: new Date().toISOString()
    }).eq('id', contactId)

    await supabase
      .from('escalations')
      .update({
        status: 'resolved',
        resolved_by: 'system_booking',
        resolved_at: new Date().toISOString()
      })
      .eq('contact_id', contactId)
      .eq('escalation_type', 'calendar_sent')
      .eq('status', 'pending')

    await supabase.from('escalations').insert({
      contact_id: contactId,
      escalation_type: 'booked',
      reason: 'Appointment booked - QUALIFIED LEAD',
      appointment_time: callBackTime,
      calendar_name: payload.calendarName,
      status: 'pending'
    })

    await supabase.rpc('increment_metric', { metric_name: 'bookings' })

    return new Response(
      JSON.stringify({
        success: true,
        qualified: true,
        call_back_time: callBackTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error logging booking:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})