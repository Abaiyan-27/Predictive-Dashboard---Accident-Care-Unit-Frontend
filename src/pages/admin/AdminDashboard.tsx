import { useState, useEffect, useCallback } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { SeverityBadge } from '../../components/SeverityBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../auth/AuthContext';
import {
  getHospitalStatus,
  getAdmittedPatients,
  createUser,
  getTransferRequests,
  updateTransferStatus,
  getAuditLogs,
} from '../../api';
import type {
  HospitalStatus,
  Patient,
  TransferRequest,
  AuditLog,
  CreateUserPayload,
  Role,
  TransferStatus,
} from '../../types';

type AdminTab = 'status' | 'users' | 'transfers' | 'logs';

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'status', label: 'Hospital status' },
  { key: 'users', label: 'User management' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'logs', label: 'System logs' },
];

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'nurse', label: 'Nurse' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'admin', label: 'Administrator' },
];

export function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('status');

  // Hospital status state
  const [hospitalStatus, setHospitalStatus] = useState<HospitalStatus | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // User management state
  const [userForm, setUserForm] = useState<CreateUserPayload>({
    name: '',
    email: '',
    role: 'nurse',
    hospital_id: '',
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userCreated, setUserCreated] = useState(false);

  // Transfers state
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [isLoadingTransfers, setIsLoadingTransfers] = useState(true);
  const [updatingTransferId, setUpdatingTransferId] = useState<string | null>(null);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // ── Fetch hospital status data ──────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== 'status' || !user) return;

    setIsLoadingStatus(true);
    Promise.all([
      getHospitalStatus(),
      getAdmittedPatients(user.hospital_id),
    ])
      .then(([status, pts]) => {
        setHospitalStatus(status);
        setPatients(pts);
      })
      .catch(() => {})
      .finally(() => setIsLoadingStatus(false));
  }, [activeTab, user]);

  // ── Fetch transfers ─────────────────────────────────────────────────────

  const fetchTransfers = useCallback(async () => {
    setIsLoadingTransfers(true);
    try {
      const data = await getTransferRequests();
      setTransfers(data);
    } catch {
      // silently handle
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
    getAuditLogs()
      .then(setAuditLogs)
      .catch(() => {})
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

    try {
      await createUser(userForm);
      setUserCreated(true);
      setUserForm({ name: '', email: '', role: 'nurse', hospital_id: '' });
    } catch {
      // Handle error
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleTransferAction = async (id: string, status: TransferStatus) => {
    setUpdatingTransferId(id);
    try {
      await updateTransferStatus(id, status);
      await fetchTransfers();
    } catch {
      // Handle error
    } finally {
      setUpdatingTransferId(null);
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderStatusTab = () => {
    if (isLoadingStatus) return <LoadingSpinner />;

    return (
      <div className="space-y-6">
        {/* Bed capacity summary */}
        {hospitalStatus && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <p className="text-sm text-gray-500">Total beds</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {hospitalStatus.total_beds}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Occupied</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {hospitalStatus.occupied_beds}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Available</p>
              <p className="text-2xl font-semibold text-emerald-700 mt-1">
                {hospitalStatus.available_beds}
              </p>
            </Card>
          </div>
        )}

        {/* Patient table with predicted LOS */}
        <Card title="Current patients — predicted length of stay">
          {patients.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No patients found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Admission date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Severity</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Predicted LOS (days)</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 last:border-b-0">
                      <td className="py-3 px-4 font-medium text-gray-900">{p.name}</td>
                      <td className="py-3 px-4 text-gray-600">{p.admission_date}</td>
                      <td className="py-3 px-4">
                        <SeverityBadge value={p.severity} />
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        {p.predicted_los_days}
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
    <Card title="Create new user">
      {userCreated && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-700">
          User account created successfully.
        </div>
      )}
      <form onSubmit={handleCreateUser} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="user-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="user-name"
              name="name"
              type="text"
              required
              value={userForm.name}
              onChange={handleUserFormChange}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div>
            <label htmlFor="user-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="user-email"
              name="email"
              type="email"
              required
              value={userForm.email}
              onChange={handleUserFormChange}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div>
            <label htmlFor="user-role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id="user-role"
              name="role"
              value={userForm.role}
              onChange={handleUserFormChange}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="user-hospital" className="block text-sm font-medium text-gray-700 mb-1">
              Hospital ID
            </label>
            <input
              id="user-hospital"
              name="hospital_id"
              type="text"
              required
              value={userForm.hospital_id}
              onChange={handleUserFormChange}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="e.g. h-001"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isCreatingUser}
          className="py-2 px-6 text-sm font-medium text-white bg-purple-600 rounded hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCreatingUser ? 'Creating...' : 'Create user'}
        </button>
      </form>
    </Card>
  );

  const renderTransfersTab = () => {
    if (isLoadingTransfers) return <LoadingSpinner />;

    return (
      <Card title="Transfer requests">
        {transfers.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No transfer requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Patient</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Source</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Destination</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-b-0">
                    <td className="py-3 px-4 font-medium text-gray-900">{t.patient_name}</td>
                    <td className="py-3 px-4 text-gray-600">{t.source_hospital}</td>
                    <td className="py-3 px-4 text-gray-600">{t.destination_hospital}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {t.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleTransferAction(t.id, 'approved')}
                            disabled={updatingTransferId === t.id}
                            className="px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleTransferAction(t.id, 'rejected')}
                            disabled={updatingTransferId === t.id}
                            className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No actions</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  };

  const renderLogsTab = () => {
    if (isLoadingLogs) return <LoadingSpinner />;

    return (
      <Card title="Audit log">
        {auditLogs.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No log entries.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">User</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Action</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 last:border-b-0">
                    <td className="py-3 px-4 font-medium text-gray-900">{log.user}</td>
                    <td className="py-3 px-4 text-gray-600 capitalize">{log.role}</td>
                    <td className="py-3 px-4 text-gray-600">{log.action}</td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
        <h1 className="text-xl font-semibold text-gray-900">Administration</h1>

        {/* Tab navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-0 -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
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
