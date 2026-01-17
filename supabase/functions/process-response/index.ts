import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'
import { updateGHLContact } from '../_shared/ghl.ts'
import { conversationCompletion } from '../_shared/openai.ts'
import {
  buildSystemPrompt,
  formatDateTimeUK,
  containsCalendarLink,
  getPromptConfig,
  isGoodbyeResponse,
  isReachBackOutResponse
} from '../_shared/prompt-builder.ts'
import {
  detectMessageIntent,
  checkForHumanReview,
  getLastAssistantMessage
} from '../_shared/conversation-tracker.ts'

interface GHLStandardData {
  id?: string
  contact_id?: string
  contactId?: string
  locationId?: string
  location_id?: string
  email?: string
  phone?: string
  firstName?: string
  first_name?: string
  lastName?: string
  last_name?: string
  name?: string
  full_name?: string
  fullName?: string
  customFields?: Record<string, any>
  'Lead Response'?: string
  'lead_response'?: string
  leadResponse?: string
  'First Message Sent'?: string
  'first_message_sent'?: string
  firstMessageSent?: string
  'Memory'?: string
  memory?: string
  'AI Memory'?: string
  'Chat GPT'?: string
  'Chat-GPT'?: string
  'Call Back Time'?: string
  tags?: string | string[]

  [key: string]: any
}

function extractField(payload: any, ...fieldNames: string[]): string | undefined {
  for (const name of fieldNames) {
    if (payload[name]) return payload[name]
    if (payload.customFields?.[name]) return payload.customFields[name]
  }
  return undefined
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: GHLStandardData = await req.json()
    console.log('Received GHL webhook:', JSON.stringify(payload, null, 2))

    const contactGhlId = extractField(payload, 'id', 'contact_id', 'contactId') ||
                         payload.id || payload.contact_id || payload.contactId

    const leadResponse = extractField(payload, 'Lead Response', 'lead_response', 'leadResponse') || ''
    const firstMessageSent = extractField(payload, 'First Message Sent', 'first_message_sent', 'firstMessageSent') || ''
    const bumpMessage = extractField(payload, 'Memory', 'memory', 'AI Memory') || null

    const locationId = extractField(payload, 'locationId', 'location_id') || payload.location?.id
    const email = payload.email
    const phone = payload.phone
    const firstName = payload.firstName || payload.first_name
    const lastName = payload.lastName || payload.last_name
    const fullName = payload.name || payload.full_name || payload.fullName

    console.log('Extracted fields:', { contactGhlId, leadResponse, firstMessageSent, bumpMessage })

    if (!contactGhlId || !leadResponse) {
      console.error('Missing required fields:', { id: contactGhlId, leadResponse })
      throw new Error('Missing required fields: contact id or lead response')
    }

    const supabase = getSupabaseClient()
    const config = getPromptConfig()

    const { data: contactId, error: contactError } = await supabase.rpc('upsert_contact_from_ghl', {
      p_ghl_contact_id: contactGhlId,
      p_ghl_location_id: locationId,
      p_email: email,
      p_first_name: firstName,
      p_last_name: lastName,
      p_phone: phone,
      p_full_name: fullName
    })

    if (contactError) {
      console.error('Contact upsert error:', contactError)
      throw contactError
    }

    const { data: contactData } = await supabase
      .from('contacts')
      .select('questions_asked, message_count, bump_count, conversation_stage')
      .eq('id', contactId)
      .single()

    const questionsAsked = contactData?.questions_asked || 0
    const messageCount = contactData?.message_count || 0

    const { data: history } = await supabase.rpc('get_conversation_history', {
      p_ghl_contact_id: contactGhlId,
      p_limit: 20
    })

    const conversationHistory = (history || []).map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))

    const lastAssistantMessage = getLastAssistantMessage(conversationHistory)
    const messageIntent = await detectMessageIntent(leadResponse, lastAssistantMessage)
    console.log('Detected intent:', messageIntent)

    await supabase.from('messages').insert({
      contact_id: contactId,
      ghl_contact_id: contactGhlId,
      direction: 'inbound',
      channel: 'sms',
      content: leadResponse,
      message_type: 'conversation',
      detected_intent: messageIntent
    })

    const currentDateTime = formatDateTimeUK()
    const systemPrompt = buildSystemPrompt(config, currentDateTime, firstMessageSent, bumpMessage)

    const aiReply = await conversationCompletion(
      systemPrompt,
      conversationHistory,
      leadResponse
    )
    console.log('AI Reply:', aiReply)

    const hasCalendarLink = containsCalendarLink(aiReply, config.calendarLink)
    const isGoodbye = isGoodbyeResponse(aiReply)
    const isReachBackOut = isReachBackOutResponse(aiReply)

    const newQuestionsAsked = messageIntent === 'question'
      ? questionsAsked + 1
      : questionsAsked
    const newMessageCount = messageCount + 2

    const escalationCheck = checkForHumanReview(
      messageIntent,
      newQuestionsAsked,
      newMessageCount
    )

    let newStage = 'in_conversation'
    if (hasCalendarLink) {
      newStage = 'calendar_link_sent'
    } else if (isGoodbye) {
      newStage = 'stalled'
    } else if (isReachBackOut) {
      newStage = 'stalled'
    }

    let messageType = 'conversation'
    if (hasCalendarLink) messageType = 'calendar_sent'
    if (isGoodbye) messageType = 'opt_out'

    const { data: outboundMsg } = await supabase.from('messages').insert({
      contact_id: contactId,
      ghl_contact_id: contactGhlId,
      direction: 'outbound',
      channel: 'sms',
      content: aiReply,
      message_type: messageType,
      ai_generated: true
    }).select().single()

    const contactUpdate: any = {
      conversation_stage: newStage,
      questions_asked: newQuestionsAsked,
      message_count: newMessageCount,
      last_message_at: new Date().toISOString(),
      needs_human_review: escalationCheck.shouldEscalate,
      updated_at: new Date().toISOString()
    }

    if (hasCalendarLink) {
      contactUpdate.calendar_link_sent = true
      contactUpdate.calendar_link_sent_at = new Date().toISOString()
    }

    await supabase.from('contacts').update(contactUpdate).eq('id', contactId)

    if (escalationCheck.shouldEscalate) {
      await supabase.from('escalations').insert({
        contact_id: contactId,
        message_id: outboundMsg?.id,
        escalation_type: escalationCheck.escalationType,
        reason: escalationCheck.reason,
        status: 'pending'
      })
      await supabase.rpc('increment_metric', { metric_name: 'human_reviews' })
    }

    await supabase.rpc('increment_metric', { metric_name: 'messages_received' })
    if (hasCalendarLink) {
      await supabase.rpc('increment_metric', { metric_name: 'calendar_links_sent' })
    }

    // Update GHL contact with AI reply
    // Using 'chatgpt' (lowercase) to match the GHL field key
    console.log('Updating GHL chatgpt field with AI reply...')
    try {
      const ghlResult = await updateGHLContact(contactGhlId, {
        'chatgpt': aiReply
      })
      console.log('GHL field updated successfully:', JSON.stringify(ghlResult))
    } catch (ghlError) {
      console.error('Failed to update GHL contact:', ghlError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        reply: aiReply,
        intent: messageIntent,
        calendar_link_sent: hasCalendarLink,
        is_goodbye: isGoodbye,
        is_reach_back_out: isReachBackOut,
        needs_review: escalationCheck.shouldEscalate,
        new_stage: newStage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing response:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})