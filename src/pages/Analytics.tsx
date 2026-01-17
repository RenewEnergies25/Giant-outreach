import { useState } from 'react';
import { subDays } from 'date-fns';
import { useMetrics, useCampaigns, useCampaignMetrics } from '../lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Button } from '../components/ui/button';
import { CalendarIcon, Phone, MessageSquare, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const CHANNEL_COLORS = {
  sms: '#3b82f6',
  whatsapp: '#22c55e',
  email: '#f97316',
};

export function Analytics() {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const { metrics, loading } = useMetrics(startDate, endDate);
  const { campaigns } = useCampaigns();
  const { metrics: campaignMetrics, loading: campaignMetricsLoading } = useCampaignMetrics(
    selectedCampaignId,
    startDate,
    endDate
  );

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

      {/* Overall Metrics */}
      <Tabs defaultValue="overview" className="mb-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="conversions">Conversions</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
