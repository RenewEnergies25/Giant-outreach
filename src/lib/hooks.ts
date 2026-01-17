import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import {
  Message,
  DailyMetric,
  ContactWithLastMessage,
  EscalationWithContact,
  DashboardStats,
  ConversationStage,
  EscalationType
} from '../types/database';

export function useContacts(searchQuery: string = '', stageFilter?: ConversationStage) {
  const [contacts, setContacts] = useState<ContactWithLastMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts();

    const subscription = supabase
      .channel('contacts-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        fetchContacts();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [searchQuery, stageFilter]);

  async function fetchContacts() {
    try {
      setLoading(true);

      let query = supabase
        .from('contacts')
        .select('*')
        .neq('conversation_stage', 'opted_out')
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (stageFilter) {
        query = query.eq('conversation_stage', stageFilter);
      }

      const { data: contactsData, error: contactsError } = await query;

      if (contactsError) throw contactsError;

      const contactsWithMessages = await Promise.all(
        (contactsData || []).map(async (contact) => {
          const { data: messagesData } = await supabase
            .from('messages')
            .select('*')
            .eq('contact_id', contact.id)
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...contact,
            last_message: messagesData?.[0],
          };
        })
      );

      const filteredContacts = contactsWithMessages.filter(c => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          c.first_name?.toLowerCase().includes(query) ||
          c.last_name?.toLowerCase().includes(query) ||
          c.full_name?.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.phone?.toLowerCase().includes(query)
        );
      });

      setContacts(filteredContacts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  }

  return { contacts, loading, error, refetch: fetchContacts };
}

