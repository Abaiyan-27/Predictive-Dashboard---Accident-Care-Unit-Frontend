import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { SeverityBadge } from '../../components/SeverityBadge';
import { StaleNotice } from '../../components/StaleNotice';
import { StatusBadge } from '../../components/StatusBadge';
import { createTreatment, decideDoctorModel, getDoctorEpisode, getExplanation, runDoctorModels } from '../../api';
import { getApiErrorMessage } from '../../api/client';
import { SEVERITY_STATES } from '../../contracts/severity';
import type { DoctorEpisode, DoctorModelKey, DoctorModelStatus, TransferStatus, XAIExplanation } from '../../types';
import { DoctorModelPanel } from './DoctorModelPanel';

const DOCTOR_MODELS: DoctorModelKey[] = ['stay_duration', 'transfer', 'discharge'];
const MODEL_TITLES: Record<string, string> = {
  severity: 'Severity', stay_duration: 'Stay Duration', transfer: 'Transfer', discharge: 'Discharge Outcome',
};

const TRANSFER_STATUSES: TransferStatus[] = ['pending_authorization', 'authorized', 'approved', 'rejected'];
const SOURCE_TEXT: Record<string, string> = { MODEL: 'Model prediction accepted', NURSE: 'Nurse override', DOCTOR: 'Doctor override' };

const INVESTIGATION_OPTIONS = ['x-ray', 'ct scan', 'mri scan', 'ultrasound scan', 'others'];
const PRIMARY_MANAGEMENT_OPTIONS = [
  'wound suturing', 'fracture stabilization', 'wound cleaning and dressing', 'wound debridement',
  'only medicine and discharge', 'informed to jmo / police', 'observation for head injury',
  'ligamental injury management', 'reduction done for left elbow joint dislocation', 'surgery',
  'duration of hospital stay', 'others',
];
const SECONDARY_MANAGEMENT_OPTIONS = [
  'no other management', ...PRIMARY_MANAGEMENT_OPTIONS.filter((o) => o !== 'others' && o !== 'duration of hospital stay'),
  'imaging', 'pain management', 'pop applied', 'strict bed rest', 'x ray (right hand)', 'others',
];

type Pending =
  | { kind: 'treatment' }
  | { kind: 'accept'; model: DoctorModelStatus; predictionId: string; label: string }
  | { kind: 'override'; model: DoctorModelStatus; predictionId: string; label: string | null; decision: string; reason: string };

const EMPTY_TREATMENT = { number_of_days_stay: '', investigation_done: '', management_name_1: '', management_name_2: '' };

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-xs text-[color:var(--text-muted)]">{label}</span>
      <p className="text-sm font-medium text-[color:var(--text-primary)]">{value || 'Not recorded'}</p>
    </div>
  );
}

