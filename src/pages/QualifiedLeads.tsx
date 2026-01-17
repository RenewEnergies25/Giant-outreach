import { QualifiedTable } from '../components/QualifiedTable';

export function QualifiedLeads() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Qualified Leads</h1>
        <p className="text-muted-foreground mt-1">
          Leads that need manual attention and follow-up
        </p>
      </div>

      <div className="bg-card rounded-lg border border-border">
        <QualifiedTable />
      </div>
    </div>
  );
}
