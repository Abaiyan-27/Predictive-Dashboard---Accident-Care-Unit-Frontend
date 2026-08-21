import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { SeverityBadge } from '../../components/SeverityBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { createTreatment, getPatientById, getPatientPrognosis } from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type { ModelPrediction, Patient, Prognosis, TreatmentPayload } from '../../types';

const INVESTIGATION_OPTIONS = [
  'x-ray',
  'ct scan',
  'mri scan',
  'ultrasound scan',
  'others',
];

const PRIMARY_MANAGEMENT_OPTIONS = [
  'wound suturing',
  'fracture stabilization',
  'wound cleaning and dressing',
  'wound debridement',
  'only medicine and discharge',
  'informed to jmo / police',
  'observation for head injury',
  'ligamental injury management',
  'reduction done for left elbow joint dislocation',
  'surgery',
  'duration of hospital stay',
  'others',
];

const SECONDARY_MANAGEMENT_OPTIONS = [
  'no other management',
  'wound suturing',
  'fracture stabilization',
  'wound cleaning and dressing',
  'wound debridement',
  'only medicine and discharge',
  'informed to jmo / police',
  'imaging',
  'pain management',
  'pop applied',
  'strict bed rest',
  'surgery',
  'duration of hospital stay',
  'x ray (right hand)',
  'others',
];