export function DoctorEpisodePage() {
  const { accidentId } = useParams<{ accidentId: string }>();
  const navigate = useNavigate();
  const [episode, setEpisode] = useState<DoctorEpisode | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [noticeMsg, setNoticeMsg] = useState('');
  const [treatment, setTreatment] = useState({ ...EMPTY_TREATMENT });
  const [explanations, setExplanations] = useState<Record<string, XAIExplanation | null>>({});
  const [explaining, setExplaining] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!accidentId) return;
    setEpisode(await getDoctorEpisode(accidentId));
  }, [accidentId]);

  useEffect(() => {
    setLoading(true);
    reload()
      .catch((error) => setErrorMsg(getApiErrorMessage(error, 'Failed to load the patient.')))
      .finally(() => setLoading(false));
  }, [reload]);

  const runModels = async () => {
    if (!accidentId) return;
    setBusy(true);
    setErrorMsg('');
    setNoticeMsg('');
    try {
      setEpisode(await runDoctorModels(accidentId));
      setExplanations({});
      setNoticeMsg('Models run on the current patient data.');
    } catch (error) {
      setErrorMsg(getApiErrorMessage(error, 'The models could not be run.'));
    } finally {
      setBusy(false);
    }
  };

  const explain = async (status: DoctorModelStatus) => {
    if (!accidentId) return;
    setExplaining(status.model_key);
    try {
      const data = await getExplanation(status.model_key, accidentId);
      setExplanations((prev) => ({ ...prev, [status.model_key]: data }));
    } catch (error) {
      setErrorMsg(getApiErrorMessage(error, 'The explanation could not be generated.'));
    } finally {
      setExplaining(null);
    }
  };

  // ── Every submission first asks "Are you sure?"; nothing is sent until confirmed ──

  const confirmPending = async () => {
    if (!pending || !accidentId) return;
    const action = pending;
    setBusy(true);
    setErrorMsg('');
    setNoticeMsg('');
    try {
      if (action.kind === 'treatment') {
        await createTreatment({
          accident_id: accidentId,
          number_of_days_stay: treatment.number_of_days_stay === '' ? null : Number(treatment.number_of_days_stay),
          investigation_done: treatment.investigation_done,
          management_name_1: treatment.management_name_1,
          management_name_2: treatment.management_name_2,
        });
        setTreatment({ ...EMPTY_TREATMENT });
        setExplanations({});
        await reload();
        setNoticeMsg('Treatment saved. The doctor models were run on it.');
      } else {
        const request = action.kind === 'accept'
          ? { action: 'accept' as const }
          : { action: 'override' as const, final_decision: action.decision, ...(action.reason ? { reason: action.reason } : {}) };
        setEpisode(await decideDoctorModel(accidentId, action.predictionId, request));
        setNoticeMsg(`${action.model.title} decision saved.`);
      }
    } catch (error) {
      setErrorMsg(getApiErrorMessage(error, 'Unable to save. Please try again.'));
      // A decision can be refused because the screen is out of date: show the current state.
      if (action.kind !== 'treatment') {
        try { await reload(); } catch { /* keep the error already shown */ }
      }
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const confirmText = (action: Pending) => {
    if (action.kind === 'treatment') {
      return <p>Save this treatment? The Stay, Transfer and Discharge models will run on it.</p>;
    }
    if (action.kind === 'accept') {
      return <p>Record the model&apos;s prediction <strong>{action.label}</strong> as the final {action.model.title} decision? It cannot be changed afterwards.</p>;
    }
    return (
      <p>
        Record <strong>{action.decision}</strong> as your final {action.model.title} decision
        {action.label ? <> instead of the model&apos;s <strong>{action.label}</strong></> : null}? It cannot be changed afterwards.
      </p>
    );
  };

  if (loading) return <DashboardShell><LoadingSpinner /></DashboardShell>;
  if (!episode) {
    return (
      <DashboardShell>
        <div role="alert" className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[color:var(--tone-danger)]">{errorMsg || 'Patient not found'}</div>
      </DashboardShell>
    );
  }

  const { patient, accident, severity } = episode;
  const injuries = accident.injuries
    .map((injury) => [injury.site_of_injury, injury.type_of_injury].filter(Boolean).join(': '))
    .filter(Boolean);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/doctor')} className="p-2 rounded-full hover:bg-black/5" style={{ color: 'var(--text-muted)' }}>
            ← Back to patients
          </button>
          <h1 className="text-xl font-semibold gradient-text">{patient.full_name ?? 'Unknown patient'}</h1>
        </div>

        {errorMsg && (
          <div role="alert" className="px-4 py-3 rounded-lg text-sm" style={{ color: 'var(--tone-danger)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {errorMsg}
          </div>
        )}
        {noticeMsg && (
          <div role="status" className="px-4 py-3 rounded-lg text-sm" style={{ color: 'var(--tone-success)', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            {noticeMsg}
          </div>
        )}

        {/* 1. Patient */}
        <Card title="Patient">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Row label="Age" value={patient.age} />
            <Row label="Gender" value={patient.gender} />
            <Row label="Admitted" value={accident.created_at?.slice(0, 10)} />
            <Row label="Injuries" value={injuries.join('; ')} />
          </div>
          <details className="mt-4">
            <summary className="text-xs cursor-pointer text-[color:var(--text-accent)]">Accident details</summary>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Row label="Collision with" value={accident.collision_with} />
              <Row label="Mode of travel" value={accident.mode_of_travel_during_accident} />
              <Row label="Transport to hospital" value={accident.mode_of_transport} />
              <Row label="Time to hospital" value={accident.time_to_hospital} />
            </div>
          </details>
        </Card>

        {/* 2. Severity — decided by the nurse; read-only here */}
        <Card title="Severity">
          <div data-testid="doctor-severity" className="space-y-3 text-sm">
            <p className="text-xs text-[color:var(--text-muted)]">Read-only · decided by the nurse at intake</p>
            {severity.prediction?.stale && !severity.decision && (
              <StaleNotice previous={<SeverityBadge value={severity.prediction.prediction} />} reason={severity.prediction.stale_reason} />
            )}
            <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2">
              <dt className="text-[color:var(--text-muted)]">Model prediction:</dt>
              <dd>
                {severity.prediction && !(severity.prediction.stale && !severity.decision)
                  ? <SeverityBadge value={severity.prediction.prediction} />
                  : <span className="text-[color:var(--text-muted)]">{SEVERITY_STATES[severity.state]}</span>}
              </dd>
              <dt className="text-[color:var(--text-muted)]">Final nurse decision:</dt>
              <dd>
                {severity.decision
                  ? <SeverityBadge value={severity.decision.final_decision} />
                  : <span className="text-[color:var(--text-muted)]">Not decided yet</span>}
              </dd>
              {severity.decision && (
                <>
                  <dt className="text-[color:var(--text-muted)]">Decision source:</dt>
                  <dd className="text-[color:var(--text-secondary)]" data-testid="severity-source">
                    {severity.decision.decision_source} · {SOURCE_TEXT[severity.decision.decision_source] ?? ''}
                  </dd>
                </>
              )}
            </dl>
          </div>
        </Card>

        {/* 3. Treatment / required inputs */}
        <Card title="Treatment">
          <div className="space-y-4">
            {episode.treatment.records.length === 0 ? (
              <p className="text-sm text-[color:var(--text-muted)]">No treatment recorded. The Stay, Transfer and Discharge models need it.</p>
            ) : (
              <ul className="space-y-1 text-sm text-[color:var(--text-secondary)]">
                {episode.treatment.records.map((record) => (
                  <li key={record.treatment_id}>
                    {record.created_at?.slice(0, 10)} · {record.number_of_days_stay ?? '?'} day(s) · {record.investigation_done} · {record.management_name_1}
                    {record.management_name_2 ? ` · ${record.management_name_2}` : ''}
                  </li>
                ))}
              </ul>
            )}
            {episode.treatment.locked && (
              <p className="text-sm" style={{ color: 'var(--tone-warning)' }}>Locked — {episode.treatment.lock_reason}</p>
            )}
            {episode.treatment.can_record && (
              <form onSubmit={(event) => { event.preventDefault(); setPending({ kind: 'treatment' }); }} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="days" className="block text-sm mb-1 text-[color:var(--text-muted)]">Days stayed <span className="text-[color:var(--tone-danger)]">*</span></label>
                    <input id="days" name="number_of_days_stay" type="number" min={0} step={1} required value={treatment.number_of_days_stay}
                      onChange={(e) => setTreatment((v) => ({ ...v, number_of_days_stay: e.target.value }))} className="w-full px-4 py-2.5 text-sm dark-input" />
                  </div>
                  <div>
                    <label htmlFor="investigation" className="block text-sm mb-1 text-[color:var(--text-muted)]">Investigation <span className="text-[color:var(--tone-danger)]">*</span></label>
                    <select id="investigation" name="investigation_done" required value={treatment.investigation_done}
                      onChange={(e) => setTreatment((v) => ({ ...v, investigation_done: e.target.value }))} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Select investigation</option>
                      {INVESTIGATION_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="management1" className="block text-sm mb-1 text-[color:var(--text-muted)]">Primary management <span className="text-[color:var(--tone-danger)]">*</span></label>
                    <select id="management1" name="management_name_1" required value={treatment.management_name_1}
                      onChange={(e) => setTreatment((v) => ({ ...v, management_name_1: e.target.value }))} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Select primary management</option>
                      {PRIMARY_MANAGEMENT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="management2" className="block text-sm mb-1 text-[color:var(--text-muted)]">Secondary management</label>
                    <select id="management2" name="management_name_2" value={treatment.management_name_2}
                      onChange={(e) => setTreatment((v) => ({ ...v, management_name_2: e.target.value }))} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Not recorded</option>
                      {SECONDARY_MANAGEMENT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={busy} className="px-6 py-2.5 text-sm gradient-btn">Save treatment</button>
              </form>
            )}
          </div>
        </Card>

        {/* 4–6. The three doctor models, each its own decision */}
        {DOCTOR_MODELS.map((key) => (
          <DoctorModelPanel
            key={`${key}-${episode.models[key].prediction?.prediction_id ?? 'none'}`}
            status={episode.models[key]}
            busy={busy}
            onRun={runModels}
            onAccept={(status) => status.prediction && setPending({
              kind: 'accept', model: status, predictionId: status.prediction.prediction_id, label: status.prediction.prediction ?? '',
            })}
            onOverride={(status, decision, reason) => status.prediction && setPending({
              kind: 'override', model: status, predictionId: status.prediction.prediction_id,
              label: status.prediction.prediction, decision, reason,
            })}
            onExplain={explain}
            explanation={explanations[key]}
            explaining={explaining === key}
          />
        ))}

        {/* 7. History: every stored prediction and the decision on it (read-only) */}
        <Card title="History">
          <div className="space-y-5 text-sm">
            <div>
              <p className="text-xs text-[color:var(--text-muted)] mb-2">Predictions and decisions</p>
              {episode.history.predictions.length === 0 ? (
                <p className="text-[color:var(--text-muted)]">No predictions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table data-testid="prediction-history" className="w-full text-sm">
                    <thead>
                      <tr>
                        {['Model', 'Model prediction', 'Date / time', 'Decision', 'Decision source'].map((h) => (
                          <th key={h} className="text-left py-2 px-3 font-medium text-[color:var(--text-muted)]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {episode.history.predictions.map((item) => {
                        const decision = item.decisions[item.decisions.length - 1];
                        return (
                          <tr key={item.prediction_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="py-2 px-3 text-[color:var(--text-primary)]">{MODEL_TITLES[item.model_key] ?? item.model_key}</td>
                            <td className="py-2 px-3 text-[color:var(--text-primary)]">{item.prediction ?? `No prediction (${item.status})`}</td>
                            <td className="py-2 px-3 whitespace-nowrap text-[color:var(--text-secondary)]">{item.predicted_at ? new Date(item.predicted_at).toLocaleString() : ''}</td>
                            <td className="py-2 px-3 text-[color:var(--text-primary)]">{decision?.final_decision ?? '—'}</td>
                            <td className="py-2 px-3 text-[color:var(--text-secondary)]">{decision ? SOURCE_TEXT[decision.decision_source] ?? decision.decision_source : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {episode.history.transfers.length > 0 && (
              <div>
                <p className="text-xs text-[color:var(--text-muted)] mb-1">Transfer requests</p>
                <ul className="space-y-1 text-[color:var(--text-secondary)]">
                  {episode.history.transfers.map((item) => (
                    <li key={item.transfer_id} className="flex flex-wrap items-center gap-2">
                      {item.requested_at?.slice(0, 10)}
                      {item.status && TRANSFER_STATUSES.includes(item.status as TransferStatus)
                        ? <StatusBadge status={item.status as TransferStatus} />
                        : <span>{item.status ?? 'unknown'}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {episode.history.episodes.length > 1 && (
              <div>
                <p className="text-xs text-[color:var(--text-muted)] mb-1">Episodes at this hospital</p>
                <ul className="space-y-1 text-[color:var(--text-secondary)]">
                  {episode.history.episodes.map((item) => (
                    <li key={item.accident_id}>
                      {item.created_at?.slice(0, 10)} · {item.status ?? 'open'}
                      {item.accident_id === accident.accident_id ? ' (this episode)' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        confirmLabel={pending?.kind === 'treatment' ? 'Yes, save' : 'Yes, record decision'}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        {pending && confirmText(pending)}
      </ConfirmDialog>
    </DashboardShell>
  );
}
