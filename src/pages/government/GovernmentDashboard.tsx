import { Link } from 'react-router-dom';
import { Card } from '../../components/Card';
import { getGovernmentStatistics } from '../../api';
import { LoadState, StatTile } from './shared';
import { useGovernmentData } from './governmentData';

const PAGES = [
  { to: '/government/severity', title: 'Severity', text: 'Triage outputs at intake: HIGH, BORDERLINE, LOW, DEFER TO CLINICAL JUDGEMENT.' },
  { to: '/government/stay', title: 'Stay Duration', text: 'Predicted length of stay: 0-1 days, 2-3 days, 4+ days.' },
  { to: '/government/transfer', title: 'Transfer', text: 'Predicted need for transfer, shown apart from actual transfer requests.' },
  { to: '/government/discharge', title: 'Discharge', text: 'Predicted outcome: Complete recovery, Partial recovery, Further interventions.' },
  { to: '/government/forecast', title: 'Forecast', text: 'Monthly accident counts and the seasonal-naive forecast.' },
  { to: '/government/associations', title: 'Association Rules', text: 'Pre-computed Apriori patterns from the accident dataset.' },
];

/** Government landing page: network totals and the separate analytics pages. */
export function GovernmentDashboard() {
  const stats = useGovernmentData(getGovernmentStatistics, 'Unable to load network statistics.');
  return (
    <div className="space-y-6" data-testid="government-overview">
      <div>
        <h1 className="text-xl font-semibold gradient-text">Network overview</h1>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          Read-only, aggregate figures for every hospital in the system. Each patient model has its own page.
        </p>
      </div>
      <Card title="Network totals">
        <LoadState result={stats}>
          {(data) => (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile testId="stat-accidents" label="Accident records" value={String(data.total_accidents)} />
              <StatTile testId="stat-patients" label="Patients" value={String(data.total_patients)} />
              <StatTile testId="stat-hospitals" label="Hospitals" value={String(data.total_hospitals)} />
              <StatTile testId="stat-transfers" label="Transfer requests" value={String(data.total_transfers)}
                hint={`${data.pending_transfers} awaiting authorization`} />
            </div>
          )}
        </LoadState>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PAGES.map((page) => (
          <Link key={page.to} to={page.to} className="glass-card p-5 block hover:opacity-90">
            <p className="text-base font-semibold text-[color:var(--text-primary)]">{page.title}</p>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">{page.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
