import { useState } from 'react';
import { ContactWithLastMessage } from '../types/database';
import { useContacts } from '../lib/hooks';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Search } from 'lucide-react';

interface ConversationListProps {
  selectedContactId: string | null;
  onSelectContact: (contact: ContactWithLastMessage) => void;
}

export function ConversationList({ selectedContactId, onSelectContact }: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { contacts, loading } = useContacts(searchQuery);

  return (
    <div className="flex flex-col h-full border-r border-border">
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : (
          <div className="p-2">
            {contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => onSelectContact(contact)}
                className={cn(
                  'w-full text-left p-3 rounded-lg hover:bg-accent transition-colors',
                  selectedContactId === contact.id && 'bg-accent'
                )}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-medium text-sm">{contact.first_name}</span>
                  {contact.last_message && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(contact.last_message.created_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  {contact.email}
                </p>
                {contact.last_message && (
                  <p className="text-sm text-muted-foreground truncate">
                    {contact.last_message.content}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
