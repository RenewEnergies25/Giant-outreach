const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

async function callFunction(name: string, body: object) {
  const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'API call failed' }))
    throw new Error(error.message || 'API call failed')
  }

  return response.json()
}

export async function sendManualReply(
  contactId: string,
  ghlContactId: string,
  message: string
) {
  return callFunction('manual-reply', {
    contact_id: contactId,
    ghl_contact_id: ghlContactId,
    message
  })
}

export async function updateEscalation(
  escalationId: string,
  status: 'resolved' | 'dismissed'
) {
  return callFunction('update-escalation', {
    escalation_id: escalationId,
    status
  })
}

export async function logBump(
  contactId: string,
  bumpNumber?: number,
  bumpMessage?: string
) {
  return callFunction('log-bump', {
    id: contactId,
    bump_number: bumpNumber,
    bump_message: bumpMessage
  })
}

export async function logCalendarSent(contactId: string) {
  return callFunction('log-calendar-sent', {
    id: contactId
  })
}

export async function logBooking(
  contactId: string,
  callBackTime?: string,
  calendarName?: string
) {
  return callFunction('log-booking', {
    id: contactId,
    'Call Back Time': callBackTime,
    calendarName
  })
}

export async function logOptout(
  contactId: string,
  optoutMessage?: string
) {
  return callFunction('log-optout', {
    id: contactId,
    optout_message: optoutMessage
  })
}
