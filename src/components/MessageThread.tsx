import { useState, useEffect, useRef } from 'react';
import { Contact } from '../types/database';
import { useMessages } from '../lib/hooks';
import { MessageBubble } from './MessageBubble';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Send } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface MessageThreadProps {
  contact: Contact;
}

export function MessageThread({ contact }: MessageThreadProps) {
  const { messages, loading } = useMessages(contact.id);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    console.log('Sending manual reply to', contact.email, ':', newMessage);
    setNewMessage('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{contact.first_name}</h2>
            <p className="text-sm text-muted-foreground">{contact.email}</p>
            <p className="text-sm text-muted-foreground">{contact.phone}</p>
          </div>
          <Badge>{contact.status}</Badge>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="min-h-[60px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
