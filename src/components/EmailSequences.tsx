import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Clock, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Label } from './ui/label';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface EmailSequence {
  id: string;
  campaign_id: string;
  sequence_order: number;
  delay_days: number;
  delay_hours: number;
  subject_line: string;
  body_html: string;
  is_active: boolean;
  created_at: string;
}

interface EmailSequencesProps {
  campaignId: string;
}

export function EmailSequences({ campaignId }: EmailSequencesProps) {
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSequence, setEditingSequence] = useState<EmailSequence | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    sequence_order: 2,
    delay_days: 3,
    delay_hours: 0,
    subject_line: '',
    body_html: '',
  });

  useEffect(() => {
    fetchSequences();
  }, [campaignId]);

  const fetchSequences = async () => {
    try {
      const { data, error } = await supabase
        .from('campaign_email_sequences')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('sequence_order', { ascending: true });

      if (error) throw error;
      setSequences(data || []);
    } catch (error) {
      console.error('Error fetching sequences:', error);
      toast.error('Failed to load email sequences');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    const nextOrder = sequences.length > 0
      ? Math.max(...sequences.map(s => s.sequence_order)) + 1
      : 2;

    setFormData({
      sequence_order: nextOrder,
      delay_days: 3,
      delay_hours: 0,
      subject_line: '',
      body_html: '',
    });
    setEditingSequence(null);
  };

  const handleAdd = async () => {
    try {
      const { error } = await supabase.from('campaign_email_sequences').insert({
        campaign_id: campaignId,
        ...formData,
        is_active: true,
      });

      if (error) throw error;

      toast.success('Follow-up email added');
      setShowAddDialog(false);
      resetForm();
      fetchSequences();
    } catch (error: any) {
      console.error('Error adding sequence:', error);
      toast.error(error.message || 'Failed to add follow-up email');
    }
  };

  const handleUpdate = async () => {
    if (!editingSequence) return;

    try {
      const { error } = await supabase
        .from('campaign_email_sequences')
        .update(formData)
        .eq('id', editingSequence.id);

      if (error) throw error;

      toast.success('Follow-up email updated');
      setShowAddDialog(false);
      resetForm();
      fetchSequences();
    } catch (error: any) {
      console.error('Error updating sequence:', error);
      toast.error(error.message || 'Failed to update follow-up email');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this follow-up email?')) return;

    try {
      const { error } = await supabase
        .from('campaign_email_sequences')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Follow-up email deleted');
      fetchSequences();
    } catch (error: any) {
      console.error('Error deleting sequence:', error);
      toast.error(error.message || 'Failed to delete follow-up email');
    }
  };

  const openEditDialog = (sequence: EmailSequence) => {
    setEditingSequence(sequence);
    setFormData({
      sequence_order: sequence.sequence_order,
      delay_days: sequence.delay_days,
      delay_hours: sequence.delay_hours,
      subject_line: sequence.subject_line,
      body_html: sequence.body_html,
    });
    setShowAddDialog(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Sequences</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Sequences
              </CardTitle>
              <CardDescription>
                Follow-up emails to send after the initial email (from CSV). Sequence #1 is your initial email from the uploaded CSV.
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                resetForm();
                setShowAddDialog(true);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Follow-up
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sequences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No follow-up emails configured</p>
              <p className="text-sm mt-1">Add follow-up sequences to continue the conversation</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Initial Email (from CSV) - Read-only */}
              <div className="flex items-start gap-4 p-4 rounded-lg border bg-muted/30">
                <div className="flex flex-col items-center gap-1">
                  <Badge variant="secondary" className="w-16">
                    #1
                  </Badge>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Day 0</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">Initial Email</h4>
                    <Badge variant="outline" className="text-xs">From CSV</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Personalized email with subject line from uploaded CSV data
                  </p>
                </div>
              </div>

              {/* Follow-up Sequences */}
              {sequences.map((sequence) => {
                const displayDelay = sequence.delay_hours > 0
                  ? `${sequence.delay_days}d ${sequence.delay_hours}h`
                  : `${sequence.delay_days}d`;

                return (
                  <div
                    key={sequence.id}
                    className="flex items-start gap-4 p-4 rounded-lg border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Badge className="w-16">
                        #{sequence.sequence_order}
                      </Badge>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{displayDelay}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm mb-1 truncate">
                        {sequence.subject_line}
                      </h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {sequence.body_html.replace(/<[^>]*>/g, '').substring(0, 150)}...
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(sequence)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(sequence.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSequence ? 'Edit Follow-up Email' : 'Add Follow-up Email'}
            </DialogTitle>
            <DialogDescription>
              Create a follow-up email that will be sent after the initial email
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="sequence_order">Sequence #</Label>
                <Input
                  id="sequence_order"
                  type="number"
                  min="2"
                  value={formData.sequence_order}
                  onChange={(e) =>
                    setFormData({ ...formData, sequence_order: parseInt(e.target.value) || 2 })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  #1 is the initial email
                </p>
              </div>
              <div>
                <Label htmlFor="delay_days">Delay (Days)</Label>
                <Input
                  id="delay_days"
                  type="number"
                  min="0"
                  value={formData.delay_days}
                  onChange={(e) =>
                    setFormData({ ...formData, delay_days: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <Label htmlFor="delay_hours">Delay (Hours)</Label>
                <Input
                  id="delay_hours"
                  type="number"
                  min="0"
                  max="23"
                  value={formData.delay_hours}
                  onChange={(e) =>
                    setFormData({ ...formData, delay_hours: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="subject_line">Subject Line</Label>
              <Input
                id="subject_line"
                value={formData.subject_line}
                onChange={(e) => setFormData({ ...formData, subject_line: e.target.value })}
                placeholder="e.g., Following up on our conversation"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use variables: {`{{first_name}}, {{company_name}}, {{website}}`}
              </p>
            </div>

            <div>
              <Label htmlFor="body_html">Email Body</Label>
              <Textarea
                id="body_html"
                value={formData.body_html}
                onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                placeholder="Hi {{first_name}},&#10;&#10;I wanted to follow up on my previous email...&#10;&#10;Best regards"
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                HTML and plain text supported. Use {`{{variables}}`} for personalization.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingSequence ? handleUpdate : handleAdd}
              disabled={!formData.subject_line || !formData.body_html}
            >
              {editingSequence ? 'Update' : 'Add'} Follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
