import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '../../components/Card';
import { getGovernmentStatistics, getModelSummary } from '../../api';
import type { LabelCount, ModelKey, ModelSummary } from '../../types';
import { LoadState, StatTile } from './shared';
import { axisProps, percent, thStyle, tooltipStyle, useGovernmentData } from './governmentData';

const PALETTE = ['#f87171', '#fbbf24', '#34d399', '#94a3b8'];

interface ModelInfo {
  title: string;
  description: string;
}

const MODELS: Record<ModelKey, ModelInfo> = {
  severity: {
    title: 'Severity',
    description:
      'Triage model run by nurses at intake. It predicts HIGH, BORDERLINE or LOW, and answers DEFER TO CLINICAL '
      + 'JUDGEMENT when it cannot score a patient. The nurse records the final Severity decision.',
  },
  stay_duration: {
    title: 'Stay Duration',
    description:
      'Predicts how long a patient will stay in hospital (0-1 days, 2-3 days or 4+ days) once treatment is recorded. '
      + 'The doctor records the final decision.',
  },
  transfer: {
    title: 'Transfer',
    description:
      'Predicts whether a patient is likely to need a transfer to another hospital (Transfer or No transfer). '
      + 'A model prediction is not a transfer request; the doctor records the final decision.',
  },
  discharge: {
    title: 'Discharge',
    description:
      'Predicts the discharge outcome: Complete recovery, Partial recovery or Further interventions. '
      + 'The doctor records the final decision.',
  },
};

