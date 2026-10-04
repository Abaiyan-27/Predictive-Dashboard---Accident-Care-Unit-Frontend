import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { createTreatment, getTreatmentStatus } from '../../api';
import { getApiErrorMessage } from '../../api/client';
import { INVESTIGATION_OPTIONS, PRIMARY_MANAGEMENT_OPTIONS, SECONDARY_MANAGEMENT_OPTIONS } from '../../contracts/treatment';
import type { TreatmentStatus } from '../../types';

const EMPTY = { number_of_days_stay: '', investigation_done: '', management_name_1: '', management_name_2: '' };

interface TreatmentCardProps {
  accidentId: string;
  /** Called after a treatment is saved (the doctor models have run and Box 3 is now locked). */
  onSaved: () => void;
}

/**
 * Box 4: the treatment given. Like every model input it is entered by a nurse;
 * saving it runs the Stay, Transfer and Discharge models for the doctor to review.
 */
export function TreatmentCard({ accidentId, onSaved }: TreatmentCardProps) {
  const [status, setStatus] = useState<TreatmentStatus | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setStatus(await getTreatmentStatus(accidentId));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load the treatment for this patient.'));
    }
  }, [accidentId]);

  useEffect(() => {
    setStatus(null);
    setForm({ ...EMPTY });
    setError('');
    setNotice('');
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await createTreatment({
        accident_id: accidentId,
        number_of_days_stay: form.number_of_days_stay === '' ? null : Number(form.number_of_days_stay),
        investigation_done: form.investigation_done,
        management_name_1: form.management_name_1,
        management_name_2: form.management_name_2,
      });
      setForm({ ...EMPTY });
      setNotice('Treatment saved. The Stay, Transfer and Discharge models were run for the doctor to review.');
      onSaved();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to save the treatment. Please try again.'));
    } finally {
      setBusy(false);
      setConfirming(false);
      await load();
    }
  };

  const change = (field: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((value) => ({ ...value, [field]: event.target.value }));

  return (
    <Card title="Box 4: Treatment">
      <div className="space-y-4" data-testid="nurse-treatment">
        <p className="text-xs text-[color:var(--text-muted)]">
          The treatment given is an input of the Stay, Transfer and Discharge models. Saving it runs those models;
          the doctor reviews the predictions and records the decisions. Box 3 is locked once treatment is recorded.
        </p>
        {error && <p role="alert" className="text-sm" style={{ color: 'var(--tone-danger)' }}>{error}</p>}
        {notice && <p role="status" className="text-sm" style={{ color: 'var(--tone-success)' }}>{notice}</p>}
        {status && (
          status.records.length === 0 ? (
            <p className="text-sm text-[color:var(--text-muted)]">No treatment recorded yet.</p>
          ) : (
            <ul className="space-y-1 text-sm text-[color:var(--text-secondary)]">
              {status.records.map((record) => (
                <li key={record.treatment_id}>
                  {record.created_at?.slice(0, 10)} · {record.number_of_days_stay ?? '?'} day(s) · {record.investigation_done} · {record.management_name_1}
                  {record.management_name_2 ? ` · ${record.management_name_2}` : ''}
                </li>
              ))}
            </ul>
          )
        )}
        {status?.locked && (
          <p className="text-sm" style={{ color: 'var(--tone-warning)' }}>Locked — {status.lock_reason}</p>
        )}
        {status?.can_record && (
          <form onSubmit={(event) => { event.preventDefault(); setConfirming(true); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="days" className="block text-sm mb-1 text-[color:var(--text-muted)]">Days stayed <span className="text-[color:var(--tone-danger)]">*</span></label>
                <input id="days" name="number_of_days_stay" type="number" min={0} step={1} required value={form.number_of_days_stay}
                  onChange={change('number_of_days_stay')} className="w-full px-4 py-2.5 text-sm dark-input" />
              </div>
              <div>
                <label htmlFor="investigation" className="block text-sm mb-1 text-[color:var(--text-muted)]">Investigation <span className="text-[color:var(--tone-danger)]">*</span></label>
                <select id="investigation" name="investigation_done" required value={form.investigation_done}
                  onChange={change('investigation_done')} className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Select investigation</option>
                  {INVESTIGATION_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="management1" className="block text-sm mb-1 text-[color:var(--text-muted)]">Primary management <span className="text-[color:var(--tone-danger)]">*</span></label>
                <select id="management1" name="management_name_1" required value={form.management_name_1}
                  onChange={change('management_name_1')} className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Select primary management</option>
                  {PRIMARY_MANAGEMENT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="management2" className="block text-sm mb-1 text-[color:var(--text-muted)]">Secondary management</label>
                <select id="management2" name="management_name_2" value={form.management_name_2}
                  onChange={change('management_name_2')} className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Not recorded</option>
                  {SECONDARY_MANAGEMENT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" disabled={busy} className="px-6 py-2.5 text-sm gradient-btn">Save treatment</button>
          </form>
        )}
      </div>
      <ConfirmDialog open={confirming} busy={busy} confirmLabel="Yes, save" onConfirm={save} onCancel={() => setConfirming(false)}>
        <p>Save this treatment? The Stay, Transfer and Discharge models will run on it, and Box 3 will be locked.</p>
      </ConfirmDialog>
    </Card>
  );
}
