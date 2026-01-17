import { MessageSquare, TrendingUp, Users, PhoneCall, Calendar, AlertCircle, Megaphone } from 'lucide-react';
import { StatsCard } from '../components/StatsCard';
import { ActivityFeed } from '../components/ActivityFeed';
import { useEnhancedDashboardStats } from '../lib/hooks';

export function Dashboard() {
  const { stats, loading } = useEnhancedDashboardStats();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Monitor multi-channel outreach campaigns in real-time
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatsCard
          title="Active Campaigns"
          value={loading ? '-' : stats.active_campaigns}
          icon={Megaphone}
        />
        <StatsCard
          title="Total Contacts"
          value={loading ? '-' : stats.total_contacts}
          icon={PhoneCall}
        />
        <StatsCard
          title="Active Conversations"
          value={loading ? '-' : stats.active_conversations}
          icon={MessageSquare}
        />
        <StatsCard
          title="Calendar Links Sent"
          value={loading ? '-' : stats.calendar_links_sent}
          icon={Calendar}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatsCard
          title="Qualified (Booked)"
          value={loading ? '-' : stats.qualified_pending}
          icon={Users}
        />
        <StatsCard
          title="Needs Review"
          value={loading ? '-' : stats.needs_review_pending}
          icon={AlertCircle}
        />
        <StatsCard
          title="Messages Today"
          value={loading ? '-' : stats.messages_today}
          icon={MessageSquare}
        />
        <StatsCard
          title="Bookings Today"
          value={loading ? '-' : stats.bookings_today}
          icon={TrendingUp}
        />
      </div>

      <ActivityFeed />
    </div>
  );
}
