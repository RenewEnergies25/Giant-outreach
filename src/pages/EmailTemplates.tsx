import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Upload,
  FileText,
  Trash2,
  Edit,
  Copy,
  Search,
  Sparkles,
  Eye,
  MoreVertical,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { supabase } from '../lib/supabase';
import { EmailTemplate } from '../types/database';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const CATEGORIES = [
  { value: 'initial', label: 'Initial Outreach' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'closing', label: 'Closing' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'other', label: 'Other' },
];

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  template: EmailTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{template.name}</CardTitle>
              {template.description && (
                <CardDescription className="line-clamp-2">
                  {template.description}
                </CardDescription>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            {template.category && (
              <Badge variant="outline" className="text-xs">
                {CATEGORIES.find((c) => c.value === template.category)?.label || template.category}
              </Badge>
            )}
            {template.use_ai_subject && (
              <Badge
                variant="outline"
                className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                AI Subject
              </Badge>
            )}
            {!template.is_active && (
              <Badge variant="outline" className="text-xs bg-gray-500/10 text-gray-500">
                Inactive
              </Badge>
            )}
          </div>

          {template.subject_line && !template.use_ai_subject && (
            <div className="text-sm mb-2">
              <span className="text-muted-foreground">Subject:</span>{' '}
              <span className="font-medium">{template.subject_line}</span>
            </div>
          )}

          <div className="text-xs text-muted-foreground line-clamp-3 bg-muted/50 p-2 rounded">
            {template.body_text || template.body_html.replace(/<[^>]*>/g, '').slice(0, 200)}
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{template.name}</DialogTitle>
            <DialogDescription>Email template preview</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {template.subject_line && (
              <div>
                <Label className="text-muted-foreground">Subject Line</Label>
                <p className="font-medium">{template.subject_line}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">Email Body</Label>
              <div
                className="mt-2 p-4 border rounded bg-white text-black prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: template.body_html }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateTemplateDialog({
  open,
  onOpenChange,
  onCreated,
  editTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  editTemplate?: EmailTemplate | null;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    body_html: '',
    body_text: '',
    subject_line: '',
    use_ai_subject: true,
    ai_subject_prompt: '',
    category: 'initial' as string,
    is_active: true,
  });

  useEffect(() => {
    if (editTemplate) {
      setFormData({
        name: editTemplate.name,
        description: editTemplate.description || '',
        body_html: editTemplate.body_html,
        body_text: editTemplate.body_text || '',
        subject_line: editTemplate.subject_line || '',
        use_ai_subject: editTemplate.use_ai_subject,
        ai_subject_prompt: editTemplate.ai_subject_prompt || '',
        category: editTemplate.category || 'other',
        is_active: editTemplate.is_active,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        body_html: '',
        body_text: '',
        subject_line: '',
        use_ai_subject: true,
        ai_subject_prompt: '',
        category: 'initial',
        is_active: true,
      });
    }
  }, [editTemplate, open]);

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!formData.body_html.trim()) {
      toast.error('Email body is required');
      return;
    }

    try {
      setLoading(true);

      const templateData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        body_html: formData.body_html.trim(),
        body_text: formData.body_text.trim() || null,
        subject_line: formData.use_ai_subject ? null : formData.subject_line.trim() || null,
        use_ai_subject: formData.use_ai_subject,
        ai_subject_prompt: formData.use_ai_subject ? formData.ai_subject_prompt.trim() || null : null,
        category: formData.category,
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editTemplate) {
        const { error } = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', editTemplate.id);
        if (error) throw error;
        toast.success('Template updated');
      } else {
        const { error } = await supabase.from('email_templates').insert(templateData);
        if (error) throw error;
        toast.success('Template created');
      }

      onOpenChange(false);
      onCreated();
    } catch (err) {
      console.error('Failed to save template:', err);
      toast.error('Failed to save template');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editTemplate ? 'Edit Template' : 'Create Email Template'}</DialogTitle>
          <DialogDescription>
            Create an email body template that can be used in campaigns
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Initial Outreach v1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Brief description of this template"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <Label>Generate Subject Line with AI</Label>
              </div>
              <Switch
                checked={formData.use_ai_subject}
                onCheckedChange={(checked) => setFormData({ ...formData, use_ai_subject: checked })}
              />
            </div>

            {formData.use_ai_subject ? (
              <div className="space-y-2">
                <Label htmlFor="ai_prompt" className="text-xs text-muted-foreground">
                  AI Prompt (optional - customize how subjects are generated)
                </Label>
                <Textarea
                  id="ai_prompt"
                  placeholder="e.g., Create a personalized, curiosity-driven subject line that mentions their company..."
                  value={formData.ai_subject_prompt}
                  onChange={(e) => setFormData({ ...formData, ai_subject_prompt: e.target.value })}
                  rows={2}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="subject_line">Subject Line *</Label>
                <Input
                  id="subject_line"
                  placeholder="Enter a static subject line"
                  value={formData.subject_line}
                  onChange={(e) => setFormData({ ...formData, subject_line: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Use {'{{first_name}}'}, {'{{company}}'} for personalization
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="body_html">Email Body (HTML) *</Label>
            <Textarea
              id="body_html"
              placeholder="<p>Hi {{first_name}},</p><p>...</p>"
              value={formData.body_html}
              onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Variables: {'{{first_name}}'}, {'{{last_name}}'}, {'{{company}}'}, {'{{email}}'},{' '}
              {'{{vsl_url}}'}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label className="text-sm">Active</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : editTemplate ? 'Update Template' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkUploadDialog({ onUploaded }: { onUploaded: () => void }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
    };
    reader.readAsText(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  async function handleUpload() {
    if (!csvContent.trim()) {
      toast.error('Please add CSV content');
      return;
    }

    try {
      setUploading(true);

      // Parse CSV
      const lines = csvContent.trim().split('\n');
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

      const nameIdx = headers.indexOf('name');
      const bodyIdx = headers.indexOf('body_html') || headers.indexOf('body');
      const subjectIdx = headers.indexOf('subject_line') || headers.indexOf('subject');
      const categoryIdx = headers.indexOf('category');

      if (bodyIdx === -1) {
        toast.error('CSV must have a "body_html" or "body" column');
        return;
      }

      const templates = [];
      let errors = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));

        if (!values[bodyIdx]) {
          errors++;
          continue;
        }

        templates.push({
          name: nameIdx >= 0 ? values[nameIdx] : `Template ${i}`,
          body_html: values[bodyIdx],
          subject_line: subjectIdx >= 0 ? values[subjectIdx] : null,
          category: categoryIdx >= 0 ? values[categoryIdx] : 'other',
          use_ai_subject: subjectIdx < 0 || !values[subjectIdx],
          is_active: true,
        });
      }

      if (templates.length === 0) {
        toast.error('No valid templates found in CSV');
        return;
      }

      const { error } = await supabase.from('email_templates').insert(templates);

      if (error) throw error;

      toast.success(`Uploaded ${templates.length} templates${errors > 0 ? ` (${errors} skipped)` : ''}`);
      setOpen(false);
      setCsvContent('');
      onUploaded();
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Failed to upload templates');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk Upload Email Templates</DialogTitle>
          <DialogDescription>
            Upload a CSV file with email bodies. Required column: body_html or body
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              dragActive ? 'border-primary bg-primary/5' : 'border-muted'
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop a CSV file, or click to browse
            </p>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="max-w-xs mx-auto"
            />
          </div>

          <div className="space-y-2">
            <Label>Or paste CSV content directly</Label>
            <Textarea
              placeholder="name,body_html,subject_line,category&#10;Welcome Email,<p>Hi {{first_name}}...</p>,Welcome!,initial"
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">CSV Format:</p>
            <p>• Required: body_html (or body)</p>
            <p>• Optional: name, subject_line, category, description</p>
            <p>• Categories: initial, follow_up, closing, reminder, other</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !csvContent.trim()}>
            {uploading ? 'Uploading...' : 'Upload Templates'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase.from('email_templates').delete().eq('id', id);
      if (error) throw error;
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err) {
      toast.error('Failed to delete template');
    }
  }

  async function handleDuplicate(template: EmailTemplate) {
    try {
      const { error } = await supabase.from('email_templates').insert({
        name: `${template.name} (Copy)`,
        description: template.description,
        body_html: template.body_html,
        body_text: template.body_text,
        subject_line: template.subject_line,
        use_ai_subject: template.use_ai_subject,
        ai_subject_prompt: template.ai_subject_prompt,
        category: template.category,
        is_active: template.is_active,
      });
      if (error) throw error;
      toast.success('Template duplicated');
      fetchTemplates();
    } catch (err) {
      toast.error('Failed to duplicate template');
    }
  }

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground mt-1">
            Manage email body templates for campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <BulkUploadDialog onUploaded={fetchTemplates} />
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          value={categoryFilter || 'all'}
          onValueChange={(value) => setCategoryFilter(value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="flex flex-col items-center justify-center h-64">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No templates yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create or upload email templates to use in campaigns
          </p>
          <div className="flex gap-2">
            <BulkUploadDialog onUploaded={fetchTemplates} />
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => {
                setEditTemplate(template);
                setCreateDialogOpen(true);
              }}
              onDelete={() => handleDelete(template.id)}
              onDuplicate={() => handleDuplicate(template)}
            />
          ))}
        </div>
      )}

      <CreateTemplateDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setEditTemplate(null);
        }}
        onCreated={fetchTemplates}
        editTemplate={editTemplate}
      />
    </div>
  );
}
