import { useState } from 'react';
import { Plus, Play, Pause, Archive, MoreVertical, Users, MessageSquare, Mail, Phone, Search, Video, Trash2, ExternalLink, CloudUpload, RefreshCw, Loader2, Zap } from 'lucide-react';
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
  syncToInstantly,
  InstantlySyncAction,
} from '../lib/hooks';
import { Campaign, CampaignStatus, CampaignWithStats, CampaignVSL } from '../types/database';
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
  const [syncing, setSyncing] = useState(false);

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

  const handleInstantlySync = async (action: InstantlySyncAction) => {
    setSyncing(true);
    const result = await syncToInstantly(campaign.id, action);
    setSyncing(false);

    if (result.success) {
      if (action === 'full_sync' || action === 'create') {
        toast.success(`Campaign synced to Instantly! ${result.leads_added || 0} leads added.`);
      } else if (action === 'sync_leads') {
        toast.success(`${result.leads_added || 0} leads synced to Instantly`);
      } else if (action === 'activate') {
        toast.success('Campaign activated in Instantly');
      } else if (action === 'pause') {
        toast.success('Campaign paused in Instantly');
      }
      onRefresh();
    } else {
      toast.error(result.error || 'Failed to sync with Instantly');
    }
  };

  const instantlyStatus = (campaign as Record<string, unknown>).instantly_status as string | undefined;
  const instantlyCampaignId = (campaign as Record<string, unknown>).instantly_campaign_id as string | undefined;

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
            {instantlyCampaignId && (
              <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20">
                <Zap className="h-3 w-3 mr-1" />
                {instantlyStatus || 'synced'}
              </Badge>
            )}
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
                {/* Instantly Sync Options */}
                {campaign.email_enabled && (
                  <>
                    {!instantlyCampaignId ? (
                      <DropdownMenuItem onClick={() => handleInstantlySync('full_sync')} disabled={syncing}>
                        {syncing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CloudUpload className="h-4 w-4 mr-2" />
                        )}
                        Sync to Instantly
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => handleInstantlySync('sync_leads')} disabled={syncing}>
                          {syncing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Sync Leads
                        </DropdownMenuItem>
                        {instantlyStatus !== 'active' && (
                          <DropdownMenuItem onClick={() => handleInstantlySync('activate')} disabled={syncing}>
                            <Zap className="h-4 w-4 mr-2" />
                            Activate in Instantly
                          </DropdownMenuItem>
                        )}
                        {instantlyStatus === 'active' && (
                          <DropdownMenuItem onClick={() => handleInstantlySync('pause')} disabled={syncing}>
                            <Pause className="h-4 w-4 mr-2" />
                            Pause in Instantly
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    <DropdownMenuSeparator />
                  </>
                )}
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
        <div className="flex flex-wrap gap-2 mb-4">
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
          {(campaign.vsl_url || (campaign.vsls && campaign.vsls.length > 0)) && (
            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
              <Video className="h-3 w-3 mr-1" />
              {campaign.vsls && campaign.vsls.length > 1
                ? `${campaign.vsls.length} VSLs`
                : 'VSL'}
            </Badge>
          )}
        </div>

        {/* VSL Preview */}
        {campaign.vsl_url && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Video className="h-4 w-4 text-purple-500" />
              <span className="font-medium truncate flex-1">
                {campaign.vsl_title || 'Video Sales Letter'}
              </span>
              <a
                href={campaign.vsl_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-500 hover:text-purple-400"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}

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
    vsl_url: '',
    vsl_title: '',
    vsls: [] as CampaignVSL[],
  });
  const [newVslUrl, setNewVslUrl] = useState('');
  const [newVslTitle, setNewVslTitle] = useState('');

  const addVsl = () => {
    if (!newVslUrl.trim()) {
      toast.error('VSL URL is required');
      return;
    }
    setFormData({
      ...formData,
      vsls: [...formData.vsls, { url: newVslUrl.trim(), title: newVslTitle.trim() || undefined }],
    });
    setNewVslUrl('');
    setNewVslTitle('');
  };

  const removeVsl = (index: number) => {
    setFormData({
      ...formData,
      vsls: formData.vsls.filter((_, i) => i !== index),
    });
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }

    setLoading(true);
    const result = await createCampaign({
      ...formData,
      vsl_url: formData.vsl_url.trim() || null,
      vsl_title: formData.vsl_title.trim() || null,
    });
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
        vsl_url: '',
        vsl_title: '',
        vsls: [],
      });
      setNewVslUrl('');
      setNewVslTitle('');
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Set up a new outreach campaign with multiple channels and VSLs.
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

          {/* VSL Section */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-purple-500" />
              <Label>Video Sales Letters (VSLs)</Label>
            </div>

            {/* Primary VSL */}
            <div className="space-y-2">
              <Label htmlFor="vsl_url" className="text-xs text-muted-foreground">Primary VSL URL</Label>
              <Input
                id="vsl_url"
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                value={formData.vsl_url}
                onChange={(e) => setFormData({ ...formData, vsl_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vsl_title" className="text-xs text-muted-foreground">VSL Title (optional)</Label>
              <Input
                id="vsl_title"
                placeholder="e.g., Introduction Video"
                value={formData.vsl_title}
                onChange={(e) => setFormData({ ...formData, vsl_title: e.target.value })}
              />
            </div>

            {/* Additional VSLs */}
            {formData.vsls.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Additional VSLs</Label>
                {formData.vsls.map((vsl, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <Video className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{vsl.title || 'Untitled VSL'}</p>
                      <p className="text-xs text-muted-foreground truncate">{vsl.url}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => removeVsl(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new VSL */}
            <div className="space-y-2 p-3 border border-dashed rounded-lg">
              <Label className="text-xs text-muted-foreground">Add Another VSL</Label>
              <Input
                placeholder="VSL URL"
                value={newVslUrl}
                onChange={(e) => setNewVslUrl(e.target.value)}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Title (optional)"
                  value={newVslTitle}
                  onChange={(e) => setNewVslTitle(e.target.value)}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={addVsl}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
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
