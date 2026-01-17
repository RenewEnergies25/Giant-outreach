const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function conversationCompletion(
  systemPrompt: string,
  conversationHistory: ChatMessage[],
  newMessage: string
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: newMessage }
  ]

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages,
      max_tokens: 500,
      temperature: 0.7
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('OpenAI API Error:', error)
    throw new Error(`OpenAI API failed: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export async function quickClassification(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 20,
      temperature: 0
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI classification failed: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content.trim().toLowerCase()
}