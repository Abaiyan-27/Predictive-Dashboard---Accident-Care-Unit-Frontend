import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ListFooter } from '../../components/ListFooter';
import { StaleNotice } from '../../components/StaleNotice';
import { StatusBadge } from '../../components/StatusBadge';
import { TransferSummary } from '../../components/TransferSummary';
import {
  authorizeTransfer,
  createUser,
  getAdminPatients,
  getAuditLogs,
  getStaffUsers,
  getTransferRequests,
  rejectTransfer,
} from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type {
  AdminPatientRow,
  AdminPredictionView,
  AuditLog,
  CreatedUser,
  CreateUserPayload,
  StaffRole,
  StaffUser,
  TransferRequest,
} from '../../types';
import { AuditLogTable } from './AuditLogTable';

type AdminTab = 'patients' | 'transfers' | 'users' | 'logs';

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'patients', label: 'Patients' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'users', label: 'User management' },
  { key: 'logs', label: 'Audit log' },
];

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'nurse', label: 'Nurse' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'admin', label: 'Administrator' },
];

const LOG_FILTERS = [
  { value: '', label: 'All events' },
  { value: 'transfer_*', label: 'Transfers' },
  { value: 'user_created', label: 'Staff accounts' },
  { value: 'treatment_logged', label: 'Treatments' },
  { value: 'patient_intake', label: 'Intake' },
];
const LOG_PAGE = 25;

