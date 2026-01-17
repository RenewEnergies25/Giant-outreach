const GHL_API_BASE = 'https://services.leadconnectorhq.com'

interface GHLCustomField {
  id?: string
  key?: string
  field_key?: string
  value: string
}

export async function getGHLContact(contactId: string): Promise<any> {
  console.log('Getting GHL contact:', contactId)

  const response = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('GHL_API_KEY')}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    }
  })

  const responseText = await response.text()
  console.log('GHL Get Contact Response:', {
    status: response.status,
    body: responseText.substring(0, 500)
  })

  if (!response.ok) {
    throw new Error(`GHL Get Contact failed: ${response.status}`)
  }

  return JSON.parse(responseText)
}

export async function updateGHLContact(
  contactId: string,
  customFields: Record<string, string>,
  locationId?: string
): Promise<any> {
  let fieldIdMap: Record<string, string> = {}

  try {
    const contactData = await getGHLContact(contactId)
    const existingFields = contactData?.contact?.customFields || []

    // Log full structure for debugging
    console.log('Contact keys:', Object.keys(contactData?.contact || {}))
    console.log('Custom fields count:', existingFields.length)
    if (existingFields.length > 0) {
      console.log('First custom field structure:', JSON.stringify(existingFields[0]))
    }

    for (const field of existingFields) {
      const fieldId = field.id
      const fieldKey = (field.key || '').toLowerCase()
      const fieldName = (field.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')

      // Check for chatgpt field with multiple variations
      if (fieldKey === 'chatgpt' || fieldKey.includes('chatgpt') ||
          fieldKey === 'contact.chatgpt' ||
          fieldName === 'chatgpt' || fieldName.includes('chatgpt')) {
        fieldIdMap['chatgpt'] = fieldId
        console.log('Found chatgpt field:', { id: fieldId, key: field.key, name: field.name })
      }
    }

    console.log('Field ID map:', JSON.stringify(fieldIdMap))
  } catch (e) {
    console.log('Could not get contact details for field mapping:', e)
  }

  const fieldArray: any[] = Object.entries(customFields).map(([key, value]) => {
    const fieldId = fieldIdMap[key]
    if (fieldId) {
      console.log(`Using field ID ${fieldId} for key ${key}`)
      return { id: fieldId, value }
    }
    console.log(`No field ID found for ${key}, using key`)
    return { key, value }
  })

  const response = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('GHL_API_KEY')}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    },
    body: JSON.stringify({ customFields: fieldArray })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('GHL API Error:', error)
    throw new Error(`GHL API failed: ${response.status}`)
  }

  return response.json()
}

export async function addGHLTags(contactId: string, tags: string[]): Promise<any> {
  const response = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('GHL_API_KEY')}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    },
    body: JSON.stringify({ tags })
  })

  if (!response.ok) {
    throw new Error(`GHL tags update failed: ${response.status}`)
  }

  return response.json()
}

export async function sendSMS(
  contactId: string,
  message: string
): Promise<any> {
  const requestBody = {
    type: 'SMS',
    contactId,
    message
  }

  console.log('GHL Send SMS Request:', {
    url: `${GHL_API_BASE}/conversations/messages`,
    body: JSON.stringify(requestBody)
  })

  const response = await fetch(`${GHL_API_BASE}/conversations/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('GHL_API_KEY')}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    },
    body: JSON.stringify(requestBody)
  })

  const responseText = await response.text()
  console.log('GHL Send SMS Response:', {
    status: response.status,
    body: responseText
  })

  if (!response.ok) {
    console.error('GHL Send SMS Error:', responseText)
    throw new Error(`GHL Send SMS failed: ${response.status} - ${responseText}`)
  }

  try {
    return JSON.parse(responseText)
  } catch {
    return { raw: responseText }
  }
}