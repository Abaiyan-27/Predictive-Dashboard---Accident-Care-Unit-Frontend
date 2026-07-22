import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { SeverityBadge } from '../../components/SeverityBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { getPatientById, getPatientPrognosis } from '../../api';
import type { Patient, Prognosis } from '../../types';

export function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [prognosis, setPrognosis] = useState<Prognosis | null>(null);
  const [isLoadingPatient, setIsLoadingPatient] = useState(true);
  const [isLoadingPrognosis, setIsLoadingPrognosis] = useState(true);

  useEffect(() => {
    if (!id) return;

    setIsLoadingPatient(true);
    setIsLoadingPrognosis(true);

    getPatientById(id)
      .then((data) => {
        setPatient(data ?? null);
      })
      .catch(() => {})
      .finally(() => setIsLoadingPatient(false));

    getPatientPrognosis(id)
      .then(setPrognosis)
      .catch(() => {})
      .finally(() => setIsLoadingPrognosis(false));
  }, [id]);

  if (isLoadingPatient) {
    return (
      <DashboardShell>
        <LoadingSpinner />
      </DashboardShell>
    );
  }

  if (!patient) {
    return (
      <DashboardShell>
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">Patient not found.</p>
          <button
            onClick={() => navigate('/doctor')}
            className="mt-4 text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            Back to patient list
          </button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => navigate('/doctor')}
          className="text-sm text-purple-600 hover:text-purple-700 font-medium"
        >
          &larr; Back to patient list
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Patient record */}
          <Card title="Patient record">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-gray-900">{patient.name}</h3>
                <SeverityBadge value={patient.severity} />
              </div>

              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <div>
                  <span className="text-gray-500">Age</span>
                  <p className="font-medium text-gray-900">{patient.age}</p>
                </div>
                <div>
                  <span className="text-gray-500">Gender</span>
                  <p className="font-medium text-gray-900">{patient.gender}</p>
                </div>
                <div>
                  <span className="text-gray-500">Admission date</span>
                  <p className="font-medium text-gray-900">{patient.admission_date}</p>
                </div>
                <div>
                  <span className="text-gray-500">Collision type</span>
                  <p className="font-medium text-gray-900">{patient.collision_type}</p>
                </div>
              </div>

              <div>
                <span className="text-sm text-gray-500">Injury description</span>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {patient.injury_description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm pt-2 border-t border-gray-100">
                <div>
                  <span className="text-gray-500">Priority</span>
                  <div className="mt-1">
                    <SeverityBadge value={patient.priority} />
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Predicted length of stay</span>
                  <p className="font-medium text-gray-900">{patient.predicted_los_days} days</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Prognosis panel */}
          <Card title="Prognosis panel">
            {isLoadingPrognosis ? (
              <LoadingSpinner />
            ) : prognosis ? (
              <div className="space-y-5">
                <div>
                  <span className="text-sm text-gray-500">Expected recovery level</span>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {prognosis.expected_recovery_level}
                  </p>
                </div>

                <div>
                  <span className="text-sm text-gray-500">Partial recovery probability</span>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-900">
                        {prognosis.partial_recovery_probability}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-600 rounded-full transition-all duration-500"
                        style={{ width: `${prognosis.partial_recovery_probability}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <span className="text-sm text-gray-500">Transfer recommendation</span>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {prognosis.transfer_recommendation}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4">Prognosis data unavailable.</p>
            )}
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
