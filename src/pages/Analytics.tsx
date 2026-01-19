import { useState, useEffect } from 'react';
import { subDays } from 'date-fns';
import { useMetrics, useCampaigns, useCampaignMetrics } from '../lib/hooks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Button } from '../components/ui/button';
import { CalendarIcon, Phone, MessageSquare, Mail, Users, Search, Sparkles, Zap, TrendingUp, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { supabase } from '../lib/supabase';
import { CampaignLeadStats } from '../types/database';

const CHANNEL_COLORS = {
  sms: '#3b82f6',
  whatsapp: '#22c55e',
  email: '#f97316',
};

interface CampaignWithEmailStats {
  id: string;
  name: string;
  status: string;
  email_enabled: boolean;
  created_at: string;
  leadStats: CampaignLeadStats | null;
}

export function Analytics() {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignEmailStats, setCampaignEmailStats] = useState<CampaignWithEmailStats[]>([]);
  const [loadingEmailStats, setLoadingEmailStats] = useState(true);

  const { metrics, loading } = useMetrics(startDate, endDate);
  const { campaigns } = useCampaigns();
  const { metrics: campaignMetrics, loading: campaignMetricsLoading } = useCampaignMetrics(
    selectedCampaignId,
    startDate,
    endDate
  );

  // Fetch email campaign stats
  useEffect(() => {
    async function fetchEmailCampaignStats() {
      setLoadingEmailStats(true);
      try {
        // Get all campaigns with email enabled
        const { data: campaignsData, error: campaignsError } = await supabase
          .from('campaigns')
          .select('id, name, status, email_enabled, created_at')
          .eq('email_enabled', true)
          .order('created_at', { ascending: false });

        if (campaignsError) throw campaignsError;

        // Fetch lead stats for each campaign
        const statsPromises = (campaignsData || []).map(async (campaign) => {
          const { data: statsData } = await supabase
            .rpc('get_campaign_lead_stats', { p_campaign_id: campaign.id });

          return {
            ...campaign,
            leadStats: statsData as CampaignLeadStats | null,
          };
        });

        const campaignsWithStats = await Promise.all(statsPromises);
        setCampaignEmailStats(campaignsWithStats);
      } catch (err) {
        console.error('Failed to fetch email campaign stats:', err);
      } finally {
        setLoadingEmailStats(false);
      }
    }

    fetchEmailCampaignStats();
  }, []);

  // Calculate aggregate email campaign KPIs
  const totalEmailLeads = campaignEmailStats.reduce((sum, c) => sum + (c.leadStats?.total_leads || 0), 0);
  const totalEmailsFound = campaignEmailStats.reduce((sum, c) => sum + (c.leadStats?.emails_found || 0), 0);
  const totalSubjectsGenerated = campaignEmailStats.reduce((sum, c) => sum + (c.leadStats?.subjects_generated || 0), 0);
  const totalSyncedToInstantly = campaignEmailStats.reduce((sum, c) => sum + (c.leadStats?.synced_to_instantly || 0), 0);
  const totalReadyToSend = campaignEmailStats.reduce((sum, c) => sum + (c.leadStats?.ready_to_send || 0), 0);

  const emailFindRate = totalEmailLeads > 0 ? ((totalEmailsFound / totalEmailLeads) * 100).toFixed(1) : '0';

  const messageData = metrics.map(m => ({
    date: format(new Date(m.date), 'MMM dd'),
    sent: m.messages_sent || 0,
    received: m.messages_received || 0,
  }));

  const conversionData = metrics.map(m => ({
    date: format(new Date(m.date), 'MMM dd'),
    calendarLinks: m.calendar_links_sent || 0,
    bookings: m.bookings || 0,
  }));

  // Conversion metrics
  const totalCalendarLinksSent = metrics.reduce((sum, m) => sum + (m.calendar_links_sent || 0), 0);
  const totalBookings = metrics.reduce((sum, m) => sum + (m.bookings || 0), 0);
  const conversionRate = totalCalendarLinksSent > 0
    ? ((totalBookings / totalCalendarLinksSent) * 100).toFixed(1)
    : '0';

  // Message metrics
  const totalMessages = metrics.reduce((sum, m) => sum + (m.messages_sent || 0) + (m.messages_received || 0), 0);
  const avgMessagesPerDay = metrics.length > 0 ? Math.round(totalMessages / metrics.length) : 0;

  // Campaign channel breakdown
  const channelData = campaignMetrics.reduce((acc, m) => {
    if (m.channel !== 'all') {
      if (!acc[m.channel]) {
        acc[m.channel] = { sent: 0, received: 0, bookings: 0, optOuts: 0 };
      }
      acc[m.channel].sent += m.messages_sent || 0;
      acc[m.channel].received += m.messages_received || 0;
      acc[m.channel].bookings += m.bookings || 0;
      acc[m.channel].optOuts += m.opt_outs || 0;
    }
    return acc;
  }, {} as Record<string, { sent: number; received: number; bookings: number; optOuts: number }>);

  const channelPieData = Object.entries(channelData).map(([channel, data]) => ({
    name: channel.toUpperCase(),
    value: data.sent + data.received,
    color: CHANNEL_COLORS[channel as keyof typeof CHANNEL_COLORS],
  }));

  const channelBarData = Object.entries(channelData).map(([channel, data]) => ({
    channel: channel.toUpperCase(),
    sent: data.sent,
    received: data.received,
    bookings: data.bookings,
  }));

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Performance metrics and channel insights
          </p>
        </div>

        <div className="flex gap-2 items-center">
          <Select
            value={selectedCampaignId || 'all'}
            onValueChange={(value) => setSelectedCampaignId(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(startDate, 'MMM dd, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && setStartDate(date)}
              />
            </PopoverContent>
          </Popover>

          <span className="flex items-center text-muted-foreground">to</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(endDate, 'MMM dd, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => date && setEndDate(date)}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Conversion Metrics Row */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Bookings (Conversions)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{totalBookings}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Calendar Links Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCalendarLinksSent}</div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Bookings / Calendar Links
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Message Metrics Row */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Messages/Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgMessagesPerDay}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMessages}</div>
          </CardContent>
        </Card>
      </div>

      {/* Channel Performance Section */}
      {selectedCampaignId && channelBarData.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Channel Performance</h2>
          <div className="grid gap-6 md:grid-cols-3 mb-6">
            <Card className="border-blue-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-500" />
                  SMS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{channelData.sms?.sent || 0}</div>
                <p className="text-xs text-muted-foreground">messages sent</p>
                <div className="mt-2 text-sm">
                  <span className="text-green-500">{channelData.sms?.bookings || 0} bookings</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-500" />
                  WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{channelData.whatsapp?.sent || 0}</div>
                <p className="text-xs text-muted-foreground">messages sent</p>
                <div className="mt-2 text-sm">
                  <span className="text-green-500">{channelData.whatsapp?.bookings || 0} bookings</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4 text-orange-500" />
                  Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{channelData.email?.sent || 0}</div>
                <p className="text-xs text-muted-foreground">messages sent</p>
                <div className="mt-2 text-sm">
                  <span className="text-green-500">{channelData.email?.bookings || 0} bookings</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Messages by Channel</CardTitle>
              </CardHeader>
              <CardContent>
                {campaignMetricsLoading ? (
                  <div className="h-[250px] bg-muted animate-pulse rounded" />
                ) : channelBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={channelBarData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="channel" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                      <Legend />
                      <Bar dataKey="sent" name="Sent" fill="#3b82f6" />
                      <Bar dataKey="received" name="Received" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No channel data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Channel Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {campaignMetricsLoading ? (
                  <div className="h-[250px] bg-muted animate-pulse rounded" />
                ) : channelPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={channelPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {channelPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No channel data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Email Campaign KPIs Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5 text-orange-500" />
          Email Campaign KPIs
        </h2>

        {/* Aggregate Email KPIs */}
        <div className="grid gap-4 md:grid-cols-5 mb-6">
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Total Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{totalEmailLeads}</div>
              <p className="text-xs text-muted-foreground">Across all campaigns</p>
            </CardContent>
          </Card>

          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Search className="h-4 w-4 text-green-500" />
                Emails Found
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{totalEmailsFound}</div>
              <p className="text-xs text-muted-foreground">{emailFindRate}% find rate</p>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-purple-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Subjects Generated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-500">{totalSubjectsGenerated}</div>
              <p className="text-xs text-muted-foreground">AI-generated</p>
            </CardContent>
          </Card>

          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-orange-500" />
                Synced to Instantly
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{totalSyncedToInstantly}</div>
              <p className="text-xs text-muted-foreground">Ready for sending</p>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/20 bg-cyan-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-cyan-500" />
                Ready to Send
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-500">{totalReadyToSend}</div>
              <p className="text-xs text-muted-foreground">Pending sync</p>
            </CardContent>
          </Card>
        </div>

        {/* Per-Campaign Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Breakdown</CardTitle>
            <CardDescription>Email campaign performance by individual campaign</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingEmailStats ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : campaignEmailStats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No email campaigns found</p>
                <p className="text-sm">Create a campaign with email enabled to see stats here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {campaignEmailStats.map((campaign) => {
                  const stats = campaign.leadStats;
                  const emailProgress = stats && stats.total_leads > 0
                    ? (stats.emails_found / stats.total_leads) * 100
                    : 0;
                  const subjectProgress = stats && stats.total_leads > 0
                    ? (stats.subjects_generated / stats.total_leads) * 100
                    : 0;
                  const syncProgress = stats && stats.total_leads > 0
                    ? (stats.synced_to_instantly / stats.total_leads) * 100
                    : 0;

                  return (
                    <div
                      key={campaign.id}
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                            <Mail className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <h4 className="font-medium">{campaign.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              Created {format(new Date(campaign.created_at), 'MMM dd, yyyy')}
                            </p>
                          </div>
                        </div>
                        <Badge
                          className={
                            campaign.status === 'active'
                              ? 'bg-green-500/10 text-green-500'
                              : campaign.status === 'draft'
                              ? 'bg-gray-500/10 text-gray-500'
                              : 'bg-yellow-500/10 text-yellow-500'
                          }
                        >
                          {campaign.status}
                        </Badge>
                      </div>

                      {stats ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Leads</span>
                              <span className="font-medium">{stats.total_leads}</span>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Search className="h-3 w-3" /> Emails
                              </span>
                              <span className="font-medium text-green-500">
                                {stats.emails_found}/{stats.total_leads}
                              </span>
                            </div>
                            <Progress value={emailProgress} className="h-1.5" />
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> Subjects
                              </span>
                              <span className="font-medium text-purple-500">
                                {stats.subjects_generated}/{stats.total_leads}
                              </span>
                            </div>
                            <Progress value={subjectProgress} className="h-1.5" />
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Zap className="h-3 w-3" /> Synced
                              </span>
                              <span className="font-medium text-orange-500">
                                {stats.synced_to_instantly}/{stats.total_leads}
                              </span>
                            </div>
                            <Progress value={syncProgress} className="h-1.5" />
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No lead data available</div>
                      )}

                      {stats && stats.ready_to_send > 0 && (
                        <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-green-500 font-medium">{stats.ready_to_send} leads ready to send</span>
                        </div>
                      )}

                      {stats && stats.emails_pending > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-yellow-500" />
                          <span className="text-yellow-500">{stats.emails_pending} emails pending</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overall Metrics */}
      <Tabs defaultValue="overview" className="mb-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="conversions">Conversions</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="email-campaigns">Email Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Conversion Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Conversions Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] bg-muted animate-pulse rounded" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={conversionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Bar dataKey="calendarLinks" name="Calendar Links Sent" fill="#6366f1" />
                    <Bar dataKey="bookings" name="Bookings" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Messages Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] bg-muted animate-pulse rounded" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={messageData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Line type="monotone" dataKey="sent" name="Sent" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="received" name="Received" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversions">
          <Card>
            <CardHeader>
              <CardTitle>Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[400px] bg-muted animate-pulse rounded" />
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={conversionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Bar dataKey="calendarLinks" name="Calendar Links Sent" fill="#6366f1" />
                    <Bar dataKey="bookings" name="Bookings" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Message Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[400px] bg-muted animate-pulse rounded" />
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={messageData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Line type="monotone" dataKey="sent" name="Sent" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="received" name="Received" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-campaigns" className="space-y-6">
          {/* Email Campaign Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Progress Comparison</CardTitle>
              <CardDescription>Email finding and subject generation progress across campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEmailStats ? (
                <div className="h-[350px] bg-muted animate-pulse rounded" />
              ) : campaignEmailStats.length === 0 ? (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No email campaigns to display</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={campaignEmailStats.map((c) => ({
                      name: c.name.length > 15 ? c.name.slice(0, 15) + '...' : c.name,
                      'Total Leads': c.leadStats?.total_leads || 0,
                      'Emails Found': c.leadStats?.emails_found || 0,
                      'Subjects Generated': c.leadStats?.subjects_generated || 0,
                      'Synced': c.leadStats?.synced_to_instantly || 0,
                    }))}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Bar dataKey="Total Leads" fill="#3b82f6" />
                    <Bar dataKey="Emails Found" fill="#22c55e" />
                    <Bar dataKey="Subjects Generated" fill="#a855f7" />
                    <Bar dataKey="Synced" fill="#f97316" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Email Funnel Visualization */}
          <Card>
            <CardHeader>
              <CardTitle>Email Campaign Funnel</CardTitle>
              <CardDescription>Overall pipeline from leads to ready-to-send</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEmailStats ? (
                <div className="h-[200px] bg-muted animate-pulse rounded" />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      Total Leads
                    </div>
                    <div className="flex-1">
                      <div className="h-8 bg-blue-500 rounded flex items-center justify-end pr-3">
                        <span className="text-sm font-bold text-white">{totalEmailLeads}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium flex items-center gap-2">
                      <Search className="h-4 w-4 text-green-500" />
                      Emails Found
                    </div>
                    <div className="flex-1">
                      <div
                        className="h-8 bg-green-500 rounded flex items-center justify-end pr-3"
                        style={{ width: `${totalEmailLeads > 0 ? (totalEmailsFound / totalEmailLeads) * 100 : 0}%`, minWidth: totalEmailsFound > 0 ? '60px' : '0px' }}
                      >
                        <span className="text-sm font-bold text-white">{totalEmailsFound}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      Subjects Done
                    </div>
                    <div className="flex-1">
                      <div
                        className="h-8 bg-purple-500 rounded flex items-center justify-end pr-3"
                        style={{ width: `${totalEmailLeads > 0 ? (totalSubjectsGenerated / totalEmailLeads) * 100 : 0}%`, minWidth: totalSubjectsGenerated > 0 ? '60px' : '0px' }}
                      >
                        <span className="text-sm font-bold text-white">{totalSubjectsGenerated}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4 text-orange-500" />
                      Synced
                    </div>
                    <div className="flex-1">
                      <div
                        className="h-8 bg-orange-500 rounded flex items-center justify-end pr-3"
                        style={{ width: `${totalEmailLeads > 0 ? (totalSyncedToInstantly / totalEmailLeads) * 100 : 0}%`, minWidth: totalSyncedToInstantly > 0 ? '60px' : '0px' }}
                      >
                        <span className="text-sm font-bold text-white">{totalSyncedToInstantly}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-cyan-500" />
                      Ready to Send
                    </div>
                    <div className="flex-1">
                      <div
                        className="h-8 bg-cyan-500 rounded flex items-center justify-end pr-3"
                        style={{ width: `${totalEmailLeads > 0 ? (totalReadyToSend / totalEmailLeads) * 100 : 0}%`, minWidth: totalReadyToSend > 0 ? '60px' : '0px' }}
                      >
                        <span className="text-sm font-bold text-white">{totalReadyToSend}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Individual Campaign Stats Table */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>Detailed statistics for each email campaign</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEmailStats ? (
                <div className="h-[200px] bg-muted animate-pulse rounded" />
              ) : campaignEmailStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No email campaigns found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Campaign</th>
                        <th className="text-center py-3 px-2 font-medium">Status</th>
                        <th className="text-right py-3 px-2 font-medium">Leads</th>
                        <th className="text-right py-3 px-2 font-medium">Emails</th>
                        <th className="text-right py-3 px-2 font-medium">Subjects</th>
                        <th className="text-right py-3 px-2 font-medium">Synced</th>
                        <th className="text-right py-3 px-2 font-medium">Ready</th>
                        <th className="text-right py-3 px-2 font-medium">Completion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignEmailStats.map((campaign) => {
                        const stats = campaign.leadStats;
                        const completionRate = stats && stats.total_leads > 0
                          ? ((stats.emails_found + stats.subjects_generated) / (stats.total_leads * 2)) * 100
                          : 0;

                        return (
                          <tr key={campaign.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-orange-500" />
                                <span className="font-medium">{campaign.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <Badge
                                variant="outline"
                                className={
                                  campaign.status === 'active'
                                    ? 'border-green-500 text-green-500'
                                    : campaign.status === 'draft'
                                    ? 'border-gray-500 text-gray-500'
                                    : 'border-yellow-500 text-yellow-500'
                                }
                              >
                                {campaign.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-right font-mono">{stats?.total_leads || 0}</td>
                            <td className="py-3 px-2 text-right">
                              <span className="font-mono text-green-500">{stats?.emails_found || 0}</span>
                              <span className="text-muted-foreground">/{stats?.total_leads || 0}</span>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <span className="font-mono text-purple-500">{stats?.subjects_generated || 0}</span>
                              <span className="text-muted-foreground">/{stats?.total_leads || 0}</span>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <span className="font-mono text-orange-500">{stats?.synced_to_instantly || 0}</span>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <span className="font-mono text-cyan-500">{stats?.ready_to_send || 0}</span>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <Progress value={completionRate} className="w-16 h-2" />
                                <span className="font-mono text-xs w-10">{completionRate.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
