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
    navigate(`/doctor/patient/${patientId}`);
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Admitted patients</h1>
          <p className="text-sm text-gray-500">
            {patients.length} patient{patients.length !== 1 ? 's' : ''}
          </p>
        </div>

        <Card>
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}
          {isLoading ? (
            <LoadingSpinner />
          ) : patients.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No patients found.</p>
          ) : (
            <div className="border border-gray-100 rounded overflow-hidden">
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
