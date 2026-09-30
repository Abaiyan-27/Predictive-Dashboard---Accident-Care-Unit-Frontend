import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { PatientListItem } from '../../components/PatientListItem';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../auth/AuthContext';
import { getHospitalPatients } from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type { Patient } from '../../types';

export function DoctorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    setError('');
    getHospitalPatients(user.hospital_id)
      .then(setPatients)
      .catch((requestError: unknown) => {
        setError(getApiErrorMessage(requestError, 'Unable to load admitted patients.'));
      })
      .finally(() => setIsLoading(false));
  }, [user]);

  const handlePatientClick = (patientId: string) => {
    navigate(`/patient/${patientId}`);
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold gradient-text">Admitted patients</h1>
          <span
            className="text-sm font-medium px-3 py-1 rounded-full"
            style={{
              color: 'var(--text-accent)',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
            }}
          >
            {patients.length} patient{patients.length !== 1 ? 's' : ''}
          </span>
        </div>

        <Card>
          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-sm"
              style={{
                color: '#fca5a5',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              {error}
            </div>
          )}
          {isLoading ? (
            <LoadingSpinner />
          ) : patients.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>
              No patients found.
            </p>
          ) : (
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border-subtle)' }}
            >
              {patients.map((p) => (
                <PatientListItem
                  key={p.id}
                  patient={p}
                  badgeType="priority"
                  onClick={() => handlePatientClick(p.id)}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}
