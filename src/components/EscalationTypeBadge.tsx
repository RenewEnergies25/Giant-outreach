import { Badge } from './ui/badge'
import { EscalationType } from '@/types/database'

const typeConfig: Record<EscalationType, { label: string; color: string }> = {
  booked: { label: 'Qualified', color: 'bg-green-500' },
  calendar_sent: { label: 'Calendar Sent', color: 'bg-yellow-500' },
  needs_review: { label: 'Needs Review', color: 'bg-orange-500' }
}

interface EscalationTypeBadgeProps {
  type: EscalationType | string
}

export function EscalationTypeBadge({ type }: EscalationTypeBadgeProps) {
  const config = typeConfig[type as EscalationType] || typeConfig.needs_review

  return (
    <Badge className={`${config.color} text-white hover:${config.color}`}>
      {config.label}
    </Badge>
  )
}
