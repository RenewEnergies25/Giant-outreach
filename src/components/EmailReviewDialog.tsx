import { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  RotateCcw,
  AlertCircle,
  FileText,
  User as UserIcon,
  Search,
  X,
  Loader2,
  Inbox,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Checkbox } from './ui/checkbox';
import { CampaignLead } from '../types/database';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface EmailReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  onReviewComplete: () => void;
}

export function EmailReviewDialog({
  open,
  onOpenChange,
  campaignId,
  onReviewComplete,
}: EmailReviewDialogProps) {
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      fetchReviewedLeads();
    }
  }, [open, campaignId]);

  const fetchReviewedLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaign_leads')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('is_reviewed', true)
        .order('review_status', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error('Failed to fetch reviewed leads:', err);
      toast.error('Failed to load review results');
    } finally {
      setLoading(false);
    }
  };

  const invalidLeads = useMemo(() => leads.filter(l => l.review_status === 'invalid'), [leads]);
  const validLeads = useMemo(() => leads.filter(l => l.review_status === 'valid'), [leads]);

  const filteredInvalidLeads = useMemo(() => {
    if (!searchQuery.trim()) return invalidLeads;

    const query = searchQuery.toLowerCase();
    return invalidLeads.filter(lead => {
      const contactName = (lead.first_name || '').toLowerCase();
      const companyName = (lead.company_name || '').toLowerCase();
      const emailContent = (lead.email_body || '').toLowerCase();
      const reviewReason = (lead.review_reason || '').toLowerCase();

      return contactName.includes(query) ||
             companyName.includes(query) ||
             emailContent.includes(query) ||
             reviewReason.includes(query);
    });
  }, [invalidLeads, searchQuery]);

  const stats = useMemo(() => ({
    total: leads.length,
    valid: validLeads.length,
    invalid: invalidLeads.length,
    overridden: leads.filter(l => l.review_overridden_by_user).length,
  }), [leads, validLeads, invalidLeads]);

  const invalidSelectionState = useMemo(() => {
    if (filteredInvalidLeads.length === 0) return { checked: false };

    const selectedFilteredCount = filteredInvalidLeads.filter(lead => selectedLeads.has(lead.id)).length;

    if (selectedFilteredCount === 0) return { checked: false };
    if (selectedFilteredCount === filteredInvalidLeads.length) return { checked: true };
    return { checked: 'indeterminate' as const };
  }, [filteredInvalidLeads, selectedLeads]);

  const toggleLeadExpanded = (leadId: string) => {
    setExpandedLeads(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const toggleLeadSelected = (leadId: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const selectAllInvalid = () => {
    setSelectedLeads(new Set(invalidLeads.map(l => l.id)));
  };

  const toggleAllFilteredInvalid = () => {
    const filteredIds = new Set(filteredInvalidLeads.map(l => l.id));
    const allFilteredSelected = filteredInvalidLeads.every(lead => selectedLeads.has(lead.id));

    if (allFilteredSelected) {
      const newSelection = new Set(selectedLeads);
      filteredIds.forEach(id => newSelection.delete(id));
      setSelectedLeads(newSelection);
    } else {
      const newSelection = new Set(selectedLeads);
      filteredIds.forEach(id => newSelection.add(id));
      setSelectedLeads(newSelection);
    }
  };

  const clearSelection = () => {
    setSelectedLeads(new Set());
  };

  const handleOverrideStatus = async (lead: CampaignLead, newStatus: 'valid' | 'invalid') => {
    try {
      const { error } = await supabase
        .from('campaign_leads')
        .update({
          review_status: newStatus,
          review_overridden_by_user: true,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      if (error) throw error;

      toast.success(`Lead marked as ${newStatus}`);
      await fetchReviewedLeads();
    } catch (err) {
      console.error('Failed to override status:', err);
      toast.error('Failed to update lead status');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLeads.size === 0) return;

    setDeleting(true);
    try {
      const leadsToDelete = Array.from(selectedLeads);
      const { error } = await supabase
        .from('campaign_leads')
        .delete()
        .in('id', leadsToDelete);

      if (error) throw error;

      toast.success(`Deleted ${leadsToDelete.length} lead${leadsToDelete.length === 1 ? '' : 's'}`);
      setSelectedLeads(new Set());
      setShowDeleteConfirm(false);
      await fetchReviewedLeads();
      onReviewComplete();
    } catch (err) {
      console.error('Failed to delete leads:', err);
      toast.error('Failed to delete leads');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAllInvalid = async () => {
    if (invalidLeads.length === 0) return;

    setDeleting(true);
    try {
      const invalidIds = invalidLeads.map(l => l.id);
      const { error } = await supabase
        .from('campaign_leads')
        .delete()
        .in('id', invalidIds);

      if (error) throw error;

      toast.success(`Deleted ${invalidIds.length} invalid lead${invalidIds.length === 1 ? '' : 's'}`);
      setSelectedLeads(new Set());
      setShowDeleteConfirm(false);
      await fetchReviewedLeads();
      onReviewComplete();
    } catch (err) {
      console.error('Failed to delete invalid leads:', err);
      toast.error('Failed to delete invalid leads');
    } finally {
      setDeleting(false);
    }
  };

  const renderLeadRow = (lead: CampaignLead, showCheckbox: boolean = true) => {
    const isExpanded = expandedLeads.has(lead.id);
    const isSelected = selectedLeads.has(lead.id);
    const isInvalid = lead.review_status === 'invalid';

    return (
      <>
        <TableRow
          key={lead.id}
          className={cn(
            "hover:bg-muted/50",
            isSelected && "bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30"
          )}
        >
          {showCheckbox && (
            <TableCell className="w-[40px]">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleLeadSelected(lead.id)}
              />
            </TableCell>
          )}
          <TableCell className="w-[40px]">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => toggleLeadExpanded(lead.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              {lead.review_status === 'valid' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <Badge
                variant="outline"
                className={cn(
                  lead.review_status === 'valid' && 'bg-green-500/10 text-green-500 border-green-500/20',
                  lead.review_status === 'invalid' && 'bg-red-500/10 text-red-500 border-red-500/20'
                )}
              >
                {lead.review_status}
                {lead.review_overridden_by_user && (
                  <UserIcon className="h-3 w-3 ml-1" />
                )}
              </Badge>
            </div>
          </TableCell>
          <TableCell>
            <div className="font-medium">{lead.first_name || 'Unknown'}</div>
            {lead.company_name && (
              <div className="text-sm text-muted-foreground">{lead.company_name}</div>
            )}
          </TableCell>
          <TableCell className="max-w-[300px]">
            <div className="truncate text-sm">{lead.email_body.substring(0, 100)}...</div>
          </TableCell>
          <TableCell className="max-w-[200px]">
            <div className="text-sm text-muted-foreground truncate">{lead.review_reason}</div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOverrideStatus(lead, isInvalid ? 'valid' : 'invalid')}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Mark {isInvalid ? 'Valid' : 'Invalid'}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => {
                  setSelectedLeads(new Set([lead.id]));
                  setShowDeleteConfirm(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        {isExpanded && (
          <TableRow key={`${lead.id}-expanded`} className="bg-muted/30 hover:bg-muted/30">
            <TableCell colSpan={showCheckbox ? 7 : 6} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 text-orange-500" />
                  Full Email Body
                </div>
                <div className="p-4 bg-background rounded-lg border text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                  {lead.email_body}
                </div>
                {lead.review_reason && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <AlertCircle className="h-3 w-3 text-yellow-500 mt-0.5" />
                    <div>
                      <span className="font-medium">AI Review: </span>
                      {lead.review_reason}
                    </div>
                  </div>
                )}
              </div>
            </TableCell>
          </TableRow>
        )}
      </>
    );
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open && !showDeleteConfirm} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Body Review Results</DialogTitle>
            <DialogDescription>
              AI has reviewed your email bodies to identify invalid content
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <div className="text-muted-foreground">Loading review results...</div>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No reviewed leads found</h3>
                <p className="text-muted-foreground text-sm">
                  Run the review process first to see results here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-sm text-muted-foreground">Total Reviewed</div>
                  </div>
                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="text-2xl font-bold text-green-500">{stats.valid}</div>
                    <div className="text-sm text-muted-foreground">Valid Emails</div>
                  </div>
                  <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                    <div className="text-2xl font-bold text-red-500">{stats.invalid}</div>
                    <div className="text-sm text-muted-foreground">Invalid Emails</div>
                  </div>
                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="text-2xl font-bold text-blue-500">{stats.overridden}</div>
                    <div className="text-sm text-muted-foreground">User Overridden</div>
                  </div>
                </div>

                {selectedLeads.size > 0 && (
                  <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <span className="text-sm font-medium">
                      {selectedLeads.size} lead{selectedLeads.size === 1 ? '' : 's'} selected
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={clearSelection}>
                        Clear Selection
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete Selected
                      </Button>
                    </div>
                  </div>
                )}

                <Tabs defaultValue="invalid" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="invalid">
                      Invalid Leads ({invalidLeads.length})
                    </TabsTrigger>
                    <TabsTrigger value="all">
                      All Reviewed ({leads.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="invalid" className="mt-4">
                    {invalidLeads.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                          <CheckCircle2 className="h-8 w-8 text-green-500" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">All Clear!</h3>
                        <p className="text-muted-foreground text-sm max-w-md">
                          {validLeads.length > 0
                            ? `Great job! All ${validLeads.length} email${validLeads.length === 1 ? '' : 's'} passed review. Your campaign is ready to go!`
                            : 'No invalid leads found. Run the review process to check your email bodies.'}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="mb-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search by name, company, email content, or reason..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-9 pr-9"
                            />
                            {searchQuery && (
                              <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          {searchQuery && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Showing {filteredInvalidLeads.length} of {invalidLeads.length} invalid leads
                            </p>
                          )}
                        </div>

                        {selectedLeads.size > 0 ? (
                          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="text-sm font-medium">
                                  {selectedLeads.size} lead{selectedLeads.size === 1 ? '' : 's'} selected
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={clearSelection}
                                  className="h-7 text-xs"
                                >
                                  Clear Selection
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={selectAllInvalid}
                                  disabled={selectedLeads.size === invalidLeads.length}
                                  className="h-7 text-xs"
                                >
                                  Select All
                                </Button>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setShowDeleteConfirm(true)}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete Selected
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center mb-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={selectAllInvalid}
                              disabled={invalidLeads.length === 0}
                            >
                              Select All Invalid
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setShowDeleteAllConfirm(true)}
                              disabled={invalidLeads.length === 0}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete All Invalid ({invalidLeads.length})
                            </Button>
                          </div>
                        )}

                        {filteredInvalidLeads.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground border rounded-md">
                            No leads match your search
                          </div>
                        ) : (
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[40px]">
                                    <Checkbox
                                      checked={invalidSelectionState.checked}
                                      onCheckedChange={toggleAllFilteredInvalid}
                                      aria-label="Select all invalid leads"
                                    />
                                  </TableHead>
                                  <TableHead className="w-[40px]"></TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Contact</TableHead>
                                  <TableHead>Email Preview</TableHead>
                                  <TableHead>AI Reason</TableHead>
                                  <TableHead>Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredInvalidLeads.map(lead => renderLeadRow(lead, true))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="all" className="mt-4">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Email Preview</TableHead>
                            <TableHead>AI Reason</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leads.map(lead => renderLeadRow(lead, false))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onReviewComplete();
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The selected leads will be permanently removed from
              this campaign.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-500 mb-1">
                    You are about to delete {selectedLeads.size} lead{selectedLeads.size === 1 ? '' : 's'}
                  </p>
                  <p className="text-muted-foreground">
                    If any of these leads were synced to Instantly, you'll need to re-sync the
                    campaign after deletion.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSelected} disabled={deleting}>
              {deleting ? 'Deleting...' : `Delete ${selectedLeads.size} Lead${selectedLeads.size === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Invalid Leads?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All invalid leads will be permanently removed from
              this campaign.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-red-500 mb-1">
                    You are about to delete all {invalidLeads.length} invalid lead{invalidLeads.length === 1 ? '' : 's'}
                  </p>
                  <p className="text-muted-foreground">
                    If any of these leads were synced to Instantly, you'll need to re-sync the
                    campaign after deletion. This will remove:
                  </p>
                </div>
              </div>
            </div>

            {invalidLeads.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-md border p-3 text-sm">
                <p className="font-medium mb-2">Leads to be deleted:</p>
                <ul className="space-y-1 text-muted-foreground">
                  {invalidLeads.slice(0, 5).map(lead => (
                    <li key={lead.id}>
                      • {lead.first_name || 'Unknown'} {lead.company_name ? `(${lead.company_name})` : ''}
                    </li>
                  ))}
                  {invalidLeads.length > 5 && (
                    <li className="italic">... and {invalidLeads.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAllConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                handleDeleteAllInvalid();
                setShowDeleteAllConfirm(false);
              }}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : `Delete All ${invalidLeads.length} Invalid Leads`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
