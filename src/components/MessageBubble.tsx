import { Message } from '../types/database';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isInbound = message.direction === 'inbound';

  return (
    <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-4 py-2',
          isInbound ? 'bg-muted' : 'bg-blue-500/10'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          {message.ai_generated && (
            <Badge variant="outline" className="text-xs">
              AI
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {message.channel}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
