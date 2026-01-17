import { useRecentActivity, markContactAsQualified } from '../lib/hooks';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export function ActivityFeed() {
  const { recentContacts, loading, refetch } = useRecentActivity(10);

  const getContactName = (contact: { first_name: string | null; full_name: string | null; email: string | null }) => {
    return contact.first_name || contact.full_name || contact.email || 'Unknown';
  };

  const handleMarkAsQualified = async (contactId: string, contactName: string) => {
    const result = await markContactAsQualified(contactId);
    if (result.success) {
      toast.success(`${contactName} marked as qualified`);
      refetch();
    } else {
      toast.error(result.error || 'Failed to mark as qualified');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {recentContacts.map((contact) => {
              const latestMessage = contact.messages[0];
              const hasAiMessages = contact.messages.some(m => m.ai_generated);
              const hasInbound = contact.messages.some(m => m.direction === 'inbound');
              const hasOutbound = contact.messages.some(m => m.direction === 'outbound');
              const contactName = getContactName(contact);
              const isQualified = contact.conversation_stage === 'booked';

              return (
                <div
                  key={contact.id}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Header row with name, badges and message count */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm">
                          {contactName}
                        </span>
                        {isQualified && (
                          <Badge className="bg-green-600 text-white">
                            Qualified
                          </Badge>
                        )}
                        {hasOutbound && (
                          <Badge
                            variant="secondary"
                            className="bg-blue-500/10 text-blue-500"
                          >
                            outbound
                          </Badge>
                        )}
                        {hasInbound && (
                          <Badge
                            variant="default"
                            className="bg-green-500/10 text-green-500"
                          >
                            inbound
                          </Badge>
                        )}
                        {hasAiMessages && (
                          <Badge variant="outline" className="text-xs">
                            AI
                          </Badge>
                        )}
                        <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          <span>{contact.message_count}</span>
                        </div>
                      </div>

                      {/* Messages preview - show last few messages in conversation order */}
                      <div className="space-y-1.5 mb-2">
                        {contact.messages.slice(0, 3).reverse().map((message) => (
                          <div
                            key={message.id}
                            className={`text-sm rounded px-2 py-1 ${
                              message.direction === 'inbound'
                                ? 'bg-muted/50 text-foreground'
                                : 'bg-blue-500/10 text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                {message.direction === 'inbound' ? 'Lead' : 'Agent'}
                              </span>
                              {message.ai_generated && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                  AI
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-muted-foreground">
                              {message.content}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Footer with timestamp and actions */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {latestMessage && formatDistanceToNow(new Date(latestMessage.created_at), { addSuffix: true })}
                        </p>
                        {!isQualified && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-green-600 border-green-600 hover:bg-green-600 hover:text-white"
                            onClick={() => handleMarkAsQualified(contact.id, contactName)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Mark Qualified
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
