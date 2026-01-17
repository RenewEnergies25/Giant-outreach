import { useState } from 'react';
import { subDays } from 'date-fns';
import { useMetrics } from '../lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Button } from '../components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

export function Analytics() {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const { metrics, loading } = useMetrics(startDate, endDate);

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

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Performance metrics and insights
          </p>
        </div>

        <div className="flex gap-2">
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

      {/* Conversion Chart */}
      <div className="grid gap-6 mb-8">
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
      </div>

      <div className="grid gap-6 mb-8">
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
      </div>
    </div>
  );
}
