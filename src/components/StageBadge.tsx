import { Badge } from './ui/badge'
import { ConversationStage } from '@/types/database'

const stageConfig: Record<ConversationStage, { label: string; color: string }> = {
  initial: { label: 'Initial', color: 'bg-gray-500' },
  in_conversation: { label: 'In Conversation', color: 'bg-blue-500' },
  calendar_link_sent: { label: 'Calendar Sent', color: 'bg-yellow-500' },
  booked: { label: 'Booked', color: 'bg-green-500' },
  stalled: { label: 'Stalled', color: 'bg-red-500' },
  opted_out: { label: 'Opted Out', color: 'bg-gray-700' }
}

interface StageBadgeProps {
  stage: ConversationStage | string
}

export function StageBadge({ stage }: StageBadgeProps) {
  const config = stageConfig[stage as ConversationStage] || stageConfig.initial

  return (
    <Badge className={`${config.color} text-white hover:${config.color}`}>
      {config.label}
    </Badge>
  )
}
