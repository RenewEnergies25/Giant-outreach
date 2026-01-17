import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEscalations } from '../lib/hooks';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ChevronDown, ChevronUp, Eye, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export function QualifiedTable() {
  const { escalations, loading, updateEscalation } = useEscalations();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleResolve = async (id: string) => {
    await updateEscalation(id, 'resolved');
    toast.success('Escalation marked as resolved');
  };

  const handleDismiss = async (id: string) => {
    await updateEscalation(id, 'dismissed');
    toast.success('Escalation dismissed');
  };

  const handleViewConversation = (contactId: string) => {
    navigate(`/conversations?contactId=${contactId}`);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (escalations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No pending qualified leads</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contact Name</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Suggested Reply</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {escalations.map((escalation) => (
          <>
            <TableRow key={escalation.id} className="cursor-pointer">
              <TableCell className="font-medium">
                {escalation.contact?.first_name || 'Unknown'}
              </TableCell>
              <TableCell>{escalation.contact?.phone || '-'}</TableCell>
              <TableCell>{escalation.reason}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="truncate max-w-[200px]">
                    {escalation.suggested_reply?.substring(0, 50)}
                    {escalation.suggested_reply && escalation.suggested_reply.length > 50 && '...'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRow(escalation.id)}
                  >
                    {expandedRows.has(escalation.id) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(escalation.created_at), { addSuffix: true })}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => escalation.contact_id && handleViewConversation(escalation.contact_id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResolve(escalation.id)}
                    className="text-green-500"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDismiss(escalation.id)}
                    className="text-red-500"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            {expandedRows.has(escalation.id) && (
              <TableRow>
                <TableCell colSpan={6} className="bg-muted/50">
                  <div className="p-4">
                    <h4 className="font-semibold mb-2">Full Suggested Reply:</h4>
                    <p className="text-sm whitespace-pre-wrap">{escalation.suggested_reply}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </>
        ))}
      </TableBody>
    </Table>
  );
}
