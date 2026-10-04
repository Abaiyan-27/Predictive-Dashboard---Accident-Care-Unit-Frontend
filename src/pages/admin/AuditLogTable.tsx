import type { AuditLog } from '../../types';

const thStyle = { color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' };
const MODEL_TITLES: Record<string, string> = {
  severity: 'Severity', stay_duration: 'Stay', transfer: 'Transfer', discharge: 'Discharge',
};
const STATUS_TEXT: Record<string, string> = {
  pending_authorization: 'requested', authorized: 'authorized', approved: 'transferred', rejected: 'rejected',
};
const ACTION_TEXT: Record<string, string> = {
  transfer_requested: 'Transfer requested',
  transfer_authorized: 'Transfer authorized',
  transfer_rejected: 'Transfer rejected',
  transfer_completed: 'Patient transferred',
  transfer_not_completed: 'Recorded as not transferred',
  transfer_received: 'Patient received (incoming transfer)',
  user_created: 'Staff account created',
  treatment_logged: 'Treatment recorded',
  patient_intake: 'Patient registered',
};
const SOURCE_TEXT: Record<string, string> = { MODEL: 'model prediction accepted', NURSE: 'nurse override', DOCTOR: 'doctor override' };

function actionText(action: string): string {
  if (ACTION_TEXT[action]) return ACTION_TEXT[action];
  const [model, verb] = action.split('_prediction_');
  if (verb) return `${MODEL_TITLES[model] ?? model} prediction ${verb}`;
  return action.split('_').join(' ');
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/** Readable summary of an entry's structured details, by kind of event. */
export function DetailsCell({ log }: { log: AuditLog }) {
  const d = log.details ?? {};
  const action = log.action_type;
  // Model events first: 'transfer_prediction_*' is about the Transfer model, not a transfer request.
  const isModelEvent = action.includes('_prediction_');
  if (!isModelEvent && action.startsWith('transfer_')) {
    const from = text(d.old_status);
    const to = text(d.new_status);
    return (
      <div className="space-y-0.5">
        <div>From: {text(d.from_hospital) || '—'} · To: {text(d.to_hospital) || '—'}</div>
        <div>Status: {from ? `${STATUS_TEXT[from] ?? from} → ` : ''}{STATUS_TEXT[to] ?? to}</div>
        <div>Requested by: {text(d.requested_by_name) || '—'}</div>
        {d.authorized_by_name ? <div>Authorized by: {text(d.authorized_by_name)}</div> : null}
        {d.rejected_by_name ? <div>Rejected by: {text(d.rejected_by_name)}</div> : null}
        {d.processed_by_name ? <div>Processed by: {text(d.processed_by_name)}</div> : null}
        {d.message ? <div>Message: “{text(d.message)}”</div> : null}
        {d.note ? <div>Reason / note: {text(d.note)}</div> : null}
      </div>
    );
  }
  if (/_prediction_(accepted|overridden)$/.test(action)) {
    const model = MODEL_TITLES[text(d.model) || action.split('_prediction_')[0]] ?? text(d.model);
    return (
      <div className="space-y-0.5">
        <div>{model} — model prediction: {text(d.model_prediction) || 'none'}</div>
        <div>Final decision: {text(d.final_decision)}</div>
        <div>Source: {SOURCE_TEXT[text(d.decision_source)] ?? text(d.decision_source)}</div>
        {d.reason ? <div>Reason: {text(d.reason)}</div> : null}
      </div>
    );
  }
  if (action.endsWith('_prediction_executed')) {
    const model = MODEL_TITLES[action.replace('_prediction_executed', '')] ?? action;
    return <div>{model} model: {text(d.model_prediction) || 'no prediction'} ({text(d.model_status)})</div>;
  }
  if (action === 'user_created') {
    return <div>{text(d.name)} · {text(d.email)} · {text(d.role)}</div>;
  }
  if (action === 'treatment_logged') {
    return <div>{text(d.number_of_days_stay)} day(s) · {text(d.investigation_done)} · {text(d.management_name_1)}</div>;
  }
  return null;
}

export function AuditLogTable({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="audit-log-table">
        <thead>
          <tr>
            {['Time', 'Actor', 'Role', 'Action', 'Patient', 'Transfer', 'Details'].map((h) => (
              <th key={h} className="text-left py-3 px-3 font-medium" style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.log_id} className="align-top" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <td className="py-2 px-3 whitespace-nowrap text-[color:var(--text-muted)]">
                {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
              </td>
              <td className="py-2 px-3 text-[color:var(--text-primary)]">{log.actor_name ?? log.actor_id.slice(0, 8)}</td>
              <td className="py-2 px-3 capitalize text-[color:var(--text-secondary)]">{log.role}</td>
              <td className="py-2 px-3 text-[color:var(--text-secondary)]">{actionText(log.action_type)}</td>
              <td className="py-2 px-3 text-[color:var(--text-secondary)]">{log.patient_name ?? (log.accident_id ? log.accident_id.slice(0, 8) : '')}</td>
              <td className="py-2 px-3 text-[color:var(--text-muted)]">{text(log.details?.transfer_id).slice(0, 8)}</td>
              <td className="py-2 px-3 text-xs text-[color:var(--text-secondary)]"><DetailsCell log={log} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
