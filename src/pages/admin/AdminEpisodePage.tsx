import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StaleNotice } from '../../components/StaleNotice';
import { TransferSummary } from '../../components/TransferSummary';
import { authorizeTransfer, createTransferRequest, getAdminEpisode, getNetworkHospitals, rejectTransfer } from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type { AdminEpisode, AdminPredictionView, NetworkHospital } from '../../types';

type Pending =
  | { kind: 'request'; hospital: NetworkHospital; message: string }
  | { kind: 'authorize'; transferId: string }
  | { kind: 'reject'; transferId: string; reason: string };

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-xs text-[color:var(--text-muted)]">{label}</span>
      <p className="text-sm font-medium text-[color:var(--text-primary)]">{value || 'Not recorded'}</p>
    </div>
  );
}

function PredictionCard({ view, testId }: { view: AdminPredictionView; testId: string }) {
  const prediction = view.prediction;
  return (
    <div data-testid={testId} className="rounded-lg p-4" style={{ border: '1px solid var(--border-subtle)' }}>
      <p className="text-xs text-[color:var(--text-muted)]">{view.title} prediction</p>
      {prediction?.prediction ? (
        <>
          <p className={`mt-1 text-lg font-semibold ${prediction.stale ? 'line-through text-[color:var(--text-muted)]' : 'text-[color:var(--text-primary)]'}`}>{prediction.prediction}</p>
          <p className="text-xs text-[color:var(--text-muted)]">
            {prediction.probability !== null ? `${Math.round(prediction.probability * 100)}% probability · ` : ''}
            {prediction.predicted_at ? new Date(prediction.predicted_at).toLocaleString() : ''}
          </p>
          {prediction.stale && <div className="mt-2"><StaleNotice reason={prediction.stale_reason} /></div>}
        </>
      ) : (
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
          {view.state === 'WAITING_FOR_INPUTS' ? 'Waiting for the doctor to record treatment' : 'No prediction yet'}
        </p>
      )}
    </div>
  );
}

