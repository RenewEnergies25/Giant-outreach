import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, Mail, Eye, MousePointer, Reply, AlertTriangle, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface CampaignAnalytics {
  sent: number;
  delivered: number;
  opened: number;
  opened_unique: number;
  clicked: number;
  clicked_unique: number;
  replied: number;
  replied_unique: number;
  bounced: number;
  opportunities: number;
  opportunities_unique: number;
}

interface CampaignStatsProps {
  campaignId: string;
  instantlyCampaignId?: string | null;
}

export function CampaignStats({ campaignId, instantlyCampaignId }: CampaignStatsProps) {
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (instantlyCampaignId) {
      fetchAnalytics();
    }
  }, [instantlyCampaignId]);

  const fetchAnalytics = async () => {
    if (!instantlyCampaignId) {
      toast.error('Campaign not synced to Instantly yet');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-campaign-analytics`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ campaign_id: campaignId }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch analytics');
      }

      setAnalytics(result.analytics);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      toast.error(error.message || 'Failed to fetch campaign analytics');
    } finally {
      setLoading(false);
    }
  };

  if (!instantlyCampaignId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign Analytics</CardTitle>
          <CardDescription>
            Sync your campaign to Instantly to view analytics
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const calculateRate = (numerator: number, denominator: number) => {
    if (denominator === 0) return '0.0';
    return ((numerator / denominator) * 100).toFixed(1);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Campaign Analytics
            </CardTitle>
            <CardDescription>
              {lastUpdated
                ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
                : 'Real-time campaign performance metrics'}
            </CardDescription>
          </div>
          <Button
            onClick={fetchAnalytics}
            disabled={loading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!analytics && !loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Click "Refresh" to load analytics</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Sent */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Sent</span>
              </div>
              <p className="text-2xl font-bold">{analytics?.sent || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics?.delivered || 0} delivered
              </p>
            </div>

            {/* Opened */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Opened</span>
              </div>
              <p className="text-2xl font-bold">{analytics?.opened_unique || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics?.sent ? calculateRate(analytics.opened_unique, analytics.sent) : '0'}% open rate
              </p>
            </div>

            {/* Clicked */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <MousePointer className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Clicked</span>
              </div>
              <p className="text-2xl font-bold">{analytics?.clicked_unique || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics?.sent ? calculateRate(analytics.clicked_unique, analytics.sent) : '0'}% click rate
              </p>
            </div>

            {/* Replied */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Reply className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Replied</span>
              </div>
              <p className="text-2xl font-bold">{analytics?.replied_unique || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics?.sent ? calculateRate(analytics.replied_unique, analytics.sent) : '0'}% reply rate
              </p>
            </div>

            {/* Bounced */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">Bounced</span>
              </div>
              <p className="text-2xl font-bold">{analytics?.bounced || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics?.sent ? calculateRate(analytics.bounced, analytics.sent) : '0'}% bounce rate
              </p>
            </div>

            {/* Opportunities */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Opportunities</span>
              </div>
              <p className="text-2xl font-bold">{analytics?.opportunities_unique || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Qualified leads
              </p>
            </div>

            {/* Total Opens (with repeats) */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-green-400 opacity-60" />
                <span className="text-sm font-medium">Total Opens</span>
              </div>
              <p className="text-2xl font-bold">{analytics?.opened || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Including repeats
              </p>
            </div>

            {/* Total Clicks (with repeats) */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <MousePointer className="h-4 w-4 text-purple-400 opacity-60" />
                <span className="text-sm font-medium">Total Clicks</span>
              </div>
              <p className="text-2xl font-bold">{analytics?.clicked || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Including repeats
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
