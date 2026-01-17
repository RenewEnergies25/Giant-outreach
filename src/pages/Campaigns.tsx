import { useState } from 'react';
import { Plus, Play, Pause, Archive, MoreVertical, Users, MessageSquare, Mail, Phone, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import {
  useCampaigns,
  createCampaign,
  updateCampaignStatus,
  deleteCampaign,
} from '../lib/hooks';
import { Campaign, CampaignStatus, CampaignWithStats } from '../types/database';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const statusColors: Record<CampaignStatus, string> = {
  draft: 'bg-gray-500/10 text-gray-500',
  active: 'bg-green-500/10 text-green-500',
  paused: 'bg-yellow-500/10 text-yellow-500',
  completed: 'bg-blue-500/10 text-blue-500',
  archived: 'bg-red-500/10 text-red-500',
};

const statusLabels: Record<CampaignStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

function CampaignCard({ campaign, onRefresh }: { campaign: CampaignWithStats; onRefresh: () => void }) {
  const stats = campaign.stats;

  const handleStatusChange = async (newStatus: CampaignStatus) => {
    const result = await updateCampaignStatus(campaign.id, newStatus);
    if (result.success) {
      toast.success(`Campaign ${statusLabels[newStatus].toLowerCase()}`);
      onRefresh();
    } else {
      toast.error(result.error || 'Failed to update campaign');
    }
  };

  const handleDelete = async () => {
    const result = await deleteCampaign(campaign.id);
    if (result.success) {
      toast.success('Campaign archived');
      onRefresh();
    } else {
      toast.error(result.error || 'Failed to archive campaign');
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{campaign.name}</CardTitle>
            {campaign.description && (
              <CardDescription className="line-clamp-2">{campaign.description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn('font-medium', statusColors[campaign.status])}>
              {statusLabels[campaign.status]}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {campaign.status === 'draft' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Campaign
                  </DropdownMenuItem>
                )}
                {campaign.status === 'active' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('paused')}>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause Campaign
                  </DropdownMenuItem>
                )}
                {campaign.status === 'paused' && (
                  <>
                    <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                      <Play className="h-4 w-4 mr-2" />
                      Resume Campaign
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('completed')}>
                      Complete Campaign
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Campaign
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Channel badges */}
        <div className="flex gap-2 mb-4">
          {campaign.sms_enabled && (
            <Badge variant="outline" className="text-xs">
              <Phone className="h-3 w-3 mr-1" />
              SMS
            </Badge>
          )}
          {campaign.whatsapp_enabled && (
            <Badge variant="outline" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              WhatsApp
            </Badge>
          )}
          {campaign.email_enabled && (
            <Badge variant="outline" className="text-xs">
              <Mail className="h-3 w-3 mr-1" />
              Email
            </Badge>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{stats?.total_contacts || 0}</p>
            <p className="text-xs text-muted-foreground">Contacts</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats?.in_conversation || 0}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats?.booked || 0}</p>
            <p className="text-xs text-muted-foreground">Booked</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats?.opted_out || 0}</p>
            <p className="text-xs text-muted-foreground">Opted Out</p>
          </div>
        </div>

        {/* Channel breakdown if available */}
        {stats?.channel_breakdown && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">Today's Activity by Channel</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {stats.channel_breakdown.sms && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-blue-500" />
                  <span>{stats.channel_breakdown.sms.sent} sent</span>
                </div>
              )}
              {stats.channel_breakdown.whatsapp && (
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3 text-green-500" />
                  <span>{stats.channel_breakdown.whatsapp.sent} sent</span>
                </div>
              )}
              {stats.channel_breakdown.email && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-orange-500" />
                  <span>{stats.channel_breakdown.email.sent} sent</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateCampaignDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sms_enabled: true,
    whatsapp_enabled: true,
    email_enabled: true,
    daily_message_limit: 100,
    bump_delay_hours: 24,
    max_bumps: 3,
  });

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }

    setLoading(true);
    const result = await createCampaign(formData);
    setLoading(false);

    if (result.success) {
      toast.success('Campaign created successfully');
      setOpen(false);
      setFormData({
        name: '',
        description: '',
        sms_enabled: true,
        whatsapp_enabled: true,
        email_enabled: true,
        daily_message_limit: 100,
        bump_delay_hours: 24,
        max_bumps: 3,
      });
      onCreated();
    } else {
      toast.error(result.error || 'Failed to create campaign');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Set up a new outreach campaign with multiple channels.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              placeholder="e.g., Q1 Lead Reactivation"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the campaign purpose..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="space-y-3">
            <Label>Channels</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">SMS</span>
                </div>
                <Switch
                  checked={formData.sms_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, sms_enabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-500" />
                  <span className="text-sm">WhatsApp</span>
                </div>
                <Switch
                  checked={formData.whatsapp_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, whatsapp_enabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Email</span>
                </div>
                <Switch
                  checked={formData.email_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, email_enabled: checked })}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daily_limit">Daily Limit</Label>
              <Input
                id="daily_limit"
                type="number"
                value={formData.daily_message_limit}
                onChange={(e) => setFormData({ ...formData, daily_message_limit: parseInt(e.target.value) || 100 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bump_delay">Bump Delay (hrs)</Label>
              <Input
                id="bump_delay"
                type="number"
                value={formData.bump_delay_hours}
                onChange={(e) => setFormData({ ...formData, bump_delay_hours: parseInt(e.target.value) || 24 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_bumps">Max Bumps</Label>
              <Input
                id="max_bumps"
                type="number"
                value={formData.max_bumps}
                onChange={(e) => setFormData({ ...formData, max_bumps: parseInt(e.target.value) || 3 })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Campaigns() {
  const [searchQuery, setSearchQuery] = useState('');
  const { campaigns, loading, refetch } = useCampaigns();

  const filteredCampaigns = campaigns.filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      c.description?.toLowerCase().includes(query)
    );
  });

  const activeCampaigns = filteredCampaigns.filter(c => c.status === 'active');
  const draftCampaigns = filteredCampaigns.filter(c => c.status === 'draft');
  const pausedCampaigns = filteredCampaigns.filter(c => c.status === 'paused');
  const completedCampaigns = filteredCampaigns.filter(c => c.status === 'completed');

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Manage multi-channel outreach campaigns
          </p>
        </div>
        <CreateCampaignDialog onCreated={refetch} />
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading campaigns...</div>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <Card className="flex flex-col items-center justify-center h-64">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create your first campaign to start reaching out
          </p>
          <CreateCampaignDialog onCreated={refetch} />
        </Card>
      ) : (
        <div className="space-y-8">
          {activeCampaigns.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                Active Campaigns ({activeCampaigns.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeCampaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} onRefresh={refetch} />
                ))}
              </div>
            </div>
          )}

          {draftCampaigns.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-gray-500" />
                Draft Campaigns ({draftCampaigns.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {draftCampaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} onRefresh={refetch} />
                ))}
              </div>
            </div>
          )}

          {pausedCampaigns.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                Paused Campaigns ({pausedCampaigns.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pausedCampaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} onRefresh={refetch} />
                ))}
              </div>
            </div>
          )}

          {completedCampaigns.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                Completed Campaigns ({completedCampaigns.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedCampaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} onRefresh={refetch} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
