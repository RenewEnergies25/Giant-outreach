import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import {
  Message,
  DailyMetric,
  ContactWithLastMessage,
  EscalationWithContact,
  DashboardStats,
  ConversationStage,
  EscalationType,
  Campaign,
  CampaignWithStats,
  CampaignStats,
  CampaignContactWithContact,
  CampaignMetric,
  CampaignStatus,
  EnhancedDashboardStats
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

// ============================================
// CAMPAIGN HOOKS
// ============================================

export function useCampaigns(statusFilter?: CampaignStatus) {
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();

    const subscription = supabase
      .channel('campaigns-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => {
        fetchCampaigns();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [statusFilter]);

  async function fetchCampaigns() {
    try {
      setLoading(true);

      let query = supabase
        .from('campaigns')
        .select('*')
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data: campaignsData, error: campaignsError } = await query;

      if (campaignsError) throw campaignsError;

      // Fetch stats for each campaign
      const campaignsWithStats = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
          const { data: statsData } = await supabase.rpc('get_campaign_stats', {
            p_campaign_id: campaign.id
          });

          return {
            ...campaign,
            stats: statsData as CampaignStats | undefined,
          };
        })
      );

      setCampaigns(campaignsWithStats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  }

  return { campaigns, loading, error, refetch: fetchCampaigns };
}

export function useCampaign(campaignId: string | null) {
  const [campaign, setCampaign] = useState<CampaignWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) {
      setCampaign(null);
      setLoading(false);
      return;
    }

    fetchCampaign();

    const subscription = supabase
      .channel(`campaign-${campaignId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` }, () => {
        fetchCampaign();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_contacts', filter: `campaign_id=eq.${campaignId}` }, () => {
        fetchCampaign();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [campaignId]);

  async function fetchCampaign() {
    if (!campaignId) return;

    try {
      setLoading(true);

      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError) throw campaignError;

      const { data: statsData } = await supabase.rpc('get_campaign_stats', {
        p_campaign_id: campaignId
      });

      setCampaign({
        ...campaignData,
        stats: statsData as CampaignStats | undefined,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch campaign');
    } finally {
      setLoading(false);
    }
  }

  return { campaign, loading, error, refetch: fetchCampaign };
}

