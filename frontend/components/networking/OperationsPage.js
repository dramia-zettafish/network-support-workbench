import DataTable from '../ui/DataTable';
import PageHeader from '../ui/PageHeader';
import SectionCard from '../ui/SectionCard';
import StatCard from '../ui/StatCard';
import StatusBadge from '../ui/StatusBadge';
import { openCases, operationStats, recentActivity } from '../../lib/mockOperationsData';
import styles from './OperationsPage.module.css';

const openCaseColumns = [
  { key: 'ticket', label: 'Ticket #' },
  { key: 'school', label: 'School' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'status', label: 'Status', render: (row) => <StatusBadge tone={row.tone}>{row.status}</StatusBadge> },
  { key: 'age', label: 'Age' }
];

const activityColumns = [
  { key: 'time', label: 'Time' },
  { key: 'activity', label: 'Activity' },
  { key: 'owner', label: 'Owner' }
];

export default function OperationsPage({ onNavigate }) {
  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Networking"
        title="Operations"
        description="A compact control surface for open work, pending actions, and scheduled network activity."
        actions={
          <>
            <button type="button" className="primaryButton" onClick={() => onNavigate('tickets')}>
              Create Ticket
            </button>
            <button type="button" onClick={() => onNavigate('ups')}>View Pending UPS</button>
          </>
        }
      />

      <div className={styles.statsGrid}>
        {operationStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className={styles.contentGrid}>
        <SectionCard title="Open Cases Tracker" description="Static placeholder data until workflow APIs are wired into the dashboard.">
          <DataTable columns={openCaseColumns} rows={openCases} getRowKey={(row) => row.ticket} />
        </SectionCard>

        <SectionCard title="Quick Actions" description="Workflow shortcuts for the next implementation pass.">
          <div className={styles.quickActions}>
            <button type="button" className="primaryButton" onClick={() => onNavigate('tickets')}>
              Create Ticket
            </button>
            <button type="button" onClick={() => onNavigate('ups')}>Generate Schedule</button>
            <button type="button" onClick={() => onNavigate('ups')}>View Pending UPS</button>
          </div>
        </SectionCard>

        <SectionCard title="Recent Activity" description="Compact activity feed placeholder.">
          <DataTable columns={activityColumns} rows={recentActivity} getRowKey={(row) => `${row.time}-${row.activity}`} />
        </SectionCard>
      </div>
    </div>
  );
}
