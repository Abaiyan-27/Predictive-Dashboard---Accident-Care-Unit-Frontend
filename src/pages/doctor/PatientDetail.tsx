import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { SeverityBadge } from '../../components/SeverityBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../auth/AuthContext';
import { createTreatment, getPatientById, getPatientPrognosis, getExplanation } from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type { ModelPrediction, Patient, Prognosis, TreatmentPayload, XAIExplanation } from '../../types';

const INVESTIGATION_OPTIONS = [
  'x-ray', 'ct scan', 'mri scan', 'ultrasound scan', 'others',
];

const PRIMARY_MANAGEMENT_OPTIONS = [
  'wound suturing', 'fracture stabilization', 'wound cleaning and dressing', 'wound debridement',
  'only medicine and discharge', 'informed to jmo / police', 'observation for head injury',
  'ligamental injury management', 'reduction done for left elbow joint dislocation', 'surgery',
  'duration of hospital stay', 'others',
];

const SECONDARY_MANAGEMENT_OPTIONS = [
  'no other management', ...PRIMARY_MANAGEMENT_OPTIONS.filter((o) => o !== 'others' && o !== 'duration of hospital stay'),
  'imaging', 'pain management', 'pop applied', 'strict bed rest', 'x ray (right hand)', 'others'
];

/* ── Probability bar ──────────────────────────────────────────────────────── */

function ProbabilityBar({ label, probability }: { label: string; probability: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--text-accent)' }}>{Math.round(probability * 100)}%</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(100, 116, 139, 0.15)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${probability * 100}%`, background: 'var(--gradient-brand)' }} />
      </div>
    </div>
  );
}

/* ── XAI Explanation panel ────────────────────────────────────────────────── */