export function useCampaignContacts(campaignId: string | null, searchQuery: string = '') {
  const [contacts, setContacts] = useState<CampaignContactWithContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) {
      setContacts([]);
      setLoading(false);
      return;
    }

    fetchContacts();

    const subscription = supabase
      .channel(`campaign-contacts-${campaignId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_contacts', filter: `campaign_id=eq.${campaignId}` }, () => {
        fetchContacts();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [campaignId, searchQuery]);

  async function fetchContacts() {
    if (!campaignId) return;

    try {
      setLoading(true);

      const { data: ccData, error: ccError } = await supabase
        .from('campaign_contacts')
        .select('*')
        .eq('campaign_id', campaignId)
        .is('exited_at', null)
        .order('enrolled_at', { ascending: false });

      if (ccError) throw ccError;

      // Fetch contact details for each campaign contact
      const contactsWithDetails = await Promise.all(
        (ccData || []).map(async (cc) => {
          const { data: contactData } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', cc.contact_id)
            .single();

          return {
            ...cc,
            contact: contactData || undefined,
          };
        })
      );

      // Filter by search query
      const filteredContacts = contactsWithDetails.filter(cc => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const contact = cc.contact;
        if (!contact) return false;
        return (
          contact.first_name?.toLowerCase().includes(query) ||
          contact.last_name?.toLowerCase().includes(query) ||
          contact.full_name?.toLowerCase().includes(query) ||
          contact.email?.toLowerCase().includes(query) ||
          contact.phone?.toLowerCase().includes(query)
        );
      });

      setContacts(filteredContacts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch campaign contacts');
    } finally {
      setLoading(false);
    }
  }

  return { contacts, loading, error, refetch: fetchContacts };
}

export function useCampaignMetrics(campaignId: string | null, startDate: Date, endDate: Date) {
  const [metrics, setMetrics] = useState<CampaignMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) {
      setMetrics([]);
      setLoading(false);
      return;
    }

    fetchMetrics();
  }, [campaignId, startDate, endDate]);

  async function fetchMetrics() {
    if (!campaignId) return;

    try {
      setLoading(true);

      const { data, error: fetchError } = await supabase
        .from('campaign_metrics')
        .select('*')
        .eq('campaign_id', campaignId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (fetchError) throw fetchError;

      setMetrics(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch campaign metrics');
    } finally {
      setLoading(false);
    }
  }

  return { metrics, loading, error, refetch: fetchMetrics };
}

export function useEnhancedDashboardStats() {
  const [stats, setStats] = useState<EnhancedDashboardStats>({
    total_contacts: 0,
    active_conversations: 0,
    calendar_links_sent: 0,
    qualified_pending: 0,
    needs_review_pending: 0,
    messages_today: 0,
    bookings_today: 0,
    opt_outs_today: 0,
    active_campaigns: 0,
    total_campaigns: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();

    const subscription = supabase
      .channel('enhanced-stats-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escalations' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_metrics' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => {
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

      const { data: rpcStats, error: rpcError } = await supabase.rpc('get_dashboard_stats');

      if (!rpcError && rpcStats) {
        setStats(rpcStats as EnhancedDashboardStats);
      }
    } catch (err) {
      console.error('Failed to fetch enhanced dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }

  return { stats, loading, refetch: fetchStats };
}

// Campaign CRUD operations
export async function createCampaign(campaign: Partial<Campaign>): Promise<{ success: boolean; data?: Campaign; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        name: campaign.name || 'New Campaign',
        description: campaign.description,
        status: 'draft',
        sms_enabled: campaign.sms_enabled ?? true,
        whatsapp_enabled: campaign.whatsapp_enabled ?? true,
        email_enabled: campaign.email_enabled ?? true,
        daily_message_limit: campaign.daily_message_limit ?? 100,
        bump_delay_hours: campaign.bump_delay_hours ?? 24,
        max_bumps: campaign.max_bumps ?? 3,
        vsl_url: campaign.vsl_url || null,
        vsl_title: campaign.vsl_title || null,
        vsl_thumbnail_url: campaign.vsl_thumbnail_url || null,
        vsls: campaign.vsls || [],
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create campaign'
    };
  }
}

export async function updateCampaign(id: string, updates: Partial<Campaign>): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('campaigns')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update campaign'
    };
  }
}

export async function updateCampaignStatus(id: string, status: CampaignStatus): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: Partial<Campaign> & { updated_at: string } = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'active') {
      updates.started_at = new Date().toISOString();
      updates.paused_at = null;
    } else if (status === 'paused') {
      updates.paused_at = new Date().toISOString();
    } else if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update campaign status'
    };
  }
}

export async function deleteCampaign(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('campaigns')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete campaign'
    };
  }
}

export async function enrollContactInCampaign(
  campaignId: string,
  contactId: string,
  enrolledBy: string = 'manual'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('enroll_contact_in_campaign', {
      p_campaign_id: campaignId,
      p_contact_id: contactId,
      p_enrolled_by: enrolledBy
    });

    if (error) throw error;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to enroll contact in campaign'
    };
  }
}

export async function removeContactFromCampaign(
  campaignId: string,
  contactId: string,
  exitReason: string = 'removed'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('campaign_contacts')
      .update({
        exited_at: new Date().toISOString(),
        exit_reason: exitReason,
        updated_at: new Date().toISOString(),
      })
      .eq('campaign_id', campaignId)
      .eq('contact_id', contactId);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove contact from campaign'
    };
  }
}

// ============================================
// INSTANTLY INTEGRATION
// ============================================

export type InstantlySyncAction = 'create' | 'sync_leads' | 'activate' | 'pause' | 'full_sync';

export interface InstantlySyncResult {
  success: boolean;
  instantly_campaign_id?: string;
  sequences_synced?: number;
  leads_added?: number;
  leads_failed?: number;
  status?: string;
  error?: string;
}

export async function syncToInstantly(
  campaignId: string,
  action: InstantlySyncAction
): Promise<InstantlySyncResult> {
  try {
    const { data, error } = await supabase.functions.invoke('sync-to-instantly', {
      body: { campaign_id: campaignId, action }
    });

    if (error) throw error;

    return data as InstantlySyncResult;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to sync with Instantly'
    };
  }
}

export async function checkInstantlyConfig(): Promise<{ configured: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('instantly_config')
      .select('id, is_active')
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;

    return { configured: !!data };
  } catch (err) {
    return {
      configured: false,
      error: err instanceof Error ? err.message : 'Failed to check Instantly configuration'
    };
  }
}
