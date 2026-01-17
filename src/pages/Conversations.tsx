import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ContactWithLastMessage } from '../types/database';
import { ConversationList } from '../components/ConversationList';
import { MessageThread } from '../components/MessageThread';

export function Conversations() {
  const [searchParams] = useSearchParams();
  const [selectedContact, setSelectedContact] = useState<ContactWithLastMessage | null>(null);

  useEffect(() => {
    const contactId = searchParams.get('contactId');
    if (contactId && !selectedContact) {
    }
  }, [searchParams]);

  return (
    <div className="flex h-full">
      <div className="w-1/3">
        <ConversationList
          selectedContactId={selectedContact?.id || null}
          onSelectContact={setSelectedContact}
        />
      </div>
      <div className="flex-1">
        {selectedContact ? (
          <MessageThread contact={selectedContact} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a conversation to view messages
          </div>
        )}
      </div>
    </div>
  );
}