export function useMessages(contactId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();

    const subscription = supabase
      .channel('messages-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMessage = payload.new as Message;
        if (!contactId || newMessage.contact_id === contactId) {
          setMessages(prev => [...prev, newMessage]);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [contactId]);

  async function fetchMessages() {
    try {
      setLoading(true);
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (contactId) {
        query = query.eq('contact_id', contactId);
      } else {
        query = query.limit(10).order('created_at', { ascending: false });
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setMessages(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  }

  return { messages, loading, error, refetch: fetchMessages };
}

export function useEscalations(typeFilter?: EscalationType) {
  const [escalations, setEscalations] = useState<EscalationWithContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEscalations();

    const subscription = supabase
      .channel('escalations-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escalations' }, () => {
        fetchEscalations();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [typeFilter]);

  async function fetchEscalations() {
    try {
      setLoading(true);

      let query = supabase
        .from('escalations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (typeFilter) {
        query = query.eq('escalation_type', typeFilter);
      }

      const { data: escalationsData, error: escalationsError } = await query;

      if (escalationsError) throw escalationsError;

      const escalationsWithContacts = await Promise.all(
        (escalationsData || []).map(async (escalation) => {
          if (escalation.contact_id) {
            const { data: contactData } = await supabase
              .from('contacts')
              .select('*')
              .eq('id', escalation.contact_id)
              .maybeSingle();

            return {
              ...escalation,
              contact: contactData || undefined,
            };
          }
          return escalation;
        })
      );

      setEscalations(escalationsWithContacts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch escalations');
    } finally {
      setLoading(false);
    }
  }

  async function updateEscalation(id: string, status: 'resolved' | 'dismissed') {
    try {
      const updates: Record<string, unknown> = {
        status,
      };

      if (status === 'resolved' || status === 'dismissed') {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = 'dashboard_user';
      }

      const { error: updateError } = await supabase
        .from('escalations')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchEscalations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update escalation');
    }
  }

  return { escalations, loading, error, refetch: fetchEscalations, updateEscalation };
}

export function useMetrics(startDate: Date, endDate: Date) {
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, [startDate, endDate]);

  async function fetchMetrics() {
    try {
      setLoading(true);

      const { data, error: fetchError } = await supabase
        .from('daily_metrics')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (fetchError) throw fetchError;

      setMetrics(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }

  return { metrics, loading, error, refetch: fetchMetrics };
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    total_contacts: 0,
    active_conversations: 0,
    calendar_links_sent: 0,
    qualified_pending: 0,
    needs_review_pending: 0,
    messages_today: 0,
    bookings_today: 0,
    opt_outs_today: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();

    // Real-time subscription for stats updates
    const subscription = supabase
      .channel('stats-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escalations' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_metrics' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);

      // Try to use the RPC function first
      const { data: rpcStats, error: rpcError } = await supabase.rpc('get_dashboard_stats');

      if (!rpcError && rpcStats) {
        setStats(rpcStats as DashboardStats);
      } else {
        // Fallback to manual queries
        const { count: totalContacts } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .neq('conversation_stage', 'opted_out');

        const { count: activeConversations } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_stage', 'in_conversation');

        const { count: calendarLinksSent } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('calendar_link_sent', true)
          .eq('is_qualified', false);

        const { count: qualifiedPending } = await supabase
          .from('escalations')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .eq('escalation_type', 'booked');

        const { count: needsReviewPending } = await supabase
          .from('escalations')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .eq('escalation_type', 'needs_review');

        const today = new Date().toISOString().split('T')[0];
        const { data: todayMetrics } = await supabase
          .from('daily_metrics')
          .select('*')
          .eq('date', today)
          .maybeSingle();

        setStats({
          total_contacts: totalContacts || 0,
          active_conversations: activeConversations || 0,
          calendar_links_sent: calendarLinksSent || 0,
          qualified_pending: qualifiedPending || 0,
          needs_review_pending: needsReviewPending || 0,
          messages_today: (todayMetrics?.messages_sent || 0) + (todayMetrics?.messages_received || 0),
          bookings_today: todayMetrics?.bookings || 0,
          opt_outs_today: todayMetrics?.opt_outs || 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }

  return { stats, loading, refetch: fetchStats };
}

// Legacy hook for backwards compatibility
export function useLegacyDashboardStats() {
  const { stats, loading, refetch } = useDashboardStats();

  return {
    stats: {
      totalConversations: stats.total_contacts,
      messagesToday: stats.messages_today,
      responseRate: 0, // No longer computed
      qualifiedLeads: stats.qualified_pending,
    },
    loading,
    refetch
  };
}

export interface RecentActivityContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  message_count: number;
  last_message_at: string | null;
  conversation_stage: string;
  messages: Message[];
}

export function useRecentActivity(limit: number = 10) {
  const [recentContacts, setRecentContacts] = useState<RecentActivityContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentActivity();

    const subscription = supabase
      .channel('recent-activity-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchRecentActivity();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        fetchRecentActivity();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [limit]);

  async function fetchRecentActivity() {
    try {
      setLoading(true);

      // Fetch contacts ordered by last message time
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, full_name, email, message_count, last_message_at, conversation_stage')
        .neq('conversation_stage', 'opted_out')
        .not('last_message_at', 'is', null)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (contactsError) throw contactsError;

      // Fetch recent messages for each contact
      const contactsWithMessages = await Promise.all(
        (contactsData || []).map(async (contact) => {
          const { data: messagesData } = await supabase
            .from('messages')
            .select('*')
            .eq('contact_id', contact.id)
            .order('created_at', { ascending: false })
            .limit(5);

          return {
            ...contact,
            messages: messagesData || [],
          };
        })
      );

      setRecentContacts(contactsWithMessages);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recent activity');
    } finally {
      setLoading(false);
    }
  }

  return { recentContacts, loading, error, refetch: fetchRecentActivity };
}

export async function markContactAsQualified(contactId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Update contact as qualified
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        conversation_stage: 'booked',
        is_qualified: true,
        qualified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId);

    if (updateError) throw updateError;

    // Resolve any pending calendar_sent escalations
    await supabase
      .from('escalations')
      .update({
        status: 'resolved',
        resolved_by: 'manual_qualification',
        resolved_at: new Date().toISOString()
      })
      .eq('contact_id', contactId)
      .eq('escalation_type', 'calendar_sent')
      .eq('status', 'pending');

    // Create a booked escalation
    const { error: escalationError } = await supabase
      .from('escalations')
      .insert({
        contact_id: contactId,
        escalation_type: 'booked',
        reason: 'Manually marked as qualified - appointment booked',
        status: 'pending'
      });

    if (escalationError) throw escalationError;

    // Increment booking metric
    await supabase.rpc('increment_metric', { metric_name: 'bookings' });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to mark contact as qualified'
    };
  }
}
