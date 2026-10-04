import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { SeverityBadge } from '../../components/SeverityBadge';
import { StaleNotice } from '../../components/StaleNotice';
import { StatusBadge } from '../../components/StatusBadge';
import { decideDoctorModel, getDoctorEpisode, getExplanation, runDoctorModels } from '../../api';
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

type Pending =
  | { kind: 'accept'; model: DoctorModelStatus; predictionId: string; label: string }
  | { kind: 'override'; model: DoctorModelStatus; predictionId: string; label: string | null; decision: string; reason: string };

/** One page per model, plus an overview of the patient and the treatment. */
const SECTIONS = [
  { path: '', label: 'Overview' },
  { path: 'severity', label: 'Severity' },
  { path: 'stay', label: 'Stay Duration' },
  { path: 'transfer', label: 'Transfer' },
  { path: 'discharge', label: 'Discharge' },
] as const;
type Section = (typeof SECTIONS)[number]['path'];
const SECTION_MODEL: Partial<Record<Section, DoctorModelKey>> = { stay: 'stay_duration', transfer: 'transfer', discharge: 'discharge' };
const MODEL_SECTION: Record<string, Section> = { severity: 'severity', stay_duration: 'stay', transfer: 'transfer', discharge: 'discharge' };

function HistoryTable({ rows, showModel }: { rows: DoctorEpisode['history']['predictions']; showModel: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-[color:var(--text-muted)]">No predictions yet.</p>;
  const headings = [...(showModel ? ['Model'] : []), 'Model prediction', 'Date / time', 'Decision', 'Decision source'];
  return (
    <div className="overflow-x-auto">
      <table data-testid="prediction-history" className="w-full text-sm">
        <thead>
          <tr>
            {headings.map((h) => (
              <th key={h} className="text-left py-2 px-3 font-medium text-[color:var(--text-muted)]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const decision = item.decisions[item.decisions.length - 1];
            return (
              <tr key={item.prediction_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {showModel && <td className="py-2 px-3 text-[color:var(--text-primary)]">{MODEL_TITLES[item.model_key] ?? item.model_key}</td>}
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
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-xs text-[color:var(--text-muted)]">{label}</span>
      <p className="text-sm font-medium text-[color:var(--text-primary)]">{value || 'Not recorded'}</p>
    </div>
  );
}

export function DoctorEpisodePage() {
  const { accidentId, section: sectionParam } = useParams<{ accidentId: string; section?: string }>();
  const section: Section = SECTIONS.some((item) => item.path === sectionParam) ? (sectionParam as Section) : '';
  const navigate = useNavigate();
  const [episode, setEpisode] = useState<DoctorEpisode | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [noticeMsg, setNoticeMsg] = useState('');
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
      const request = action.kind === 'accept'
        ? { action: 'accept' as const }
        : { action: 'override' as const, final_decision: action.decision, ...(action.reason ? { reason: action.reason } : {}) };
      setEpisode(await decideDoctorModel(accidentId, action.predictionId, request));
      setNoticeMsg(`${action.model.title} decision saved.`);
    } catch (error) {
      setErrorMsg(getApiErrorMessage(error, 'Unable to save. Please try again.'));
      // A decision can be refused because the screen is out of date: show the current state.
      try { await reload(); } catch { /* keep the error already shown */ }
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const confirmText = (action: Pending) => {
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

        <nav aria-label="Patient pages" data-testid="episode-nav" className="flex flex-wrap gap-2">
          {SECTIONS.map((item) => (
            <NavLink
              key={item.label}
              to={`/doctor/episodes/${accidentId}${item.path ? `/${item.path}` : ''}`}
              end
              className="px-4 py-2 text-sm rounded-lg border transition-colors"
              style={({ isActive }) => (isActive
                ? { background: 'rgba(139, 92, 246, 0.15)', color: 'var(--text-accent)', borderColor: 'var(--border-accent)', fontWeight: 600 }
                : { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {section === '' && (
          <>
            {/* Patient */}
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

            {/* Treatment: entered by the nurse (every model input is), read-only here */}
            <Card title="Treatment">
              <div className="space-y-3" data-testid="doctor-treatment">
                <p className="text-xs text-[color:var(--text-muted)]">Read-only. Treatment, like every model input, is entered by a nurse.</p>
                {episode.treatment.records.length === 0 ? (
                  <p className="text-sm text-[color:var(--text-muted)]">
                    No treatment recorded yet. The Stay, Transfer and Discharge models run once a nurse records it.
                  </p>
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
              </div>
            </Card>

            {/* Every model at a glance; each has its own page */}
            <Card title="Models">
              <div className="overflow-x-auto">
                <table data-testid="model-overview" className="w-full text-sm">
                  <thead>
                    <tr>
                      {['Model', 'Model prediction', 'Final decision', ''].map((h) => (
                        <th key={h} className="text-left py-2 px-3 font-medium text-[color:var(--text-muted)]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="py-2 px-3 text-[color:var(--text-primary)]">Severity</td>
                      <td className="py-2 px-3">{severity.prediction && !severity.prediction.stale ? <SeverityBadge value={severity.prediction.prediction} /> : <span className="text-[color:var(--text-muted)]">{SEVERITY_STATES[severity.state]}</span>}</td>
                      <td className="py-2 px-3">{severity.decision ? <SeverityBadge value={severity.decision.final_decision} /> : <span className="text-[color:var(--text-muted)]">Not decided yet</span>}</td>
                      <td className="py-2 px-3"><Link to={`/doctor/episodes/${accidentId}/severity`} className="text-[color:var(--text-accent)]">Open</Link></td>
                    </tr>
                    {DOCTOR_MODELS.map((key) => {
                      const model = episode.models[key];
                      return (
                        <tr key={key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="py-2 px-3 text-[color:var(--text-primary)]">{model.title}</td>
                          <td className="py-2 px-3 text-[color:var(--text-primary)]">{model.prediction?.prediction ?? <span className="text-[color:var(--text-muted)]">No current prediction</span>}</td>
                          <td className="py-2 px-3 text-[color:var(--text-primary)]">{model.final_decision ?? <span className="text-[color:var(--text-muted)]">Not decided yet</span>}</td>
                          <td className="py-2 px-3"><Link to={`/doctor/episodes/${accidentId}/${MODEL_SECTION[key]}`} className="text-[color:var(--text-accent)]">Open</Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {(episode.history.transfers.length > 0 || episode.history.episodes.length > 1) && (
              <Card title="History">
                <div className="space-y-5 text-sm">
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
            )}
          </>
        )}

        {section === 'severity' && (
          <>
            {/* Severity — decided by the nurse; read-only here */}
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

            <Card title="Severity history">
              <HistoryTable rows={episode.history.predictions.filter((item) => item.model_key === 'severity')} showModel={false} />
            </Card>
          </>
        )}

        {SECTION_MODEL[section] && (() => {
          const key = SECTION_MODEL[section] as DoctorModelKey;
          return (
            <>
              {!episode.treatment.recorded && (
                <p className="text-sm text-[color:var(--text-muted)]">
                  Treatment has not been recorded yet. A nurse enters it; this model runs once it is saved.
                </p>
              )}
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
              <Card title={`${episode.models[key].title} history`}>
                <HistoryTable rows={episode.history.predictions.filter((item) => item.model_key === key)} showModel={false} />
              </Card>
            </>
          );
        })()}
      </div>

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        confirmLabel="Yes, record decision"
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        {pending && confirmText(pending)}
      </ConfirmDialog>
    </DashboardShell>
  );
}
