import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { TransferSummary } from '../../components/TransferSummary';
import { getNurseTransferRequests, getTransferStates, processTransferRequest } from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type { TransferRequest } from '../../types';

type Pending =
  | { kind: 'transferred'; transfer: TransferRequest; state: string; note: string }
  | { kind: 'not_transferred'; transfer: TransferRequest; note: string };

/**
 * Transfer requests sent from this hospital. Any nurse here sees them; once an
 * admin has authorized one, a nurse records whether the patient was actually
 * transferred. This is an operational record, separate from any prediction.
 */
export function TransferRequestsCard() {
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [forms, setForms] = useState<Record<string, { state: string; note: string }>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [rows, options] = await Promise.all([getNurseTransferRequests(), getTransferStates()]);
      setRequests(rows);
      setStates(options);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Unable to load transfer requests.'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const form = (id: string) => forms[id] ?? { state: '', note: '' };
  const setForm = (id: string, change: Partial<{ state: string; note: string }>) =>
    setForms((prev) => ({ ...prev, [id]: { ...form(id), ...change } }));

  const confirm = async () => {
    if (!pending) return;
    const action = pending;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (action.kind === 'transferred') {
        await processTransferRequest(action.transfer.transfer_id, {
          outcome: 'transferred', state_of_transfer: action.state, ...(action.note ? { note: action.note } : {}),
        });
        setNotice(`Transfer of ${action.transfer.patient_name ?? 'the patient'} recorded as completed.`);
      } else {
        await processTransferRequest(action.transfer.transfer_id, { outcome: 'not_transferred', note: action.note });
        setNotice(`Transfer of ${action.transfer.patient_name ?? 'the patient'} recorded as not done.`);
      }
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, 'Unable to record the transfer.'));
    } finally {
      await load();
      setBusy(false);
      setPending(null);
    }
  };

  const open = requests.filter((r) => r.status === 'pending_authorization' || r.status === 'authorized');
  const closed = requests.filter((r) => r.status === 'approved' || r.status === 'rejected');

  return (
    <Card title="Transfer requests">
      <div data-testid="nurse-transfer-requests" className="space-y-4">
        {error && <p role="alert" className="text-sm" style={{ color: 'var(--tone-danger)' }}>{error}</p>}
        {notice && <p role="status" className="text-sm" style={{ color: 'var(--tone-success)' }}>{notice}</p>}
        {open.length === 0 && <p className="text-sm text-[color:var(--text-muted)]">No open transfer requests.</p>}
        {open.map((transfer) => {
          const values = form(transfer.transfer_id);
          const canProcess = transfer.allowed_actions.includes('complete');
          return (
            <div key={transfer.transfer_id} className="rounded-lg p-4 space-y-3" style={{ border: '1px solid var(--border-subtle)' }}>
              <TransferSummary transfer={transfer} />
              {!canProcess && transfer.status === 'pending_authorization' && (
                <p className="text-xs text-[color:var(--text-muted)]">Waiting for the administrator to authorize this transfer.</p>
              )}
              {canProcess && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`state-${transfer.transfer_id}`} className="block text-xs mb-1 text-[color:var(--text-muted)]">How was the patient transferred?</label>
                    <select id={`state-${transfer.transfer_id}`} value={values.state} onChange={(e) => setForm(transfer.transfer_id, { state: e.target.value })} className="w-full px-3 py-2 text-sm dark-input">
                      <option value="">Select</option>
                      {states.map((state) => <option key={state} value={state}>{state}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`note-${transfer.transfer_id}`} className="block text-xs mb-1 text-[color:var(--text-muted)]">Note (required if not transferred)</label>
                    <input id={`note-${transfer.transfer_id}`} value={values.note} onChange={(e) => setForm(transfer.transfer_id, { note: e.target.value })} className="w-full px-3 py-2 text-sm dark-input" />
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap gap-3">
                    <button type="button" disabled={busy || !values.state} className="px-4 py-2 text-sm gradient-btn"
                      onClick={() => setPending({ kind: 'transferred', transfer, state: values.state, note: values.note.trim() })}>
                      Patient transferred
                    </button>
                    <button type="button" disabled={busy || !values.note.trim()} className="px-4 py-2 text-sm rounded-lg border"
                      style={{ color: 'var(--tone-danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      onClick={() => setPending({ kind: 'not_transferred', transfer, note: values.note.trim() })}>
                      Not transferred
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {closed.length > 0 && (
          <details>
            <summary className="text-xs cursor-pointer text-[color:var(--text-muted)]">Recently closed ({closed.length})</summary>
            <ul className="mt-2 space-y-3">{closed.map((t) => <li key={t.transfer_id}><TransferSummary transfer={t} /></li>)}</ul>
          </details>
        )}
      </div>
      <ConfirmDialog open={pending !== null} busy={busy} confirmLabel="Yes, record" onConfirm={confirm} onCancel={() => setPending(null)}>
        {pending?.kind === 'transferred' && (
          <p>Record that {pending.transfer.patient_name ?? 'the patient'} was transferred to {pending.transfer.destination_hospital}? The patient will move to that hospital.</p>
        )}
        {pending?.kind === 'not_transferred' && (
          <p>Record that the transfer of {pending.transfer.patient_name ?? 'the patient'} did not happen? This closes the request.</p>
        )}
      </ConfirmDialog>
    </Card>
  );
}