/** The admin's read-only view of one episode, plus the transfer-request actions. */
export function AdminEpisodePage() {
  const { accidentId } = useParams<{ accidentId: string }>();
  const navigate = useNavigate();
  const [episode, setEpisode] = useState<AdminEpisode | null>(null);
  const [hospitals, setHospitals] = useState<NetworkHospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [destination, setDestination] = useState('');
  const [message, setMessage] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const reload = useCallback(async () => {
    if (!accidentId) return;
    setEpisode(await getAdminEpisode(accidentId));
  }, [accidentId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([reload(), getNetworkHospitals().then(setHospitals)])
      .catch((loadError) => setError(getApiErrorMessage(loadError, 'Failed to load the patient.')))
      .finally(() => setLoading(false));
  }, [reload]);

  const confirmPending = async () => {
    if (!pending || !accidentId) return;
    const action = pending;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (action.kind === 'request') {
        await createTransferRequest(accidentId, action.hospital.hospital_id, action.message);
        setDestination('');
        setMessage('');
        setNotice('Transfer request sent. It now appears on the nurses\' dashboard.');
      }
      if (action.kind === 'authorize') {
        await authorizeTransfer(action.transferId);
        setNotice('Transfer authorized. A nurse can now process it.');
      }
      if (action.kind === 'reject') {
        await rejectTransfer(action.transferId, action.reason);
        setRejectReason('');
        setNotice('Transfer rejected.');
      }
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, 'Unable to complete the action.'));
    } finally {
      try { await reload(); } catch { /* keep the message already shown */ }
      setBusy(false);
      setPending(null);
    }
  };

  if (loading) return <DashboardShell><LoadingSpinner /></DashboardShell>;
  if (!episode) {
    return <DashboardShell><div role="alert" className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[color:var(--tone-danger)]">{error || 'Patient not found'}</div></DashboardShell>;
  }

  const open = episode.open_transfer;
  const history = episode.transfers.filter((t) => t.transfer_id !== open?.transfer_id);
  const injuries = episode.episode.injuries.map((i) => [i.site_of_injury, i.type_of_injury].filter(Boolean).join(': ')).filter(Boolean);
  const chosen = hospitals.find((h) => h.hospital_id === destination);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin')} className="p-2 rounded-full hover:bg-black/5" style={{ color: 'var(--text-muted)' }}>← Back to patients</button>
          <h1 className="text-xl font-semibold gradient-text">{episode.patient.full_name ?? 'Unknown patient'}</h1>
        </div>
        {error && <div role="alert" className="px-4 py-3 rounded-lg text-sm" style={{ color: 'var(--tone-danger)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>}
        {notice && <div role="status" className="px-4 py-3 rounded-lg text-sm" style={{ color: 'var(--tone-success)', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{notice}</div>}

        <Card title="Basic information">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Row label="Age" value={episode.patient.age} />
            <Row label="Gender" value={episode.patient.gender} />
            <Row label="Admitted" value={episode.episode.created_at?.slice(0, 10)} />
            <Row label="Current hospital" value={episode.episode.hospital_name} />
            <Row label="Injuries" value={injuries.join('; ')} />
          </div>
          {episode.stays.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-[color:var(--text-muted)] mb-1">Hospital stays</p>
              <ul className="text-sm text-[color:var(--text-secondary)] space-y-0.5" data-testid="hospital-stays">
                {episode.stays.map((stay) => (
                  <li key={stay.id}>
                    {stay.hospital_name}: {new Date(stay.entered_at).toLocaleString()} – {stay.exited_at ? new Date(stay.exited_at).toLocaleString() : 'now'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Predictions">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PredictionCard view={episode.predictions.stay_duration} testId="admin-stay" />
            <PredictionCard view={episode.predictions.transfer} testId="admin-transfer" />
          </div>
          <p className="mt-3 text-xs text-[color:var(--text-muted)]">Model predictions are shown for planning. Clinical decisions are made by the doctor.</p>
        </Card>

        <Card title="Transfer">
          <div className="space-y-4">
            {open ? (
              <div>
                <TransferSummary transfer={open} />
                {open.allowed_actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {open.allowed_actions.includes('authorize') && (
                      <button type="button" disabled={busy} onClick={() => setPending({ kind: 'authorize', transferId: open.transfer_id })} className="px-4 py-2 text-sm gradient-btn">Authorize</button>
                    )}
                    {open.allowed_actions.includes('reject') && (
                      <>
                        <input aria-label="Rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejecting" className="px-3 py-2 text-sm dark-input" />
                        <button type="button" disabled={busy || !rejectReason.trim()} onClick={() => setPending({ kind: 'reject', transferId: open.transfer_id, reason: rejectReason.trim() })}
                          className="px-4 py-2 text-sm rounded-lg border" style={{ color: 'var(--tone-danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>Reject</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[color:var(--text-muted)]">No open transfer request.</p>
            )}

            {episode.can_request_transfer && (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (chosen) setPending({ kind: 'request', hospital: chosen, message: message.trim() }); }}>
                <p className="text-sm font-medium text-[color:var(--text-primary)]">Request a transfer</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="destination" className="block text-xs mb-1 text-[color:var(--text-muted)]">Destination hospital</label>
                    <select id="destination" required value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full px-3 py-2 text-sm dark-input">
                      <option value="">Select a network hospital</option>
                      {hospitals.map((h) => <option key={h.hospital_id} value={h.hospital_id}>{h.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="transfer-message" className="block text-xs mb-1 text-[color:var(--text-muted)]">Message to the nurses</label>
                    <textarea id="transfer-message" required maxLength={2000} rows={2} value={message} onChange={(e) => setMessage(e.target.value)}
                      placeholder={`Prepare ${episode.patient.full_name ?? 'the patient'} for transfer.`} className="w-full px-3 py-2 text-sm dark-input" />
                  </div>
                </div>
                <button type="submit" disabled={busy || !chosen || !message.trim()} className="px-4 py-2 text-sm gradient-btn">Send transfer request</button>
              </form>
            )}

            {history.length > 0 && (
              <div>
                <p className="text-xs text-[color:var(--text-muted)] mb-2">Earlier requests</p>
                <ul className="space-y-3">{history.map((t) => <li key={t.transfer_id}><TransferSummary transfer={t} /></li>)}</ul>
              </div>
            )}
          </div>
        </Card>
      </div>

      <ConfirmDialog open={pending !== null} busy={busy} confirmLabel="Yes, continue" onConfirm={confirmPending} onCancel={() => setPending(null)}>
        {pending?.kind === 'request' && <p>Send a request to transfer {episode.patient.full_name ?? 'this patient'} to {pending.hospital.name}?</p>}
        {pending?.kind === 'authorize' && <p>Authorize this transfer? The nurses can then process it.</p>}
        {pending?.kind === 'reject' && <p>Reject this transfer request? This is final.</p>}
      </ConfirmDialog>
    </DashboardShell>
  );
}
