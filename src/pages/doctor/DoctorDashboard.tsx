import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { PatientListItem } from '../../components/PatientListItem';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ListFooter } from '../../components/ListFooter';
import { SeverityBadge } from '../../components/SeverityBadge';
import { useAuth } from '../../auth/AuthContext';
import { getHospitalPatients } from '../../api';
import { getApiErrorMessage } from '../../api/client';
import { SEVERITY_STATES } from '../../contracts/severity';
import type { DoctorModelKey, DoctorModelState, Patient } from '../../types';

const MODEL_SHORT: Record<DoctorModelKey, string> = {
  stay_duration: 'Stay', transfer: 'Transfer', discharge: 'Discharge',
};

/** Short state text when there is no current prediction (out-of-date ones are not sent). */
const STATE_SHORT: Partial<Record<DoctorModelState, string>> = {
  WAITING_FOR_INPUTS: 'waiting for inputs',
  NOT_RUN: 'new prediction needed',
  PREDICTION_FAILED: 'prediction failed',
};

/** One line per patient: each doctor model's final decision, else its prediction, else its state. */
function DoctorSummary({ patient }: { patient: Patient }) {
  const summary = patient.doctor_workflow;
  if (!summary) return null;
  if (!summary.treatment_recorded) {
    return <p className="text-xs mt-1 text-[color:var(--text-muted)]">No treatment recorded yet</p>;
  }
  return (
    <p className="text-xs mt-1 text-[color:var(--text-muted)]">
      {(Object.keys(MODEL_SHORT) as DoctorModelKey[]).map((key) => {
        const model = summary.models[key];
        const text = model.final_decision ? `${model.final_decision} (decided)`
          : model.prediction ? `${model.prediction} (to review)` : STATE_SHORT[model.state] ?? 'waiting';
        return `${MODEL_SHORT[key]}: ${text}`;
      }).join(' · ')}
    </p>
  );
}

/** Severity column: the nurse's final decision when there is one, else the model's prediction. */
function SeverityColumn({ patient }: { patient: Patient }) {
  const severity = patient.severity_workflow;
  const label = severity?.final_severity ?? (severity?.prediction && !severity.prediction.stale ? severity.prediction.prediction : null);
  if (!label) {
    return <span className="text-xs text-[color:var(--text-muted)]">Severity: {severity ? SEVERITY_STATES[severity.state] : 'Not yet run'}</span>;
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-[10px] uppercase tracking-wide text-[color:var(--text-muted)]">
        {severity?.final_severity ? 'Nurse decision' : 'Severity model'}
      </span>
      <SeverityBadge value={label} />
    </div>
  );
}

export function DoctorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    setError('');
    getHospitalPatients(user.hospital_id)
      .then((page) => { setPatients(page.rows); setTotal(page.total); })
      .catch((requestError: unknown) => {
        setError(getApiErrorMessage(requestError, 'Unable to load admitted patients.'));
      })
      .finally(() => setIsLoading(false));
  }, [user]);

  const loadMore = async () => {
    if (!user) return;
    setLoadingMore(true);
    try {
      const page = await getHospitalPatients(user.hospital_id, patients.length);
      setPatients((prev) => [...prev, ...page.rows]);
      setTotal(page.total);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load more patients.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePatientClick = (accidentId: string) => {
    navigate(`/doctor/episodes/${accidentId}`);
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold gradient-text">Admitted patients</h1>
          {!isLoading && !error && <span
            className="text-sm font-medium px-3 py-1 rounded-full"
            style={{
              color: 'var(--text-accent)',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
            }}
          >
            {total} patient{total !== 1 ? 's' : ''}
          </span>}
        </div>

        <Card>
          <p className="mb-4 text-xs text-[color:var(--text-muted)]">
            Select a patient to review
          </p>
          {error && (
            <div
              role="alert"
              className="mb-4 px-4 py-3 rounded-lg text-sm"
              style={{
                color: 'var(--tone-danger)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              {error}
            </div>
          )}
          {isLoading ? (
            <LoadingSpinner />
          ) : error ? null : patients.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>
              No patients found. Patients appear here once a nurse registers them at your hospital.
            </p>
          ) : (
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border-subtle)' }}
            >
              {patients.map((p) => (
                <PatientListItem
                  key={p.accident_id}
                  patient={p}
                  onClick={() => handlePatientClick(p.accident_id)}
                  details={<DoctorSummary patient={p} />}
                  badge={<SeverityColumn patient={p} />}
                />
              ))}
            </div>
          )}
          {!isLoading && !error && <ListFooter shown={patients.length} total={total} loading={loadingMore} onMore={loadMore} noun="patients" />}
        </Card>
      </div>
    </DashboardShell>
  );
}
