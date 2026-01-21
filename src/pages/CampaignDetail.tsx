import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Users,
  Sparkles,
  Send,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  MoreVertical,
  Loader2,
  Zap,
  Search,
  Globe,
  Building2,
  User,
  ChevronDown,
  ChevronRight,
  FileText,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { supabase } from '../lib/supabase';
import { Campaign, CampaignLead, CampaignLeadStats } from '../types/database';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { findEmail, extractDomain, splitName } from '../lib/hunter';

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [stats, setStats] = useState<CampaignLeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Action states
  const [generatingSubjects, setGeneratingSubjects] = useState(false);
  const [findingEmails, setFindingEmails] = useState(false);
  const [emailFindProgress, setEmailFindProgress] = useState({ current: 0, total: 0 });
  const [syncingToInstantly, setSyncingToInstantly] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);

  // Hunter API key
  const [hunterApiKey, setHunterApiKey] = useState<string | null>(null);

  // Selected lead for viewing
  const [selectedLead, setSelectedLead] = useState<CampaignLead | null>(null);

  // Delete confirmation
  const [leadToDelete, setLeadToDelete] = useState<CampaignLead | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Expanded rows for email preview
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());

  const toggleLeadExpanded = (leadId: string) => {
    setExpandedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const expandAllLeads = () => {
    setExpandedLeads(new Set(filteredLeads.map((l) => l.id)));
  };

  const collapseAllLeads = () => {
    setExpandedLeads(new Set());
  };

  useEffect(() => {
    if (id) {
      fetchCampaignData();
    }
    fetchHunterApiKey();
  }, [id]);

  async function fetchHunterApiKey() {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('api_key')
        .eq('service', 'hunter')
        .single();

      if (!error && data) {
        setHunterApiKey(data.api_key);
      }
    } catch (err) {
      console.error('Failed to fetch Hunter API key:', err);
    }
  }

  async function fetchCampaignData() {
    if (!id) return;

    try {
      setLoading(true);

      // Fetch campaign
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();

      if (campaignError) throw campaignError;
      setCampaign(campaignData);

      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('campaign_leads')
        .select('*')
        .eq('campaign_id', id)
        .order('created_at', { ascending: true });

      if (leadsError) throw leadsError;
      setLeads(leadsData || []);

      // Fetch stats
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_campaign_lead_stats', { p_campaign_id: id });

      if (!statsError && statsData) {
        setStats(statsData);
      }
    } catch (err) {
      console.error('Failed to fetch campaign:', err);
      toast.error('Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }

  const filteredLeads = leads.filter((lead) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.first_name?.toLowerCase().includes(query) ||
      lead.company_name?.toLowerCase().includes(query) ||
      lead.website?.toLowerCase().includes(query) ||
      lead.email_address?.toLowerCase().includes(query)
    );
  });

  const handleGenerateAllSubjects = async () => {
    if (!campaign) return;

    const leadsWithoutSubjects = leads.filter((l) => !l.subject_line);
    if (leadsWithoutSubjects.length === 0) {
      toast.info('All leads already have subject lines');
      return;
    }

    setGeneratingSubjects(true);
    let generated = 0;

    for (const lead of leadsWithoutSubjects) {
      try {
        const { data, error } = await supabase.functions.invoke('generate-subject', {
          body: {
            campaign_id: campaign.id,
            contact_id: lead.id,
            template_id: lead.id,
            contact_data: {
              first_name: lead.first_name,
              company: lead.company_name,
            },
            campaign_data: {
              name: campaign.name,
              channel_type: 'email',
            },
            template_data: {
              name: 'Campaign Email',
              body_preview: lead.email_body?.substring(0, 200),
            },
          },
        });

        if (!error && data?.subject_line) {
          // Update lead with generated subject
          await supabase
            .from('campaign_leads')
            .update({
              subject_line: data.subject_line,
              subject_generated_at: new Date().toISOString(),
            })
            .eq('id', lead.id);

          generated++;
        }
      } catch (err) {
        console.error('Failed to generate subject for lead:', lead.id, err);
      }
    }

    setGeneratingSubjects(false);
    toast.success(`Generated ${generated} subject lines`);
    fetchCampaignData();
  };

  const handleFindEmails = async () => {
    if (!hunterApiKey) {
      toast.error('Hunter.io API key not configured. Go to Settings to add it.');
      return;
    }

    // Get leads without email addresses that have website info
    const leadsToFind = leads.filter(
      (l) => !l.email_address && l.website && l.first_name
    );

    if (leadsToFind.length === 0) {
      toast.info('All leads with website info already have email addresses');
      return;
    }

    setFindingEmails(true);
    setEmailFindProgress({ current: 0, total: leadsToFind.length });

    let found = 0;
    let notFound = 0;

    for (let i = 0; i < leadsToFind.length; i++) {
      const lead = leadsToFind[i];
      setEmailFindProgress({ current: i + 1, total: leadsToFind.length });

      try {
        const domain = extractDomain(lead.website || '');
        if (!domain) {
          notFound++;
          continue;
        }

        // Split full name into first and last name for Hunter API
        const { firstName, lastName } = splitName(lead.first_name || '');

        const result = await findEmail({
          domain,
          firstName,
          lastName: lastName || undefined,
          apiKey: hunterApiKey,
        });

        if (result.success && result.email) {
          // Update lead with found email
          await supabase
            .from('campaign_leads')
            .update({
              email_address: result.email,
              email_status: 'found',
              email_confidence_score: result.score,
              updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id);

          found++;
        } else {
          // Mark as not found
          await supabase
            .from('campaign_leads')
            .update({
              email_status: 'not_found',
              updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id);

          notFound++;
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        console.error('Failed to find email for lead:', lead.id, err);
        notFound++;
      }
    }

    setFindingEmails(false);
    setEmailFindProgress({ current: 0, total: 0 });

    if (found > 0) {
      toast.success(`Found ${found} email addresses`);
    }
    if (notFound > 0) {
      toast.info(`${notFound} emails could not be found`);
    }

    fetchCampaignData();
  };

  const handleFindSingleEmail = async (lead: CampaignLead) => {
    if (!hunterApiKey) {
      toast.error('Hunter.io API key not configured. Go to Settings to add it.');
      return;
    }

    if (!lead.website || !lead.first_name) {
      toast.error('Lead needs website and first name to find email');
      return;
    }

    try {
      const domain = extractDomain(lead.website);
      if (!domain) {
        toast.error('Invalid website URL');
        return;
      }

      toast.loading('Finding email...', { id: 'find-email' });

      // Split full name into first and last name for Hunter API
      const { firstName, lastName } = splitName(lead.first_name);

      const result = await findEmail({
        domain,
        firstName,
        lastName: lastName || undefined,
        apiKey: hunterApiKey,
      });

      if (result.success && result.email) {
        await supabase
          .from('campaign_leads')
          .update({
            email_address: result.email,
            email_status: 'found',
            email_confidence_score: result.score,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead.id);

        toast.success(`Found email: ${result.email}`, { id: 'find-email' });
        fetchCampaignData();
      } else {
        await supabase
          .from('campaign_leads')
          .update({
            email_status: 'not_found',
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead.id);

        toast.error(result.error || 'Email not found', { id: 'find-email' });
      }
    } catch (err) {
      toast.error('Failed to find email', { id: 'find-email' });
    }
  };

  const handleRegenerateSubject = async (lead: CampaignLead) => {
    if (!campaign) return;

    try {
      const { data, error } = await supabase.functions.invoke('generate-subject', {
        body: {
          campaign_id: campaign.id,
          contact_id: lead.id,
          template_id: lead.id,
          contact_data: {
            first_name: lead.first_name,
            company: lead.company_name,
          },
          campaign_data: {
            name: campaign.name,
            channel_type: 'email',
          },
          template_data: {
            name: 'Campaign Email',
            body_preview: lead.email_body?.substring(0, 200),
          },
        },
      });

      if (error) throw error;

      if (data?.subject_line) {
        await supabase
          .from('campaign_leads')
          .update({
            subject_line: data.subject_line,
            subject_generated_at: new Date().toISOString(),
          })
          .eq('id', lead.id);

        toast.success('Subject line regenerated');
        fetchCampaignData();
      }
    } catch (err) {
      console.error('Failed to regenerate subject:', err);
      toast.error('Failed to regenerate subject');
    }
  };

  const handleSyncToInstantly = async () => {
    if (!campaign || !stats) return;

    // Check if ready
    if (stats.emails_found === 0) {
      toast.error('No email addresses found. Find emails first.');
      return;
    }

    if (stats.subjects_pending > 0) {
      toast.error('Some leads are missing subject lines. Generate subjects first.');
      return;
    }

    setSyncingToInstantly(true);

    try {
      const { data, error } = await supabase.functions.invoke('sync-to-instantly', {
        body: {
          campaign_id: campaign.id,
          action: 'full_sync',
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Synced to Instantly! ${data.leads_added || 0} leads added.`);
        setShowSendDialog(false);
        fetchCampaignData();
      } else {
        throw new Error(data?.error || 'Sync failed');
      }
    } catch (err) {
      console.error('Failed to sync to Instantly:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to sync to Instantly');
    } finally {
      setSyncingToInstantly(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!leadToDelete) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('campaign_leads')
        .delete()
        .eq('id', leadToDelete.id);

      if (error) throw error;

      toast.success('Lead removed from campaign');
      setLeadToDelete(null);
      fetchCampaignData();
    } catch (err) {
      console.error('Failed to delete lead:', err);
      toast.error('Failed to remove lead');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Campaign not found</h2>
          <Button variant="link" onClick={() => navigate('/campaigns')}>
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  const readyToSend = stats && stats.emails_found > 0 && stats.subjects_pending === 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          {campaign.description && (
            <p className="text-muted-foreground">{campaign.description}</p>
          )}
        </div>
        <Badge
          className={cn(
            'font-medium',
            campaign.status === 'active' && 'bg-green-500/10 text-green-500',
            campaign.status === 'draft' && 'bg-gray-500/10 text-gray-500',
            campaign.status === 'paused' && 'bg-yellow-500/10 text-yellow-500'
          )}
        >
          {campaign.status}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total_leads || 0}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.emails_found || 0}</p>
                <p className="text-xs text-muted-foreground">Emails Found</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.subjects_generated || 0}</p>
                <p className="text-xs text-muted-foreground">Subjects Generated</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.synced_to_instantly || 0}</p>
                <p className="text-xs text-muted-foreground">Synced to Instantly</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button
          onClick={handleGenerateAllSubjects}
          disabled={generatingSubjects || !stats || stats.subjects_pending === 0}
        >
          {generatingSubjects ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Generate All Subjects
          {stats && stats.subjects_pending > 0 && (
            <Badge variant="secondary" className="ml-2">
              {stats.subjects_pending} pending
            </Badge>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={handleFindEmails}
          disabled={findingEmails || !hunterApiKey || leads.filter(l => !l.email_address && l.website).length === 0}
        >
          {findingEmails ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {findingEmails
            ? `Finding... ${emailFindProgress.current}/${emailFindProgress.total}`
            : 'Find Emails'}
          {!findingEmails && !hunterApiKey && (
            <Badge variant="secondary" className="ml-2 text-yellow-500">
              Configure in Settings
            </Badge>
          )}
          {!findingEmails && hunterApiKey && leads.filter(l => !l.email_address && l.website).length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {leads.filter(l => !l.email_address && l.website).length} pending
            </Badge>
          )}
        </Button>

        <Button
          variant={readyToSend ? 'default' : 'outline'}
          onClick={() => setShowSendDialog(true)}
          disabled={!stats || stats.total_leads === 0}
          className={readyToSend ? 'bg-orange-500 hover:bg-orange-600' : ''}
        >
          <Send className="h-4 w-4 mr-2" />
          Send to Instantly
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Campaign Leads</CardTitle>
              <CardDescription>
                {filteredLeads.length} of {leads.length} leads
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={expandAllLeads}
                disabled={expandedLeads.size === filteredLeads.length}
              >
                <ChevronDown className="h-4 w-4 mr-1" />
                Expand All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={collapseAllLeads}
                disabled={expandedLeads.size === 0}
              >
                <ChevronRight className="h-4 w-4 mr-1" />
                Collapse All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No leads found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <>
                      <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleLeadExpanded(lead.id)}>
                        <TableCell className="p-2">
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {expandedLeads.has(lead.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="font-medium">
                              {lead.first_name || 'Unknown'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{lead.company_name || '-'}</span>
                            {lead.website && (
                              <a
                                href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-400"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Globe className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {lead.email_address ? (
                            <span className="text-green-500">{lead.email_address}</span>
                          ) : (
                            <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {lead.subject_line ? (
                            <span className="truncate block" title={lead.subject_line}>
                              {lead.subject_line}
                            </span>
                          ) : (
                            <Badge variant="outline" className="text-purple-500 border-purple-500/50">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Not generated
                            </Badge>
                          )}
                        </TableCell>
                      <TableCell>
                        {lead.instantly_status === 'synced' ? (
                          <Badge className="bg-green-500/10 text-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Synced
                          </Badge>
                        ) : lead.instantly_status === 'sent' ? (
                          <Badge className="bg-blue-500/10 text-blue-500">
                            <Send className="h-3 w-3 mr-1" />
                            Sent
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedLead(lead)}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {!lead.email_address && lead.website && lead.first_name && (
                                <DropdownMenuItem onClick={() => handleFindSingleEmail(lead)}>
                                  <Search className="h-4 w-4 mr-2" />
                                  Find Email
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleRegenerateSubject(lead)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Regenerate Subject
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setLeadToDelete(lead)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove Lead
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {/* Expandable Email Body Row */}
                      {expandedLeads.has(lead.id) && (
                        <TableRow key={`${lead.id}-expanded`} className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={7} className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <FileText className="h-4 w-4 text-orange-500" />
                                Email Body
                              </div>
                              <div className="p-4 bg-background rounded-lg border text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                                {lead.email_body}
                              </div>
                              {lead.subject_line && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Sparkles className="h-3 w-3" />
                                  <span className="font-medium">Subject:</span>
                                  {lead.subject_line}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedLead?.first_name || 'Lead'} @ {selectedLead?.company_name || 'Unknown Company'}
            </DialogTitle>
            <DialogDescription>
              {selectedLead?.website && (
                <a
                  href={selectedLead.website.startsWith('http') ? selectedLead.website : `https://${selectedLead.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {selectedLead.website}
                </a>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              {/* Email Status */}
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Email:</span>
                {selectedLead.email_address ? (
                  <span className="text-green-500">{selectedLead.email_address}</span>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </div>

              {/* Subject Line */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="font-medium">Subject Line:</span>
                </div>
                {selectedLead.subject_line ? (
                  <p className="p-3 bg-muted rounded-lg">{selectedLead.subject_line}</p>
                ) : (
                  <p className="text-muted-foreground italic">Not generated yet</p>
                )}
              </div>

              {/* Email Body */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-orange-500" />
                  <span className="font-medium">Email Body:</span>
                </div>
                <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm max-h-[300px] overflow-y-auto">
                  {selectedLead.email_body}
                </div>
              </div>

              {/* Additional Info */}
              {(selectedLead.opening_line || selectedLead.website_analysis) && (
                <div className="border-t pt-4">
                  <p className="font-medium mb-2">Additional Data:</p>
                  {selectedLead.opening_line && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Opening:</strong> {selectedLead.opening_line}
                    </p>
                  )}
                  {selectedLead.website_analysis && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Analysis:</strong> {selectedLead.website_analysis}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLead(null)}>
              Close
            </Button>
            {selectedLead && (
              <Button onClick={() => handleRegenerateSubject(selectedLead)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate Subject
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Instantly Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Instantly</DialogTitle>
            <DialogDescription>
              Review before syncing this campaign to Instantly
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Checklist */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {stats && stats.emails_found > 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                <span>
                  <strong>{stats?.emails_found || 0}</strong> email addresses found
                </span>
              </div>

              <div className="flex items-center gap-3">
                {stats && stats.subjects_pending === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                )}
                <span>
                  <strong>{stats?.subjects_generated || 0}</strong> subject lines generated
                  {stats && stats.subjects_pending > 0 && (
                    <span className="text-yellow-500"> ({stats.subjects_pending} pending)</span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>
                  <strong>{stats?.ready_to_send || 0}</strong> leads ready to send
                </span>
              </div>
            </div>

            {!readyToSend && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
                <p className="text-yellow-500 font-medium">Not ready to send</p>
                <p className="text-muted-foreground mt-1">
                  {stats?.emails_found === 0 && 'Find email addresses first. '}
                  {stats && stats.subjects_pending > 0 && 'Generate all subject lines first.'}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSyncToInstantly}
              disabled={!readyToSend || syncingToInstantly}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {syncingToInstantly ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send to Instantly
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Lead Confirmation Dialog */}
      <Dialog open={!!leadToDelete} onOpenChange={() => setLeadToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Lead from Campaign?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The lead will be permanently removed from this campaign.
            </DialogDescription>
          </DialogHeader>

          {leadToDelete && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{leadToDelete.first_name || 'Unknown'}</span>
                </div>
                {leadToDelete.company_name && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{leadToDelete.company_name}</span>
                  </div>
                )}
                {leadToDelete.email_address && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{leadToDelete.email_address}</span>
                  </div>
                )}
              </div>

              {leadToDelete.instantly_status && leadToDelete.instantly_status !== 'pending' && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-yellow-500 font-medium">Lead synced to Instantly</p>
                      <p className="text-muted-foreground mt-1">
                        This lead has been synced to Instantly. You may need to remove it from Instantly separately.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLeadToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteLead}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Remove Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
