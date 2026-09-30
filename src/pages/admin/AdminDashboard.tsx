import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { SeverityBadge } from '../../components/SeverityBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../auth/AuthContext';
import {
  getHospital,
  getHospitals,
  getAdmittedPatients,
  createUser,
  getTransferRequests,
  updateTransferStatus,
  getAuditLogs,
} from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type {
  HospitalInfo,
  Patient,
  TransferRequest,
  AuditLog,
  CreateUserPayload,
  StaffRole,
  TransferStatus,
} from '../../types';

type AdminTab = 'status' | 'users' | 'transfers' | 'logs';

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'status', label: 'Hospital status' },
  { key: 'users', label: 'User management' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'logs', label: 'System logs' },
];

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'nurse', label: 'Nurse' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'admin', label: 'Administrator' },
];

/* Shared dark-themed styling helpers */
const labelClass = "block text-sm font-medium mb-1.5";
const labelStyle = { color: 'var(--text-secondary)' };
const thStyle = {
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border-subtle)',
};

export function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('status');

  // Hospital status state
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState('');

  // User management state
  const [userForm, setUserForm] = useState<CreateUserPayload>({
    name: '',
    email: '',
    password: '',
    role: 'nurse',
    hospital_id: user?.hospital_id ?? '',
  });
  const [hospitals, setHospitals] = useState<HospitalInfo[]>([]);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userCreated, setUserCreated] = useState(false);
  const [userError, setUserError] = useState('');

  // Transfers state
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [isLoadingTransfers, setIsLoadingTransfers] = useState(true);
  const [updatingTransferId, setUpdatingTransferId] = useState<string | null>(null);
  const [transferError, setTransferError] = useState('');

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState('');

  // ── Fetch hospital status data ──────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== 'status' || !user) return;

    let cancelled = false;
    setIsLoadingStatus(true);
    setStatusError('');

    const loadStatus = async () => {
      try {
        if (user.hospital_id) {
          const [hospitalInfo, pts] = await Promise.all([
            getHospital(user.hospital_id),
            getAdmittedPatients(user.hospital_id),
          ]);
          if (!cancelled) {
            setHospital(hospitalInfo);
            setPatients(pts);
          }
          return;
        }

        const allHospitals = await getHospitals();
        const patientGroups = await Promise.all(
          allHospitals.map((item) => getAdmittedPatients(item.hospital_id)),
        );
        if (!cancelled) {
          setHospitals(allHospitals);
          setHospital({
            hospital_id: 'all',
            name: 'All hospitals',
            type: `${allHospitals.length} registered`,
            region: null,
            district: null,
            address: null,
          });
          setPatients(patientGroups.flat());
        }
      } catch (error) {
        if (!cancelled) {
          setStatusError(getApiErrorMessage(error, 'Unable to load hospital status.'));
        }
      } finally {
        if (!cancelled) setIsLoadingStatus(false);
      }
    };

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab !== 'users') return;
    setUserError('');
    getHospitals()
      .then(setHospitals)
      .catch((error: unknown) => {
        setUserError(getApiErrorMessage(error, 'Unable to load hospitals.'));
      });
  }, [activeTab]);

  // ── Fetch transfers ─────────────────────────────────────────────────────

  const fetchTransfers = useCallback(async () => {
    setIsLoadingTransfers(true);
    setTransferError('');
    try {
      const data = await getTransferRequests();
      setTransfers(data);
    } catch (error) {
      setTransferError(getApiErrorMessage(error, 'Unable to load transfer requests.'));
    } finally {
      setIsLoadingTransfers(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'transfers') {
      fetchTransfers();
    }
  }, [activeTab, fetchTransfers]);

  // ── Fetch audit logs ────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== 'logs') return;

    setIsLoadingLogs(true);
    setLogsError('');
    getAuditLogs()
      .then(setAuditLogs)
      .catch((error: unknown) => {
        setLogsError(getApiErrorMessage(error, 'Unable to load audit logs.'));
      })
      .finally(() => setIsLoadingLogs(false));
  }, [activeTab]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleUserFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setUserForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    setUserCreated(false);
    setUserError('');

    try {
      await createUser(userForm);
      setUserCreated(true);
      setUserForm({
        name: '',
        email: '',
        password: '',
        role: 'nurse',
        hospital_id: user?.hospital_id ?? '',
      });
    } catch (error) {
      setUserError(getApiErrorMessage(error, 'Unable to create the user account.'));
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleTransferAction = async (id: string, status: TransferStatus) => {
    setUpdatingTransferId(id);
    setTransferError('');
    try {
      await updateTransferStatus(id, status);
      await fetchTransfers();
    } catch (error) {
      setTransferError(getApiErrorMessage(error, 'Unable to update the transfer.'));
    } finally {
      setUpdatingTransferId(null);
    }
  };

  // ── Error/Success alert helpers ─────────────────────────────────────────

  const ErrorAlert = ({ message }: { message: string }) => (
    <div
      className="mb-4 px-4 py-3 rounded-lg text-sm"
      style={{
        color: '#fca5a5',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
      }}
    >
      {message}
    </div>
  );

  const SuccessAlert = ({ message }: { message: string }) => (
    <div
      className="mb-4 px-4 py-3 rounded-lg text-sm"
      style={{
        color: '#6ee7b7',
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
      }}
    >
      {message}
    </div>
  );

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderStatusTab = () => {
    if (isLoadingStatus) return <LoadingSpinner />;

    return (
      <div className="space-y-6 animate-fade-in">
        {statusError && <ErrorAlert message={statusError} />}
        {/* Hospital summary */}
        {hospital && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {user?.hospital_id ? 'Hospital' : 'Scope'}
              </p>
              <p className="text-lg font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                {hospital.name}
              </p>
            </Card>
            <Card>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Type</p>
              <p className="text-lg font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                {hospital.type ?? 'Not specified'}
              </p>
            </Card>
            <Card>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Current patients</p>
              <p className="text-2xl font-bold mt-1 gradient-text">
                {patients.length}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {user?.hospital_id
                  ? ([hospital.district, hospital.region].filter(Boolean).join(', ') || 'Location not specified')
                  : 'System-wide view'}
              </p>
            </Card>
          </div>
        )}

        {/* Patient table with predicted LOS */}
        <Card title="Current patients — model-predicted stay">
          {patients.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>No patients found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-3 px-4 font-medium" style={thStyle}>Name</th>
                    <th className="text-left py-3 px-4 font-medium" style={thStyle}>Admission date</th>
                    <th className="text-left py-3 px-4 font-medium" style={thStyle}>Severity</th>
                    <th className="text-right py-3 px-4 font-medium" style={thStyle}>Predicted stay</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/patient/${p.id}`)}
                      className="dark-table-row hover:bg-white/5 cursor-pointer"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{p.admission_date}</td>
                      <td className="py-3 px-4">
                        <SeverityBadge value={p.severity} />
                      </td>
                      <td className="py-3 px-4 text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                        {p.predicted_los ?? 'Unavailable'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderUsersTab = () => (
    <div className="animate-fade-in">
      <Card title="Create new user">
        {userCreated && <SuccessAlert message="User account created successfully." />}
        {userError && <ErrorAlert message={userError} />}
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="user-name" className={labelClass} style={labelStyle}>Name</label>
              <input id="user-name" name="name" type="text" required value={userForm.name}
                onChange={handleUserFormChange} className="w-full px-4 py-2.5 text-sm dark-input" />
            </div>
            <div>
              <label htmlFor="user-email" className={labelClass} style={labelStyle}>Email</label>
              <input id="user-email" name="email" type="email" required value={userForm.email}
                onChange={handleUserFormChange} className="w-full px-4 py-2.5 text-sm dark-input" />
            </div>
            <div>
              <label htmlFor="user-password" className={labelClass} style={labelStyle}>Temporary password</label>
              <input id="user-password" name="password" type="password" minLength={8} required
                value={userForm.password} onChange={handleUserFormChange}
                className="w-full px-4 py-2.5 text-sm dark-input" placeholder="At least 8 characters" />
            </div>
            <div>
              <label htmlFor="user-role" className={labelClass} style={labelStyle}>Role</label>
              <select id="user-role" name="role" value={userForm.role} onChange={handleUserFormChange}
                className="w-full px-4 py-2.5 text-sm dark-input">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="user-hospital" className={labelClass} style={labelStyle}>Hospital</label>
              <select id="user-hospital" name="hospital_id" required value={userForm.hospital_id}
                onChange={handleUserFormChange} className="w-full px-4 py-2.5 text-sm dark-input">
                <option value="">Select hospital</option>
                {hospitals.map((item) => (
                  <option key={item.hospital_id} value={item.hospital_id}>{item.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" disabled={isCreatingUser} className="py-2.5 px-6 text-sm gradient-btn">
            {isCreatingUser ? 'Creating...' : 'Create user'}
          </button>
        </form>
      </Card>
    </div>
  );

  const renderTransfersTab = () => {
    if (isLoadingTransfers) return <LoadingSpinner />;

    return (
      <div className="animate-fade-in">
        <Card title="Transfer requests">
          {transferError && <ErrorAlert message={transferError} />}
          {transfers.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>No transfer requests.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-3 px-4 font-medium" style={thStyle}>Patient</th>
                    <th className="text-left py-3 px-4 font-medium" style={thStyle}>Source</th>
                    <th className="text-left py-3 px-4 font-medium" style={thStyle}>Destination</th>
                    <th className="text-left py-3 px-4 font-medium" style={thStyle}>Status</th>
                    <th className="text-right py-3 px-4 font-medium" style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr
                      key={t.id}
                      className="dark-table-row"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{t.patient_name}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{t.source_hospital}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{t.destination_hospital}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {t.status === 'pending_authorization' || t.status === 'authorized' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleTransferAction(
                                t.id,
                                t.status === 'pending_authorization' ? 'authorized' : 'approved',
                              )}
                              disabled={updatingTransferId === t.id}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 disabled:opacity-50"
                              style={{
                                color: '#6ee7b7',
                                background: 'rgba(16, 185, 129, 0.12)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
                                e.currentTarget.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.15)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.12)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              {t.status === 'pending_authorization' ? 'Authorize' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleTransferAction(t.id, 'rejected')}
                              disabled={updatingTransferId === t.id}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 disabled:opacity-50"
                              style={{
                                color: '#fca5a5',
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                e.currentTarget.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.15)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No actions</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderLogsTab = () => {
    if (isLoadingLogs) return <LoadingSpinner />;

    return (
      <div className="animate-fade-in">
        <Card title="Audit log">
          {logsError && <ErrorAlert message={logsError} />}
          {auditLogs.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>No log entries.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-3 px-4 font-medium" style={thStyle}>User</th>
                    <th className="text-left py-3 px-4 font-medium" style={thStyle}>Role</th>
                    <th className="text-left py-3 px-4 font-medium" style={thStyle}>Action</th>
                    <th className="text-left py-3 px-4 font-medium" style={thStyle}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="dark-table-row"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{log.user}</td>
                      <td className="py-3 px-4 capitalize" style={{ color: 'var(--text-secondary)' }}>{log.role}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{log.action}</td>
                      <td className="py-3 px-4 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'status':
        return renderStatusTab();
      case 'users':
        return renderUsersTab();
      case 'transfers':
        return renderTransfersTab();
      case 'logs':
        return renderLogsTab();
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold gradient-text">Administration</h1>

        {/* Tab navigation */}
        <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <nav className="flex gap-0 -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-5 py-3 text-sm font-medium transition-all duration-200 relative"
                style={{
                  color: activeTab === tab.key ? 'var(--text-accent)' : 'var(--text-muted)',
                  borderBottom: activeTab === tab.key
                    ? '2px solid transparent'
                    : '2px solid transparent',
                  backgroundImage: activeTab === tab.key ? 'none' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.key) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.key) {
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: 'var(--gradient-brand)' }}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        {renderActiveTab()}
      </div>
    </DashboardShell>
  );
}