const labelClass = 'block text-sm font-medium mb-1.5';
const labelStyle = { color: 'var(--text-secondary)' };
const thStyle = { color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' };
const EMPTY_USER: CreateUserPayload = { name: '', email: '', password: '', role: 'nurse' };

type Pending =
  | { kind: 'authorize'; transfer: TransferRequest }
  | { kind: 'reject'; transfer: TransferRequest; reason: string }
  | { kind: 'create-user' };

/** A model prediction as the admin sees it: read-only, with its freshness. */
export function PredictionText({ view }: { view: AdminPredictionView }) {
  if (!view.prediction || !view.prediction.prediction) {
    return <span className="text-[color:var(--text-muted)]">{view.state === 'WAITING_FOR_INPUTS' ? 'Waiting for treatment' : 'Not available'}</span>;
  }
  if (view.prediction.stale) {
    return (
      <span className="flex flex-col">
        <StaleNotice compact reason={view.prediction.stale_reason} />
        <span className="text-xs text-[color:var(--text-muted)] line-through">{view.prediction.prediction}</span>
      </span>
    );
  }
  return <span className="text-[color:var(--text-primary)]">{view.prediction.prediction}</span>;
}

function Alert({ kind, message }: { kind: 'error' | 'success'; message: string }) {
  const style = kind === 'error'
    ? { color: 'var(--tone-danger)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }
    : { color: 'var(--tone-success)', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' };
  return <div role={kind === 'error' ? 'alert' : 'status'} className="mb-4 px-4 py-3 rounded-lg text-sm" style={style}>{message}</div>;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('patients');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const [patients, setPatients] = useState<AdminPatientRow[]>([]);
  const [patientTotal, setPatientTotal] = useState(0);
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [transferTotal, setTransferTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [userForm, setUserForm] = useState<CreateUserPayload>({ ...EMPTY_USER });
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logFilter, setLogFilter] = useState('');
  const [hasMoreLogs, setHasMoreLogs] = useState(false);

  const load = useCallback(async (tab: AdminTab, filter = '') => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'patients') {
        const page = await getAdminPatients();
        setPatients(page.rows);
        setPatientTotal(page.total);
      }
      if (tab === 'transfers') {
        const page = await getTransferRequests();
        setTransfers(page.rows);
        setTransferTotal(page.total);
      }
      if (tab === 'users') setUsers(await getStaffUsers());
      if (tab === 'logs') {
        const page = await getAuditLogs({ action: filter, limit: LOG_PAGE, offset: 0 });
        setLogs(page);
        setHasMoreLogs(page.length === LOG_PAGE);
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Unable to load this page.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(activeTab, logFilter);
  }, [activeTab, logFilter, load]);

  const loadMoreRows = async (tab: 'patients' | 'transfers') => {
    setLoadingMore(true);
    try {
      if (tab === 'patients') {
        const page = await getAdminPatients(patients.length);
        setPatients((prev) => [...prev, ...page.rows]);
        setPatientTotal(page.total);
      } else {
        const page = await getTransferRequests(transfers.length);
        setTransfers((prev) => [...prev, ...page.rows]);
        setTransferTotal(page.total);
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Unable to load more entries.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMoreLogs = async () => {
    try {
      const page = await getAuditLogs({ action: logFilter, limit: LOG_PAGE, offset: logs.length });
      setLogs((prev) => [...prev, ...page]);
      setHasMoreLogs(page.length === LOG_PAGE);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Unable to load more entries.'));
    }
  };

  // ── Important actions wait for "Are you sure?"; nothing is sent before ──

  const confirmPending = async () => {
    if (!pending) return;
    const action = pending;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (action.kind === 'authorize') {
        await authorizeTransfer(action.transfer.transfer_id);
        setNotice('Transfer authorized. The nurses of this hospital can now process it.');
      }
      if (action.kind === 'reject') {
        await rejectTransfer(action.transfer.transfer_id, action.reason);
        setRejecting(null);
        setNotice('Transfer rejected.');
      }
      if (action.kind === 'create-user') {
        const created = await createUser(userForm);
        setCreatedUser(created);
        setUserForm({ ...EMPTY_USER });
      }
      await load(activeTab, logFilter);
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, 'Unable to complete the action.'));
      if (action.kind !== 'create-user') await load(activeTab, logFilter);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const confirmText = (action: Pending) => {
    if (action.kind === 'authorize') {
      return <p>Authorize the transfer of {action.transfer.patient_name ?? 'this patient'} to {action.transfer.destination_hospital}?</p>;
    }
    if (action.kind === 'reject') {
      return <p>Reject the transfer of {action.transfer.patient_name ?? 'this patient'} to {action.transfer.destination_hospital}? This is final.</p>;
    }
    return <p>Create a {userForm.role} account for {userForm.name} ({userForm.email}) at your hospital?</p>;
  };

  // ── Tabs ────────────────────────────────────────────────────────────────

  const renderPatients = () => (
    <Card title="Patients at this hospital">
      {patients.length === 0 ? (
        <p className="text-sm py-4 text-[color:var(--text-muted)]">No patients found. Patients appear here once a nurse registers them at your hospital.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="admin-patients">
            <thead>
              <tr>
                {['Patient', 'Age / gender', 'Admitted', 'Stay prediction', 'Transfer prediction', 'Transfer request'].map((h) => (
                  <th key={h} className="text-left py-3 px-4 font-medium" style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.accident_id} onClick={() => navigate(`/admin/episodes/${p.accident_id}`)}
                  className="dark-table-row hover:bg-white/5 cursor-pointer" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="py-3 px-4 font-medium text-[color:var(--text-primary)]">
                    <button type="button" className="text-left hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/admin/episodes/${p.accident_id}`); }}>
                      {p.patient.full_name ?? 'Unknown'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-[color:var(--text-secondary)]">{p.patient.age ?? '?'} / {p.patient.gender ?? '?'}</td>
                  <td className="py-3 px-4 text-[color:var(--text-secondary)]">{p.created_at?.slice(0, 10)}</td>
                  <td className="py-3 px-4"><PredictionText view={p.stay_duration} /></td>
                  <td className="py-3 px-4"><PredictionText view={p.transfer} /></td>
                  <td className="py-3 px-4">{p.open_transfer ? <StatusBadge status={p.open_transfer.status} /> : <span className="text-[color:var(--text-muted)]">None</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ListFooter shown={patients.length} total={patientTotal} loading={loadingMore} onMore={() => loadMoreRows('patients')} noun="patients" />
    </Card>
  );

  const renderTransfers = () => (
    <Card title="Transfer requests">
      {transfers.length === 0 ? (
        <p className="text-sm py-4 text-[color:var(--text-muted)]">No transfer requests. Request a transfer from a patient's page.</p>
      ) : (
        <ul className="space-y-4">
          {transfers.map((t) => (
            <li key={t.transfer_id} className="pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <TransferSummary transfer={t} />
              {t.allowed_actions.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {t.allowed_actions.includes('authorize') && (
                    <button type="button" onClick={() => setPending({ kind: 'authorize', transfer: t })} disabled={busy}
                      className="px-3 py-1.5 text-xs gradient-btn">Authorize</button>
                  )}
                  {t.allowed_actions.includes('reject') && (rejecting?.id === t.transfer_id ? (
                    <>
                      <input aria-label="Rejection reason" value={rejecting.reason} placeholder="Reason (required)"
                        onChange={(e) => setRejecting({ id: t.transfer_id, reason: e.target.value })}
                        className="px-3 py-1.5 text-xs dark-input" />
                      <button type="button" disabled={busy || !rejecting.reason.trim()}
                        onClick={() => setPending({ kind: 'reject', transfer: t, reason: rejecting.reason.trim() })}
                        className="px-3 py-1.5 text-xs rounded-lg border" style={{ color: 'var(--tone-danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                        Reject with this reason
                      </button>
                      <button type="button" disabled={busy} onClick={() => setRejecting(null)}
                        className="px-3 py-1.5 text-xs rounded-lg border" style={{ borderColor: 'var(--border-input)', color: 'var(--text-secondary)' }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setRejecting({ id: t.transfer_id, reason: '' })} disabled={busy}
                      className="px-3 py-1.5 text-xs rounded-lg border" style={{ color: 'var(--tone-danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                      Reject
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ListFooter shown={transfers.length} total={transferTotal} loading={loadingMore} onMore={() => loadMoreRows('transfers')} noun="transfer requests" />
    </Card>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <Card title="Create staff account">
        {createdUser && (
          <Alert kind="success" message={createdUser.temporary_password
            ? `Account created for ${createdUser.email}. Temporary password (shown once): ${createdUser.temporary_password} — hand it over in person; it must be changed at first sign-in.`
            : `Account created for ${createdUser.email}. The password must be changed at first sign-in.`} />
        )}
        <form onSubmit={(e) => { e.preventDefault(); setCreatedUser(null); setPending({ kind: 'create-user' }); }} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="user-name" className={labelClass} style={labelStyle}>Name</label>
              <input id="user-name" required value={userForm.name} onChange={(e) => setUserForm((v) => ({ ...v, name: e.target.value }))} className="w-full px-4 py-2.5 text-sm dark-input" />
            </div>
            <div>
              <label htmlFor="user-email" className={labelClass} style={labelStyle}>Email</label>
              <input id="user-email" type="email" required value={userForm.email} onChange={(e) => setUserForm((v) => ({ ...v, email: e.target.value }))} className="w-full px-4 py-2.5 text-sm dark-input" />
            </div>
            <div>
              <label htmlFor="user-role" className={labelClass} style={labelStyle}>Role</label>
              <select id="user-role" value={userForm.role} onChange={(e) => setUserForm((v) => ({ ...v, role: e.target.value as StaffRole }))} className="w-full px-4 py-2.5 text-sm dark-input">
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="user-password" className={labelClass} style={labelStyle}>Initial password (optional)</label>
              <input id="user-password" type="password" minLength={8} value={userForm.password ?? ''} placeholder="Leave empty to generate one"
                onChange={(e) => setUserForm((v) => ({ ...v, password: e.target.value }))} className="w-full px-4 py-2.5 text-sm dark-input" />
            </div>
          </div>
          <p className="text-xs text-[color:var(--text-muted)]">The account is created at your hospital. The new user must set their own password at first sign-in.</p>
          <button type="submit" disabled={busy} className="py-2.5 px-6 text-sm gradient-btn">Create account</button>
        </form>
      </Card>
      <Card title="Staff at this hospital">
        {users.length === 0 ? <p className="text-sm py-4 text-[color:var(--text-muted)]">No staff accounts at this hospital yet.</p> : (
        <table className="w-full text-sm" data-testid="staff-table">
          <thead><tr>{['Name', 'Email', 'Role'].map((h) => <th key={h} className="text-left py-2 px-3 font-medium" style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td className="py-2 px-3 text-[color:var(--text-primary)]">{u.name}</td>
                <td className="py-2 px-3 text-[color:var(--text-secondary)]">{u.email}</td>
                <td className="py-2 px-3 capitalize text-[color:var(--text-secondary)]">{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </Card>
    </div>
  );

  const renderLogs = () => (
    <Card title="Audit log">
      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="log-filter" className="text-sm text-[color:var(--text-muted)]">Show</label>
        <select id="log-filter" value={logFilter} onChange={(e) => setLogFilter(e.target.value)} className="px-3 py-2 text-sm dark-input">
          {LOG_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm py-4 text-[color:var(--text-muted)]">No log entries{logFilter ? ' for this filter' : ''}.</p>
      ) : (
        <>
          <AuditLogTable logs={logs} />
          {hasMoreLogs && (
            <button type="button" onClick={loadMoreLogs} className="mt-4 px-4 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--border-input)', color: 'var(--text-secondary)' }}>
              Load more
            </button>
          )}
        </>
      )}
    </Card>
  );

  return (
    <DashboardShell>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold gradient-text">Administration</h1>

        <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <nav className="flex flex-wrap gap-0 -mb-px" role="tablist" aria-label="Administration">
            {TABS.map((tab) => (
              <button key={tab.key} type="button" role="tab" aria-selected={activeTab === tab.key} onClick={() => { setActiveTab(tab.key); setNotice(''); }}
                className="px-5 py-3 text-sm font-medium transition-all duration-200 relative"
                style={{ color: activeTab === tab.key ? 'var(--text-accent)' : 'var(--text-muted)' }}>
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: 'var(--gradient-brand)' }} />
                )}
              </button>
            ))}
          </nav>
        </div>

        {error && <Alert kind="error" message={error} />}
        {notice && <Alert kind="success" message={notice} />}
        {loading ? <LoadingSpinner /> : (
          <div className="animate-fade-in">
            {activeTab === 'patients' && renderPatients()}
            {activeTab === 'transfers' && renderTransfers()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'logs' && renderLogs()}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        confirmLabel={pending?.kind === 'create-user' ? 'Yes, create' : 'Yes, continue'}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        {pending && confirmText(pending)}
      </ConfirmDialog>
    </DashboardShell>
  );
}
