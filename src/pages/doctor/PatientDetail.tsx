import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { SeverityBadge } from '../../components/SeverityBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { createTreatment, getPatientById, getPatientPrognosis, getExplanation } from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type { ModelPrediction, Patient, Prognosis, TreatmentPayload, XAIExplanation } from '../../types';

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

function PredictionResult({ 
  title, 
  value, 
  onExplain, 
  isExplaining, 
  explanationData 
}: { 
  title: string; 
  value: ModelPrediction;
  onExplain?: (model: string) => void;
  isExplaining?: boolean;
  explanationData?: XAIExplanation | null;
}) {
  return (
    <div
      className="pb-4 last:pb-0"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{title}</p>
          <p className="font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
            {value.prediction ?? 'Unavailable'}
          </p>
        </div>
        <span
          className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{
            background: value.status === 'OK'
              ? 'rgba(16, 185, 129, 0.15)'
              : value.status === 'LOW_CONFIDENCE'
                ? 'rgba(245, 158, 11, 0.15)'
                : 'rgba(100, 116, 139, 0.15)',
            color: value.status === 'OK'
              ? '#6ee7b7'
              : value.status === 'LOW_CONFIDENCE'
                ? '#fcd34d'
                : '#94a3b8',
            border: `1px solid ${
              value.status === 'OK'
                ? 'rgba(16, 185, 129, 0.3)'
                : value.status === 'LOW_CONFIDENCE'
                  ? 'rgba(245, 158, 11, 0.3)'
                  : 'rgba(100, 116, 139, 0.3)'
            }`,
          }}
        >
          {value.status}
        </span>
      </div>
      {Object.keys(value.probabilities).length > 0 && (
        <div className="mt-3 space-y-2.5">
          {Object.entries(value.probabilities).map(([label, probability]) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color: 'var(--text-accent)' }}>{Math.round(probability * 100)}%</span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: 'rgba(100, 116, 139, 0.15)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${probability * 100}%`,
                    background: 'var(--gradient-brand)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {value.message && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{value.message}</p>
      )}
      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
        {value.model_name}{value.model_version ? ` · ${value.model_version}` : ''}
        {` · ${Math.round(value.completeness * 100)}% of model inputs available`}
      </p>
      
      {['discharge', 'stay_duration', 'transfer'].includes(value.model_name) && onExplain && (
        <div className="mt-3">
          <button
            onClick={() => onExplain(value.model_name)}
            disabled={isExplaining}
            className="text-xs px-3 py-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/20 disabled:opacity-50"
          >
            {isExplaining ? 'Generating Explanation...' : 'Explain AI Prediction'}
          </button>
        </div>
      )}
      
      {explanationData && explanationData.model === value.model_name && (
        <div className="mt-4 p-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
          <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>AI Explanation</h4>
          {explanationData.message && <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{explanationData.message}</p>}
          {explanationData.hinge_message && <p className="text-sm mb-4" style={{ color: 'var(--text-accent)' }}>{explanationData.hinge_message}</p>}
          
          {explanationData.value_of_information_ranking && explanationData.value_of_information_ranking.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Missing Data Impact (Value of Information)</h5>
              <div className="space-y-2">
                {explanationData.value_of_information_ranking.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>{item.field.replace(/_/g, ' ')}</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>+{item.expected_reduction_bits.toFixed(2)} bits</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {explanationData.counterfactual_ranking && explanationData.counterfactual_ranking.length > 0 && (
            <div>
              <h5 className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Key Deciding Factors (Counterfactuals)</h5>
              <div className="space-y-2">
                {explanationData.counterfactual_ranking.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>{item.field.replace(/_/g, ' ')}</span>
                    <span className="font-mono text-xs" style={{ color: item.any_flip ? '#f87171' : 'var(--text-muted)' }}>
                      {item.any_flip ? 'Critical Factor' : 'Secondary Factor'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
  const [explainingModel, setExplainingModel] = useState<string | null>(null);
  const [explanationData, setExplanationData] = useState<XAIExplanation | null>(null);
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

  const handleExplain = async (modelName: string) => {
    if (!patient?.accident_id) return;
    try {
      setExplainingModel(modelName);
      const data = await getExplanation(modelName, patient.accident_id);
      setExplanationData(data);
    } catch (err) {
      alert(getApiErrorMessage(err, 'Failed to fetch explanation.'));
    } finally {
      setExplainingModel(null);
    }
  };

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
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {patientError || 'Patient not found.'}
          </p>
          <button
            onClick={() => navigate('/doctor')}
            className="mt-4 text-sm font-medium"
            style={{ color: 'var(--text-accent)' }}
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
          className="text-sm font-medium transition-colors duration-200"
          style={{ color: 'var(--text-accent)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#c4b5fd'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-accent)'; }}
        >
          &larr; Back to patient list
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Patient record */}
          <Card title="Patient record">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {patient.name}
                </h3>
                <SeverityBadge value={patient.severity} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Severity model: {patient.severity_prediction.status}
                {patient.severity_prediction.probability !== null
                  ? ` · ${Math.round(patient.severity_prediction.probability * 100)}% escalated-care probability`
                  : ''}
              </p>

              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Age</span>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{patient.age}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Gender</span>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{patient.gender}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Admission date</span>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{patient.admission_date}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Collision type</span>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{patient.collision_type}</p>
                </div>
              </div>

              <div>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Injury description</span>
                <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>
                  {patient.injury_description}
                </p>
              </div>

              <div
                className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm pt-3"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Priority</span>
                  <div className="mt-1">
                    <SeverityBadge value={patient.priority} />
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Predicted length of stay</span>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {patient.predicted_los ?? 'Unavailable'}
                  </p>
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
                <PredictionResult title="Discharge outcome" value={prognosis.discharge} onExplain={handleExplain} isExplaining={explainingModel === prognosis.discharge.model_name} explanationData={explanationData} />
                <PredictionResult title="Transfer assessment" value={prognosis.transfer} onExplain={handleExplain} isExplaining={explainingModel === prognosis.transfer.model_name} explanationData={explanationData} />
                <PredictionResult title="Predicted stay" value={prognosis.stay_duration} onExplain={handleExplain} isExplaining={explainingModel === prognosis.stay_duration.model_name} explanationData={explanationData} />
              </div>
            ) : (
              <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>
                {prognosisError || 'Prognosis data unavailable.'}
              </p>
            )}
          </Card>
        </div>

        <Card title="Record treatment data for discharge prediction">
          <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            Fields marked <span className="font-semibold" style={{ color: '#f87171' }}>*</span> are required
            model inputs.
          </p>
          {treatmentSaved && (
            <p
              className="mb-4 text-sm rounded-lg px-4 py-3"
              style={{
                color: '#6ee7b7',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              Treatment saved and predictions refreshed.
            </p>
          )}
          {treatmentError && (
            <p
              className="mb-4 text-sm rounded-lg px-4 py-3"
              style={{
                color: '#fca5a5',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              {treatmentError}
            </p>
          )}
          <form onSubmit={handleTreatmentSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="number_of_days_stay" className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Days stayed <span style={{ color: '#f87171' }} aria-hidden="true">*</span>
                </label>
                <input id="number_of_days_stay" type="number" min={0} step={1} required
                  value={treatmentForm.number_of_days_stay ?? ''}
                  onChange={(event) => setTreatmentForm((value) => ({
                    ...value,
                    number_of_days_stay: event.target.value === '' ? null : Number(event.target.value),
                  }))}
                  className="w-full px-4 py-2.5 text-sm dark-input"
                />
              </div>
              <div>
                <label htmlFor="investigation_done" className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Investigation <span style={{ color: '#f87171' }} aria-hidden="true">*</span>
                </label>
                <select id="investigation_done" required value={treatmentForm.investigation_done}
                  onChange={(event) => setTreatmentForm((value) => ({ ...value, investigation_done: event.target.value }))}
                  className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Select investigation</option>
                  {INVESTIGATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="management_name_1" className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Primary management <span style={{ color: '#f87171' }} aria-hidden="true">*</span>
                </label>
                <select id="management_name_1" required value={treatmentForm.management_name_1}
                  onChange={(event) => setTreatmentForm((value) => ({ ...value, management_name_1: event.target.value }))}
                  className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">Select primary management</option>
                  {PRIMARY_MANAGEMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="management_name_2" className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Secondary management
                </label>
                <select id="management_name_2" value={treatmentForm.management_name_2}
                  onChange={(event) => setTreatmentForm((value) => ({ ...value, management_name_2: event.target.value }))}
                  className="w-full px-4 py-2.5 text-sm dark-input">
                  <option value="">No secondary management recorded</option>
                  {SECONDARY_MANAGEMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" disabled={isSavingTreatment}
              className="px-6 py-2.5 text-sm gradient-btn">
              {isSavingTreatment ? 'Saving...' : 'Save treatment and refresh predictions'}
            </button>
          </form>
        </Card>
      </div>
    </DashboardShell>
  );
}
