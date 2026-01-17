import { quickClassification } from './openai.ts'

export type MessageIntent =
  | 'answer'
  | 'question'
  | 'objection'
  | 'agreement'
  | 'rejection'
  | 'unclear'

export interface EscalationCheck {
  shouldEscalate: boolean
  reason: string | null
  escalationType: 'needs_review' | null
}

export async function detectMessageIntent(
  leadMessage: string,
  lastAssistantMessage: string | null
): Promise<MessageIntent> {
  const systemPrompt = `You are classifying a lead's SMS response. Return ONLY one word from this list:
- answer: They answered a question we asked them
- question: They're asking us a question
- objection: They're pushing back, expressing doubt, or raising concerns
- agreement: They're saying yes, agreeing, or confirming something positive
- rejection: They're saying no, declining, or refusing
- unclear: Cannot determine their intent

Be strict and accurate. If they ask "how much" or "what's the price" that's a question. If they say "not interested" that's rejection. If they say "sounds good" or "yes please" that's agreement.`

  const userMessage = `Our last message: "${lastAssistantMessage || 'Initial outreach'}"

Lead's response: "${leadMessage}"

Classification:`

  try {
    const result = await quickClassification(systemPrompt, userMessage)
    const validIntents: MessageIntent[] = ['answer', 'question', 'objection', 'agreement', 'rejection', 'unclear']
    return validIntents.includes(result as MessageIntent) ? result as MessageIntent : 'unclear'
  } catch (error) {
    console.error('Intent detection failed:', error)
    return 'unclear'
  }
}

export function checkForHumanReview(
  messageIntent: MessageIntent,
  questionsAsked: number,
  messageCount: number
): EscalationCheck {
  if (questionsAsked >= 3) {
    return {
      shouldEscalate: true,
      reason: `Lead asked ${questionsAsked} questions - may need human touch`,
      escalationType: 'needs_review'
    }
  }

  if (messageCount >= 12) {
    return {
      shouldEscalate: true,
      reason: 'Extended conversation without booking - review needed',
      escalationType: 'needs_review'
    }
  }

  if (messageIntent === 'objection') {
    return {
      shouldEscalate: true,
      reason: 'Lead raising objections - human intervention recommended',
      escalationType: 'needs_review'
    }
  }

  return {
    shouldEscalate: false,
    reason: null,
    escalationType: null
  }
}

export function getLastAssistantMessage(history: Array<{role: string, content: string}>): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') {
      return history[i].content
    }
  }
  return null
}