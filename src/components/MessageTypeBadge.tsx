import { Badge } from './ui/badge'
import { MessageType } from '@/types/database'

const typeConfig: Record<MessageType, { label: string; color: string }> = {
  conversation: { label: 'AI', color: 'bg-purple-500' },
  bump: { label: 'Bump', color: 'bg-orange-500' },
  calendar_sent: { label: 'Calendar', color: 'bg-green-500' },
  opt_out: { label: 'Opt-out', color: 'bg-red-500' },
  manual: { label: 'Manual', color: 'bg-blue-500' }
}

interface MessageTypeBadgeProps {
  type: MessageType | string
}

export function MessageTypeBadge({ type }: MessageTypeBadgeProps) {
  const config = typeConfig[type as MessageType] || typeConfig.conversation

  return (
    <Badge variant="outline" className={`${config.color} text-white text-xs border-none`}>
      {config.label}
    </Badge>
  )
}