function PredictionResult({ title, value }: { title: string; value: ModelPrediction }) {
  return (
    <div className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="font-semibold text-gray-900 mt-1">{value.prediction ?? 'Unavailable'}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded border ${
          value.status === 'OK'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : value.status === 'LOW_CONFIDENCE'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-gray-50 text-gray-600 border-gray-200'
        }`}>
          {value.status}
        </span>
      </div>
      {Object.keys(value.probabilities).length > 0 && (
        <div className="mt-3 space-y-2">
          {Object.entries(value.probabilities).map(([label, probability]) => (
            <div key={label}>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>{label}</span>
                <span>{Math.round(probability * 100)}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                <div className="h-full bg-purple-600" style={{ width: `${probability * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {value.message && <p className="text-xs text-gray-500 mt-2">{value.message}</p>}
      <p className="text-xs text-gray-400 mt-2">
        {value.model_name}{value.model_version ? ` · ${value.model_version}` : ''}
        {` · ${Math.round(value.completeness * 100)}% of model inputs available`}
      </p>
    </div>
  );
}

export function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [prognosis, setPrognosis] = useState<Prognosis | null>(null);
  const [isLoadingPatient, setIsLoadingPatient] = useState(true);
  const [isLoadingPrognosis, setIsLoadingPrognosis] = useState(true);
  const [patientError, setPatientError] = useState('');
  const [prognosisError, setPrognosisError] = useState('');
  const [treatmentError, setTreatmentError] = useState('');
  const [treatmentSaved, setTreatmentSaved] = useState(false);
  const [isSavingTreatment, setIsSavingTreatment] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState<Omit<TreatmentPayload, 'accident_id' | 'hospital_id'>>({
    number_of_days_stay: null,
    investigation_done: '',
    management_name_1: '',
    management_name_2: '',
  });

  useEffect(() => {
    if (!id) return;

    setIsLoadingPatient(true);
    setIsLoadingPrognosis(true);
    setPatientError('');
    setPrognosisError('');

    getPatientById(id)
      .then((data) => {
        setPatient(data ?? null);
      })
      .catch((requestError: unknown) => {
        setPatientError(getApiErrorMessage(requestError, 'Unable to load the patient.'));
      })
      .finally(() => setIsLoadingPatient(false));

    getPatientPrognosis(id)
      .then(setPrognosis)
      .catch((requestError: unknown) => {
        setPrognosisError(getApiErrorMessage(requestError, 'Unable to load prognosis data.'));
      })
      .finally(() => setIsLoadingPrognosis(false));
  }, [id]);

  const handleTreatmentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!patient || !id) return;
    setIsSavingTreatment(true);
    setTreatmentError('');
    setTreatmentSaved(false);
    try {
      await createTreatment({
        ...treatmentForm,
        accident_id: patient.accident_id,
        hospital_id: patient.hospital_id,
      });
      setTreatmentSaved(true);
      setPrognosis(await getPatientPrognosis(id));
    } catch (error) {
      setTreatmentError(getApiErrorMessage(error, 'Unable to save treatment details.'));
    } finally {
      setIsSavingTreatment(false);
    }
  };

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
          <p className="text-sm text-gray-500">{patientError || 'Patient not found.'}</p>
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
              <p className="text-xs text-gray-500">
                Severity model: {patient.severity_prediction.status}
                {patient.severity_prediction.probability !== null
                  ? ` · ${Math.round(patient.severity_prediction.probability * 100)}% escalated-care probability`
                  : ''}
              </p>

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
                  <p className="font-medium text-gray-900">{patient.predicted_los ?? 'Unavailable'}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Prognosis panel */}
          <Card title="Prognosis panel">
            {isLoadingPrognosis ? (
              <LoadingSpinner />
            ) : prognosis ? (
              <div className="space-y-4">
                <PredictionResult title="Discharge outcome" value={prognosis.discharge} />
                <PredictionResult title="Transfer assessment" value={prognosis.transfer} />
                <PredictionResult title="Predicted stay" value={prognosis.stay_duration} />
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4">
                {prognosisError || 'Prognosis data unavailable.'}
              </p>
            )}
          </Card>
        </div>

        <Card title="Record treatment data for discharge prediction">
          <p className="mb-4 text-xs text-gray-500">
            Fields marked <span className="font-semibold text-red-500">*</span> are required
            model inputs.
          </p>
          {treatmentSaved && (
            <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
              Treatment saved and predictions refreshed.
            </p>
          )}
          {treatmentError && (
            <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {treatmentError}
            </p>
          )}
          <form onSubmit={handleTreatmentSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="number_of_days_stay" className="block text-sm text-gray-600 mb-1">Days stayed <span className="text-red-500" aria-hidden="true">*</span></label>
                <input id="number_of_days_stay" type="number" min={0} step={1} required value={treatmentForm.number_of_days_stay ?? ''}
                  onChange={(event) => setTreatmentForm((value) => ({ ...value, number_of_days_stay: event.target.value === '' ? null : Number(event.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded" />
              </div>
              <div>
                <label htmlFor="investigation_done" className="block text-sm text-gray-600 mb-1">Investigation <span className="text-red-500" aria-hidden="true">*</span></label>
                <select id="investigation_done" required value={treatmentForm.investigation_done}
                  onChange={(event) => setTreatmentForm((value) => ({ ...value, investigation_done: event.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white">
                  <option value="">Select investigation</option>
                  {INVESTIGATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="management_name_1" className="block text-sm text-gray-600 mb-1">Primary management <span className="text-red-500" aria-hidden="true">*</span></label>
                <select id="management_name_1" required value={treatmentForm.management_name_1}
                  onChange={(event) => setTreatmentForm((value) => ({ ...value, management_name_1: event.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white">
                  <option value="">Select primary management</option>
                  {PRIMARY_MANAGEMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="management_name_2" className="block text-sm text-gray-600 mb-1">Secondary management</label>
                <select id="management_name_2" value={treatmentForm.management_name_2}
                  onChange={(event) => setTreatmentForm((value) => ({ ...value, management_name_2: event.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white">
                  <option value="">No secondary management recorded</option>
                  {SECONDARY_MANAGEMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" disabled={isSavingTreatment}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded disabled:opacity-50">
              {isSavingTreatment ? 'Saving...' : 'Save treatment and refresh predictions'}
            </button>
          </form>
        </Card>
      </div>
    </DashboardShell>
  );
}