function ExplanationPanel({ data }: { data: XAIExplanation }) {
  return (
    <div className="mt-6 p-5 rounded-xl border border-blue-500/30 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
      <h4 className="text-sm font-semibold mb-3 text-blue-400 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
        AI Explanation
      </h4>
      <div className="space-y-2">
        {data.doctor_explanation?.map((line, idx) => (
          <p key={idx} className="text-sm text-slate-300 leading-relaxed">
            {line.startsWith('Why:') || line.startsWith('Meaning:') || line.startsWith('Prediction:') || line.startsWith('Estimated') || line.startsWith('Next useful detail:') || line.startsWith('Data note:') ? (
              <>
                <strong className="text-blue-300">{line.split(':')[0]}:</strong>
                {line.substring(line.indexOf(':') + 1)}
              </>
            ) : (
              line
            )}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ── Single model page ────────────────────────────────────────────────────── */

function ModelPage({
  prediction,
  title,
  explanationData,
  isLoadingExplanation,
}: {
  prediction: ModelPrediction;
  title: string;
  explanationData?: XAIExplanation | null;
  isLoadingExplanation?: boolean;
}) {
  return (
    <Card>
      <div className="pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{title}</p>
            <p className="font-semibold mt-1 text-lg" style={{ color: 'var(--text-primary)' }}>
              {prediction.prediction ?? 'Unavailable'}
            </p>
          </div>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              background: prediction.status === 'OK' ? 'rgba(16, 185, 129, 0.15)' : prediction.status === 'LOW_CONFIDENCE' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(100, 116, 139, 0.15)',
              color: prediction.status === 'OK' ? '#6ee7b7' : prediction.status === 'LOW_CONFIDENCE' ? '#fcd34d' : '#94a3b8',
              border: `1px solid ${prediction.status === 'OK' ? 'rgba(16, 185, 129, 0.3)' : prediction.status === 'LOW_CONFIDENCE' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
            }}
          >
            {prediction.status}
          </span>
        </div>

        {Object.keys(prediction.probabilities).length > 0 && (
          <div className="space-y-3">
            {Object.entries(prediction.probabilities).map(([label, probability]) => (
              <ProbabilityBar key={label} label={label} probability={probability} />
            ))}
          </div>
        )}

        {prediction.message && <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>{prediction.message}</p>}
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
          {prediction.model_name}{prediction.model_version ? ` · ${prediction.model_version}` : ''}
          {` · ${Math.round(prediction.completeness * 100)}% of model inputs available`}
        </p>

        {/* XAI section – auto-loaded for doctors */}
        {isLoadingExplanation && (
          <div className="mt-6 flex items-center gap-2 text-sm text-blue-400">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generating AI explanation…
          </div>
        )}

        {explanationData && <ExplanationPanel data={explanationData} />}
      </div>
    </Card>
  );
}

/* ── Tab types ────────────────────────────────────────────────────────────── */

type DoctorTab = 'discharge' | 'stay' | 'transfer';
type AdminTab = 'stay' | 'transfer';

/* ── Mapping from tab to XAI model key ────────────────────────────────────── */

const TAB_TO_MODEL: Record<string, string> = {
  discharge: 'discharge',
  stay: 'stay_duration',
  transfer: 'transfer',
};

/* ── Main component ───────────────────────────────────────────────────────── */

export function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isDoctor = user?.role === 'doctor';

  const [patient, setPatient] = useState<Patient | null>(null);
  const [prognosis, setPrognosis] = useState<Prognosis | null>(null);
  const [isLoadingPatient, setIsLoadingPatient] = useState(true);
  const [isLoadingPrognosis, setIsLoadingPrognosis] = useState(true);

  const defaultTab = isAdmin ? 'stay' : 'discharge';
  const [activeTab, setActiveTab] = useState<DoctorTab | AdminTab>(defaultTab);

  // XAI state — keyed per model so switching tabs preserves cached explanations
  const [explanations, setExplanations] = useState<Record<string, XAIExplanation | null>>({});
  const [loadingExplanation, setLoadingExplanation] = useState<string | null>(null);
  const xaiRequestedFor = useRef<Set<string>>(new Set());

  const [patientError, setPatientError] = useState('');
  const [prognosisError, setPrognosisError] = useState('');
  const [treatmentError, setTreatmentError] = useState('');
  const [treatmentSaved, setTreatmentSaved] = useState(false);
  const [isSavingTreatment, setIsSavingTreatment] = useState(false);

  const [treatmentForm, setTreatmentForm] = useState<{
    number_of_days_stay: number | null;
    investigation_done: string;
    management_name_1: string;
    management_name_2: string;
  }>({
    number_of_days_stay: null,
    investigation_done: '',
    management_name_1: '',
    management_name_2: '',
  });

  /* ── Load patient ─────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!id) return;
    setIsLoadingPatient(true);
    setPatientError('');
    getPatientById(id)
      .then((data) => {
        if (!data) throw new Error('Patient not found');
        setPatient(data);
      })
      .catch((error) => setPatientError(getApiErrorMessage(error, 'Failed to load patient data.')))
      .finally(() => setIsLoadingPatient(false));
  }, [id]);

  /* ── Load prognosis ───────────────────────────────────────────────────── */

  useEffect(() => {
    if (!id || !patient) return;
    setIsLoadingPrognosis(true);
    setPrognosisError('');
    getPatientPrognosis(patient.id)
      .then(setPrognosis)
      .catch((error) => setPrognosisError(getApiErrorMessage(error, 'Failed to load prognosis.')))
      .finally(() => setIsLoadingPrognosis(false));
  }, [id, patient, treatmentSaved]);

  /* ── Auto-trigger XAI for doctors ─────────────────────────────────────── */

  useEffect(() => {
    if (!isDoctor || !patient || !prognosis) return;

    const modelKey = TAB_TO_MODEL[activeTab];
    if (!modelKey) return;

    // Only fire once per model per page session
    if (xaiRequestedFor.current.has(modelKey)) return;
    xaiRequestedFor.current.add(modelKey);

    setLoadingExplanation(modelKey);
    getExplanation(modelKey, patient.accident_id)
      .then((explanation) => {
        setExplanations((prev) => ({ ...prev, [modelKey]: explanation }));
      })
      .catch((error) => {
        console.error('XAI auto-explain failed:', error);
        setExplanations((prev) => ({ ...prev, [modelKey]: null }));
      })
      .finally(() => setLoadingExplanation(null));
  }, [isDoctor, patient, prognosis, activeTab]);

  /* ── Treatment submit ─────────────────────────────────────────────────── */

  const handleTreatmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setIsSavingTreatment(true);
    setTreatmentError('');
    setTreatmentSaved(false);

    const payload: TreatmentPayload = {
      accident_id: patient.accident_id,
      hospital_id: patient.hospital_id,
      number_of_days_stay: treatmentForm.number_of_days_stay,
      investigation_done: treatmentForm.investigation_done,
      management_name_1: treatmentForm.management_name_1,
      management_name_2: treatmentForm.management_name_2,
    };

    try {
      await createTreatment(payload);
      setTreatmentSaved(true);
      // Reset XAI cache since models re-run after treatment save
      xaiRequestedFor.current.clear();
      setExplanations({});
      setTreatmentForm({
        number_of_days_stay: null,
        investigation_done: '',
        management_name_1: '',
        management_name_2: '',
      });
    } catch (error) {
      setTreatmentError(getApiErrorMessage(error, 'Failed to save treatment data.'));
    } finally {
      setIsSavingTreatment(false);
    }
  };

  /* ── Render helpers ───────────────────────────────────────────────────── */

  const currentModelKey = TAB_TO_MODEL[activeTab];
  const currentExplanation = isDoctor ? (explanations[currentModelKey] ?? null) : null;
  const isCurrentExplanationLoading = isDoctor && loadingExplanation === currentModelKey;

  const getPrediction = (tab: string): ModelPrediction | null => {
    if (!prognosis) return null;
    switch (tab) {
      case 'discharge': return prognosis.discharge;
      case 'stay': return prognosis.stay_duration;
      case 'transfer': return prognosis.transfer;
      default: return null;
    }
  };

  const getTitle = (tab: string): string => {
    switch (tab) {
      case 'discharge': return 'Discharge outcome prediction';
      case 'stay': return 'Predicted length of stay';
      case 'transfer': return 'Transfer assessment';
      default: return '';
    }
  };

  /* ── Loading / Error states ───────────────────────────────────────────── */

  if (isLoadingPatient) {
    return <DashboardShell><LoadingSpinner /></DashboardShell>;
  }

  if (patientError || !patient) {
    return (
      <DashboardShell>
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
          {patientError || 'Patient not found'}
        </div>
      </DashboardShell>
    );
  }

  /* ── Build tabs list ──────────────────────────────────────────────────── */

  const tabs: { key: DoctorTab | AdminTab; label: string }[] = isAdmin
    ? [
        { key: 'stay', label: 'Predicted Stay' },
        { key: 'transfer', label: 'Transfer Probability' },
      ]
    : [
        { key: 'discharge', label: 'Discharge Outcome' },
        { key: 'stay', label: 'Predicted Stay' },
        { key: 'transfer', label: 'Transfer Probability' },
      ];

  const prediction = getPrediction(activeTab);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (isAdmin) navigate('/admin');
              else navigate('/doctor');
            }}
            className="p-2 rounded-full hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            ← Back
          </button>
          <div>
            <h1 className="text-xl font-semibold gradient-text">{patient.name}</h1>
            <p className="text-sm text-slate-400 mt-1">ID: {patient.id}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
          <div className="space-y-6">
            
            {/* Tabs Navigation */}
            <div className="flex border-b border-slate-700/50">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Model Panel — each tab is a separate "page" */}
            {isLoadingPrognosis ? (
              <div className="py-8"><LoadingSpinner /></div>
            ) : prediction ? (
              <ModelPage
                prediction={prediction}
                title={getTitle(activeTab)}
                explanationData={currentExplanation}
                isLoadingExplanation={isCurrentExplanationLoading}
              />
            ) : (
              <Card>
                <p className="text-sm py-4 text-slate-400">{prognosisError || 'Prognosis data unavailable.'}</p>
              </Card>
            )}

            {/* Treatment form — doctor only */}
            {!isAdmin && (
              <Card title="Record treatment data for predictions">
                <p className="mb-4 text-xs text-slate-400">Fields marked <span className="font-semibold text-rose-400">*</span> are required.</p>
              {treatmentSaved && <p className="mb-4 text-sm rounded-lg px-4 py-3 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">Treatment saved and predictions refreshed.</p>}
              {treatmentError && <p className="mb-4 text-sm rounded-lg px-4 py-3 text-rose-400 bg-rose-500/10 border border-rose-500/20">{treatmentError}</p>}
              <form onSubmit={handleTreatmentSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1 text-slate-400">Days stayed <span className="text-rose-400">*</span></label>
                    <input type="number" min={0} step={1} required value={treatmentForm.number_of_days_stay ?? ''} onChange={(e) => setTreatmentForm(v => ({ ...v, number_of_days_stay: e.target.value === '' ? null : Number(e.target.value) }))} className="w-full px-4 py-2.5 text-sm dark-input" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-slate-400">Investigation <span className="text-rose-400">*</span></label>
                    <select required value={treatmentForm.investigation_done} onChange={(e) => setTreatmentForm(v => ({ ...v, investigation_done: e.target.value }))} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Select investigation</option>
                      {INVESTIGATION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-slate-400">Primary management <span className="text-rose-400">*</span></label>
                    <select required value={treatmentForm.management_name_1} onChange={(e) => setTreatmentForm(v => ({ ...v, management_name_1: e.target.value }))} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">Select primary management</option>
                      {PRIMARY_MANAGEMENT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-slate-400">Secondary management</label>
                    <select value={treatmentForm.management_name_2} onChange={(e) => setTreatmentForm(v => ({ ...v, management_name_2: e.target.value }))} className="w-full px-4 py-2.5 text-sm dark-input">
                      <option value="">No secondary management</option>
                      {SECONDARY_MANAGEMENT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  </div>
                  <button type="submit" disabled={isSavingTreatment} className="px-6 py-2.5 text-sm gradient-btn mt-2">
                    {isSavingTreatment ? 'Saving...' : 'Save treatment and refresh predictions'}
                  </button>
                </form>
              </Card>
            )}

          </div>
          
          <div>
            <Card title="Patient Details">
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-slate-400">Age / Gender</span>
                  <p className="text-sm font-medium text-slate-200">{patient.age} / {patient.gender}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Admission Date</span>
                  <p className="text-sm font-medium text-slate-200">{patient.admission_date}</p>
                </div>
                <div className="pt-3 border-t border-slate-700/50">
                  <span className="text-xs text-slate-400">Incident Details</span>
                  <p className="text-sm font-medium text-slate-200 mt-1">{patient.collision_type}</p>
                  <p className="text-sm text-slate-400 mt-2">{patient.injury_description}</p>
                </div>
                <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm pt-3 border-t border-slate-700/50">
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Priority</span>
                    <SeverityBadge value={patient.priority} />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Severity</span>
                    <SeverityBadge value={patient.severity} />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