function DistributionTable({ rows, unit, testId }: { rows: LabelCount[]; unit: string; testId: string }) {
  return (
    <table className="w-full text-sm" data-testid={testId}>
      <thead>
        <tr>
          <th className="text-left py-2 px-3 font-medium" style={thStyle}>Output</th>
          <th className="text-right py-2 px-3 font-medium" style={thStyle}>{unit}</th>
          <th className="text-right py-2 px-3 font-medium" style={thStyle}>Share</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <td className="py-2 px-3 text-[color:var(--text-primary)]">{row.label}</td>
            <td className="py-2 px-3 text-right text-[color:var(--text-primary)]">{row.count}</td>
            <td className="py-2 px-3 text-right text-[color:var(--text-secondary)]">{percent(row.percentage)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CountsTable({ rows, labels, first, testId }: {
  rows: { key: string; total: number; counts: Record<string, number> }[]; labels: string[]; first: string; testId: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid={testId}>
        <thead>
          <tr>
            <th className="text-left py-2 px-3 font-medium" style={thStyle}>{first}</th>
            {labels.map((label) => <th key={label} className="text-right py-2 px-3 font-medium" style={thStyle}>{label}</th>)}
            <th className="text-right py-2 px-3 font-medium" style={thStyle}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <td className="py-2 px-3 text-[color:var(--text-primary)]">{row.key}</td>
              {labels.map((label) => <td key={label} className="py-2 px-3 text-right text-[color:var(--text-secondary)]">{row.counts[label] ?? 0}</td>)}
              <td className="py-2 px-3 text-right text-[color:var(--text-primary)]">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm py-4 text-[color:var(--text-muted)]">{children}</p>;
}

function SummaryView({ data }: { data: ModelSummary }) {
  const decisions = data.decisions;
  const recentMonths = data.monthly.filter((m) => m.total > 0);
  return (
    <div className="space-y-6">
      <Card title="Key statistics">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="key-statistics">
          <StatTile testId="stat-episodes" label="Patients with a prediction" value={String(data.episodes_with_prediction)} hint="Latest prediction per patient episode" />
          <StatTile testId="stat-runs" label="Predictions recorded" value={String(data.total_predictions)} hint="Including re-runs after corrected inputs" />
          <StatTile testId="stat-decisions" label="Final decisions recorded" value={String(decisions.total)} hint={`Made by the ${data.decision_role}`} />
          <StatTile testId="stat-acceptance" label="Model prediction accepted" value={percent(decisions.acceptance_rate)}
            hint={`${decisions.accepted} accepted · ${decisions.overridden} overridden`} />
        </div>
        {data.unavailable > 0 && (
          <p className="mt-3 text-xs text-[color:var(--text-muted)]" data-testid="stat-unavailable">
            {data.unavailable} patient episode{data.unavailable === 1 ? '' : 's'}: the model could not produce a prediction (not an output category).
          </p>
        )}
      </Card>

      <Card title="Current model outputs">
        {data.episodes_with_prediction === 0 ? <Empty>No predictions have been recorded yet.</Empty> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.current} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }} />
                  <Bar dataKey="count" name="Patients" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <DistributionTable rows={data.current} unit="Patients" testId="current-distribution" />
          </div>
        )}
        <p className="mt-3 text-xs text-[color:var(--text-muted)]">Each patient episode counted once, by its latest prediction, across all hospitals.</p>
      </Card>

      <Card title="Final decisions">
        {decisions.total === 0 ? <Empty>No final decisions have been recorded yet.</Empty> : (
          <DistributionTable rows={decisions.distribution} unit="Decisions" testId="decision-distribution" />
        )}
        <p className="mt-3 text-xs text-[color:var(--text-muted)]">
          Decisions are recorded by the {data.decision_role} for each patient. This page is read-only.
        </p>
      </Card>

      <Card title="Monthly history (last 12 months)">
        {recentMonths.length === 0 ? <Empty>No patients with a prediction were admitted in the last 12 months.</Empty> : (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly.map((m) => ({ month: m.month, ...m.counts }))} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis dataKey="month" {...axisProps} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} {...axisProps} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {data.labels.map((label, i) => <Bar key={label} dataKey={label} stackId="m" fill={PALETTE[i % PALETTE.length]} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4">
              <CountsTable testId="monthly-table" first="Admission month" labels={data.labels}
                rows={recentMonths.map((m) => ({ key: m.month, total: m.total, counts: m.counts }))} />
            </div>
          </>
        )}
        <p className="mt-3 text-xs text-[color:var(--text-muted)]">Patients grouped by admission month, by their latest prediction.</p>
      </Card>

      <Card title="By hospital">
        <p className="-mt-3 mb-3 text-xs text-[color:var(--text-muted)]">Aggregate counts per hospital, by each patient&apos;s latest prediction.</p>
        {data.by_hospital.length === 0 ? <Empty>No hospital has recorded a prediction yet.</Empty> : (
          <CountsTable testId="hospital-table" first="Hospital" labels={data.labels}
            rows={data.by_hospital.map((h) => ({ key: h.hospital, total: h.total, counts: h.counts }))} />
        )}
      </Card>

      {data.versions.length > 0 && (
        <Card title="Model versions">
          <ul className="text-sm space-y-1 text-[color:var(--text-secondary)]" data-testid="model-versions">
            {data.versions.map((v) => (
              <li key={`${v.artifact_name}-${v.first_seen_at}`}>
                {v.artifact_name ?? 'Unknown artifact'}{v.contract_version ? ` · version ${v.contract_version}` : ''}
                {v.first_seen_at ? ` · first used ${new Date(v.first_seen_at).toLocaleDateString()}` : ''} · {v.predictions} prediction{v.predictions === 1 ? '' : 's'}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

const STATUS_TEXT: Record<string, string> = {
  pending_authorization: 'Requested — awaiting authorization',
  authorized: 'Authorized — awaiting transfer',
  approved: 'Transferred',
  rejected: 'Rejected / not transferred',
};

/** Operational transfer requests, kept apart from the Transfer model's predictions. */
function OperationalTransfers() {
  const stats = useGovernmentData(getGovernmentStatistics, 'Unable to load transfer request statistics.');
  return (
    <Card title="Operational transfer requests (not model output)">
      <LoadState result={stats}>
        {(data) => (
          <>
            <table className="w-full text-sm" data-testid="operational-transfers">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 font-medium" style={thStyle}>Request status</th>
                  <th className="text-right py-2 px-3 font-medium" style={thStyle}>Requests</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(STATUS_TEXT).map(([status, text]) => (
                  <tr key={status} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="py-2 px-3 text-[color:var(--text-primary)]">{text}</td>
                    <td className="py-2 px-3 text-right text-[color:var(--text-primary)]">{data.transfers_by_status[status as keyof typeof data.transfers_by_status] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-[color:var(--text-muted)]">
              Transfer requests made by hospital administrators and processed by nurses, across the network ({data.total_transfers} in total).
            </p>
          </>
        )}
      </LoadState>
    </Card>
  );
}

function ModelPage({ model, extra }: { model: ModelKey; extra?: ReactNode }) {
  const info = MODELS[model];
  const summary = useGovernmentData(() => getModelSummary(model), `Unable to load ${info.title} statistics.`, [model]);
  return (
    <div className="space-y-6" data-testid={`government-${model}`}>
      <div>
        <h1 className="text-xl font-semibold gradient-text">{info.title} model</h1>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)] max-w-3xl">{info.description}</p>
        <p className="mt-1 text-xs text-[color:var(--text-muted)]" data-testid="aggregate-note">
          Aggregate statistics across the hospital network. No individual patient records are shown.
        </p>
      </div>
      <LoadState result={summary}>{(data) => <SummaryView data={data} />}</LoadState>
      {extra}
    </div>
  );
}

export const SeverityPage = () => <ModelPage model="severity" />;
export const StayDurationPage = () => <ModelPage model="stay_duration" />;
export const TransferPage = () => <ModelPage model="transfer" extra={<OperationalTransfers />} />;
export const DischargePage = () => <ModelPage model="discharge" />;
