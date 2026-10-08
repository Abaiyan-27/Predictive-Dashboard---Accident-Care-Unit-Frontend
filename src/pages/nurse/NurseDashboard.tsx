import { useState, useEffect, useCallback } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PatientListItem } from '../../components/PatientListItem';
import { SeverityBadge } from '../../components/SeverityBadge';
import { StaleNotice } from '../../components/StaleNotice';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ListFooter } from '../../components/ListFooter';
import { useAuth } from '../../auth/AuthContext';
import {
  decideSeverity,
  getHospitalPatientRecords,
  getPatientDetail,
  getSeverityStatus,
  runSeverity,
  submitPatientIntake,
  updatePatientIntake,
} from '../../api';
import { getApiErrorMessage } from '../../api/client';
import { SEVERITY_STATES } from '../../contracts/severity';
import type { HumanSeverityDecision, Severity } from '../../contracts/severity';
import type { Patient, PatientIntakeForm, SeverityWorkflow } from '../../types';
import { SeverityPanel } from './SeverityPanel';
import { TransferRequestsCard } from './TransferRequestsCard';
import { TreatmentCard } from './TreatmentCard';

// ── Dropdown Options ────────────────────────────────────────────────────────

const COLLISION_TYPES = ['ambulance', 'animal', 'bicycle', 'car or van', 'fall from vehicle', 'fixed object', 'heavy vehicle', 'motorbike', 'others', 'pedestrian', 'slipped', 'three wheeler', 'train'];
const TRANSPORT_MODES = ['ambulance', 'motor bike', 'three wheeler', 'other vehicle'];
const TRAVEL_TIMES = ['less than 15 minutes', '15 minutes - 30 minutes', '30 minutes - 1 hour', '1 hour - 2 hour', 'more than 2 hour'];
const INJURY_SITES = ['abdomen', 'cervical', 'chest injury', 'chest rib', 'clavicle', 'elbow region', 'eye injury', 'facial injury', 'femur', 'foot', 'foot metacarpals', 'foot metatarsals', 'foot phalanges', 'foot tarsals', 'forearm', 'forearm (radius, ulna)', 'forearm radius', 'forearm ulna', 'forehead', 'hand', 'hand metacarpals', 'hand phalanges', 'head injury', 'humerus head', 'humerus region', 'knee', 'knee patella', 'leg', 'leg (tibia, fibula)', 'leg fibula', 'leg tibia', 'lumbar', 'no injury found', 'pelvis', 'pelvis ilium', 'pelvis ramous', 'sacrum', 'shoulder clavicle', 'shoulder injury', 'thigh', 'thigh femur', 'thigh nof', 'thoracic'];
const SECONDARY_INJURY_SITES = ['no secondary injury found', ...INJURY_SITES.filter((s) => s !== 'no injury found')];
const INJURY_TYPES = ['abration', 'amputation', 'bowel injury', 'contusion', 'dislocation', 'fracture', 'ich', 'kidney injury', 'laceration', 'ligament injury', 'lung injury', 'nerve lesion', 'pericardial effusion', 'pneumothorax', 'sdh', 'spinal cord injury', 'spleen injury'];
const SECONDARY_INJURY_TYPES = ['abration', 'amputation', 'bowel injury', 'contusion', 'dislocation', 'fracture', 'kidney injury', 'laceration', 'ligament injury', 'nerve lesion', 'pneumothorax', 'spleen injury'];
const MODE_OF_TRAVEL = ['bicycle', 'bicycle pillion', 'car or van', 'car or van passenger', 'heavy vehicle', 'heavy vehicle passenger', 'motor cyclist', 'motorbike pillion rider', 'others', 'pedestrian', 'three wheeler', 'three wheeler passenger'];
const VEHICLE_TYPES = ['motor cyclist', 'other vehicle'];
const PASSENGER_TYPES = ['driver', 'frontseatpassenger', 'passengerenteringorleavingbus', 'passengerfallingofvehicle', 'rearseatpassenger'];
const OTHER_INJURY_OPTIONS = ['multiple', 'no other injury'];
const ROAD_TYPES = ['straight', 'bend', 'junction'];
const SPEEDS = ['less than 40 km/h', '40 - 80 km/h', '80 - 100 km/h', 'more than 100 km/h'];
const COLLISION_FORCES = ['front', 'behind', 'leftside', 'rightside'];
const ROAD_CONDITIONS = ['good', 'poor'];
const YES_NO = ['yes', 'no'];
const GENDERS = ['Male', 'Female', 'Other'] as const;

const EMPTY_FORM: PatientIntakeForm = {
  name: '', age: null, gender: '', collision_type: '', mode_of_transport: '', time_to_hospital: '',
  site_of_injury: '', type_of_injury: '', secondary_site_of_injury: '', secondary_type_of_injury: '',
  incident_at: '', vehicle_type: '', helmet_worn: '', road_type: '', speed: '', road_condition: '',
  visibility: '', road_signals_exist: '', collision_force_from: '', alcohol_consumption: '', illicit_drugs: '',
  mode_of_travel_during_accident: '', passenger_type: '', other_injury: '',
};


type FormField = keyof PatientIntakeForm;

/** Form fields whose backend (lock/missing-input) name differs. */
const API_FIELD: Partial<Record<FormField, string>> = { name: 'full_name', collision_type: 'collision_with' };

/** Box 2: the Severity model's inputs (age is entered with the basic details). */
const SEVERITY_FIELDS: FormField[] = [
  'collision_type', 'mode_of_travel_during_accident', 'passenger_type', 'mode_of_transport', 'time_to_hospital',
  'incident_at', 'vehicle_type', 'helmet_worn', 'site_of_injury', 'secondary_site_of_injury', 'other_injury',
];
/** Box 3: details read only by the doctor's models. */
const OTHER_FIELDS: FormField[] = [
  'road_type', 'speed', 'road_condition', 'visibility', 'road_signals_exist', 'collision_force_from',
  'alcohol_consumption', 'illicit_drugs', 'type_of_injury', 'secondary_type_of_injury',
];

type PendingAction =
  | { kind: 'basic' }
  | { kind: 'severity'; run: boolean }
  | { kind: 'other' }
  | { kind: 'accept'; predictionId: string; label: Severity }
  | { kind: 'override'; predictionId: string; modelLabel: Severity; decision: HumanSeverityDecision; reason: string };

function pick(form: PatientIntakeForm, fields: FormField[]): Partial<PatientIntakeForm> {
  return Object.fromEntries(fields.map((field) => [field, form[field]])) as Partial<PatientIntakeForm>;
}

function formFromDetail(detail: Awaited<ReturnType<typeof getPatientDetail>>): PatientIntakeForm {
  const acc = detail.accident;
  const inj1 = detail.injuries?.[0] || {};
  const inj2 = detail.injuries?.[1] || {};
  return {
    name: detail.patient.full_name || '',
    age: detail.patient.age ? parseInt(detail.patient.age, 10) : null,
    gender: (detail.patient.gender as PatientIntakeForm['gender']) || '',
    collision_type: acc.collision_with || '',
    mode_of_transport: acc.mode_of_transport || '',
    time_to_hospital: acc.time_to_hospital || '',
    site_of_injury: inj1.site_of_injury || '',
    type_of_injury: inj1.type_of_injury || '',
    secondary_site_of_injury: inj2.site_of_injury || '',
    secondary_type_of_injury: inj2.type_of_injury || '',
    incident_at: acc.incident_at ? acc.incident_at.slice(0, 16) : '', // datetime-local format
    vehicle_type: acc.vehicle_type || '',
    helmet_worn: acc.helmet_worn || '',
    road_type: acc.road_type || '',
    speed: acc.speed || '',
    road_condition: acc.road_condition || '',
    visibility: acc.visibility || '',
    road_signals_exist: acc.road_signals_exist || '',
    collision_force_from: acc.collision_force_from || '',
    alcohol_consumption: acc.alcohol_consumption || '',
    illicit_drugs: acc.illicit_drugs || '',
    mode_of_travel_during_accident: acc.mode_of_travel_during_accident || '',
    passenger_type: acc.passenger_type || '',
    other_injury: acc.other_injury || '',
  };
}

const labelClass = "block text-sm font-medium mb-1.5";
const labelStyle = { color: 'var(--text-secondary)' };
const inputClass = "w-full px-4 py-2.5 text-sm dark-input disabled:opacity-60 disabled:cursor-not-allowed disabled:border-dashed";

/** Why each group of fields locks; shown above the group and linked to each locked control. */
const LOCK_REASONS = {
  severity: 'Locked — the final Severity decision has been recorded, so the Severity inputs can no longer be changed.',
  later: "Locked — treatment has been recorded; these details are now inputs to the doctor's models.",
  age: 'Age is a Severity input and is locked after the Severity decision. Name and gender stay editable.',
} as const;
type LockGroup = keyof typeof LOCK_REASONS;

function LockedTag() {
  return <span className="ml-2 text-xs font-normal" style={{ color: 'var(--tone-warning)' }}>(locked)</span>;
}

function LockNotice({ group }: { group: LockGroup }) {
  return (
    <p id={`lock-${group}`} role="note" className="text-sm rounded-lg px-3 py-2"
      style={{ color: 'var(--tone-warning)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
      {LOCK_REASONS[group]}
    </p>
  );
}

interface SelectFieldProps {
  name: FormField;
  label: string;
  value: string;
  options: readonly string[];
  placeholder?: string;
  locked: boolean;
  /** Which lock explanation applies when the field is locked. */
  group: LockGroup;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

function SelectField({ name, label, value, options, placeholder = 'Unknown', locked, group, onChange }: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={name} className={labelClass} style={labelStyle}>{label}{locked && <LockedTag />}</label>
      <select id={name} name={name} value={value} onChange={onChange} disabled={locked} className={inputClass}
        aria-describedby={locked ? `lock-${group}` : undefined} title={locked ? LOCK_REASONS[group] : undefined}>
        <option value="">{placeholder}</option>
        {options.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );
}

function WorkflowSummary({ workflow }: { workflow?: SeverityWorkflow }) {
  if (!workflow) return null;
  return (
    <p className="text-xs mt-1 text-[color:var(--text-muted)]">
      Basic details {workflow.basic_complete ? 'complete' : 'incomplete'}
      {' · '}Severity inputs {workflow.inputs.recorded}/{workflow.inputs.total}
      {workflow.inputs.complete ? ' (complete)' : workflow.inputs.ready ? '' : ' (more needed)'}
      {' · '}{SEVERITY_STATES[workflow.state]}
    </p>
  );
}

function WorkflowBadge({ workflow }: { workflow?: SeverityWorkflow }) {
  if (workflow?.final_severity) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-[10px] uppercase tracking-wide text-[color:var(--text-muted)]">Final decision</span>
        <SeverityBadge value={workflow.final_severity} />
      </div>
    );
  }
  if (workflow?.prediction?.stale) {
    return <StaleNotice compact reason={workflow.prediction.stale_reason} />;
  }
  if (workflow?.prediction) {
    const needsClinician = workflow.state === 'MODEL_DEFERRED' || workflow.state === 'PREDICTION_FAILED';
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-[10px] uppercase tracking-wide text-[color:var(--text-muted)]">
          {needsClinician ? 'Clinical decision required' : 'Model · awaiting decision'}
        </span>
        <SeverityBadge value={workflow.prediction.prediction} />
      </div>
    );
  }
  return <span className="text-xs text-[color:var(--text-muted)]">{workflow ? SEVERITY_STATES[workflow.state] : 'Not yet run'}</span>;
}

type NurseTab = 'intake' | 'transfers' | 'patients';
type IntakeTab = 'basic' | 'severity' | 'other' | 'treatment';

export function NurseDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<NurseTab>('patients');
  const [activeIntakeTab, setActiveIntakeTab] = useState<IntakeTab>('basic');
  const [form, setForm] = useState<PatientIntakeForm>({ ...EMPTY_FORM });
  // Values as last saved, so each box only sends its own fields.
  const [savedForm, setSavedForm] = useState<PatientIntakeForm>({ ...EMPTY_FORM });
  const [activeAccidentId, setActiveAccidentId] = useState<string | null>(null);
  const [activePatientName, setActivePatientName] = useState('');
  const [severity, setSeverity] = useState<SeverityWorkflow | null>(null);

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideChoice, setOverrideChoice] = useState<HumanSeverityDecision | ''>('');
  const [overrideReason, setOverrideReason] = useState('');

  const [hospitalPatients, setHospitalPatients] = useState<Patient[]>([]);
  const [patientTotal, setPatientTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [noticeMsg, setNoticeMsg] = useState('');

  const isLocked = (field: FormField) => Boolean(severity?.locks.fields.includes(API_FIELD[field] ?? field));
  const severityLocked = Boolean(severity?.locks.severity_inputs);
  const laterLocked = Boolean(severity?.locks.later_model_inputs);

  const fetchHospitalPatients = useCallback(async () => {
    if (!user) return;
    setIsLoadingPatients(true);
    try {
      const page = await getHospitalPatientRecords();
      setHospitalPatients(page.rows);
      setPatientTotal(page.total);
    } catch (error) {
      setErrorMsg(getApiErrorMessage(error, 'Unable to load patient records.'));
    } finally {
      setIsLoadingPatients(false);
    }
  }, [user]);

  const loadMorePatients = async () => {
    setLoadingMore(true);
    try {
      const page = await getHospitalPatientRecords(hospitalPatients.length);
      setHospitalPatients((prev) => [...prev, ...page.rows]);
      setPatientTotal(page.total);
    } catch (error) {
      setErrorMsg(getApiErrorMessage(error, 'Unable to load more patient records.'));
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchHospitalPatients();
  }, [fetchHospitalPatients]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'age' ? (value === '' ? null : parseInt(value, 10)) : value,
    }));
  };

  const resetOverride = () => {
    setOverrideOpen(false);
    setOverrideChoice('');
    setOverrideReason('');
  };

  const handlePatientSelect = async (patientItem: Patient) => {
    if (!user) return;
    setErrorMsg('');
    setNoticeMsg('');
    try {
      const detail = await getPatientDetail(patientItem.id);
      const workflow = await getSeverityStatus(detail.accident.accident_id);
      const loaded = formFromDetail(detail);
      setActiveAccidentId(detail.accident.accident_id);
      setActivePatientName(loaded.name);
      setForm(loaded);
      setSavedForm(loaded);
      setSeverity(workflow);
      resetOverride();
      setActiveTab('intake');
      setActiveIntakeTab('basic');
    } catch (error) {
      setErrorMsg(getApiErrorMessage(error, 'Failed to load patient details.'));
    }
  };

  const handleNewPatient = () => {
    setActiveAccidentId(null);
    setActivePatientName('');
    setForm({ ...EMPTY_FORM });
    setSavedForm({ ...EMPTY_FORM });
    setSeverity(null);
    resetOverride();
    setErrorMsg('');
    setNoticeMsg('');
    setActiveTab('intake');
    setActiveIntakeTab('basic');
  };

  // ── Every save first asks "Are you sure?"; nothing is sent until confirmed ──

  const requestBasic = (e: React.FormEvent) => {
    e.preventDefault();
    setPending({ kind: 'basic' });
  };
  const requestOther = (e: React.FormEvent) => {
    e.preventDefault();
    setPending({ kind: 'other' });
  };
  const requestSeverity = (run: boolean) => setPending({ kind: 'severity', run });
  const requestAccept = () => {
    if (!severity?.prediction) return;
    setPending({ kind: 'accept', predictionId: severity.prediction.prediction_id, label: severity.prediction.prediction });
  };
  const requestOverride = () => {
    if (!severity?.prediction || !overrideChoice) return;
    setPending({
      kind: 'override',
      predictionId: severity.prediction.prediction_id,
      modelLabel: severity.prediction.prediction,
      decision: overrideChoice,
      reason: overrideReason.trim(),
    });
  };

  const afterSave = (result: { patient: Patient; severity: SeverityWorkflow }, fields: FormField[]) => {
    setSeverity(result.severity);
    setActivePatientName(result.patient.name);
    setSavedForm((prev) => ({ ...prev, ...pick(form, fields) }));
  };

  const saveBasic = async () => {
    if (!user) return;
    const fields: FormField[] = isLocked('age') ? ['name', 'gender'] : ['name', 'age', 'gender'];
    const basic = pick(form, fields);
    if (activeAccidentId) {
      afterSave(await updatePatientIntake(activeAccidentId, basic), fields);
    } else {
      const result = await submitPatientIntake({ ...EMPTY_FORM, ...basic }, user.hospital_id);
      setActiveAccidentId(result.patient.accident_id);
      afterSave(result, fields);
    }
    setNoticeMsg('Basic details saved.');
  };

  const saveSeverityInputs = async (run: boolean) => {
    if (!activeAccidentId) return;
    // Injury types belong to Box 3; send their saved values so this save changes only Severity inputs.
    const result = await updatePatientIntake(activeAccidentId, {
      ...pick(form, SEVERITY_FIELDS),
      type_of_injury: savedForm.type_of_injury,
      secondary_type_of_injury: savedForm.secondary_type_of_injury,
    });
    afterSave(result, SEVERITY_FIELDS);
    if (!run) {
      setNoticeMsg('Severity inputs saved.');
      return;
    }
    try {
      setSeverity(await runSeverity(activeAccidentId));
      resetOverride();
      setNoticeMsg('Severity inputs saved and the Severity model has run.');
    } catch (error) {
      setErrorMsg(`Severity inputs saved. ${getApiErrorMessage(error, 'The Severity model could not be run.')}`);
    }
  };

  const saveOtherInputs = async () => {
    if (!activeAccidentId) return;
    // Injury sites are Severity inputs (Box 2); send their saved values unchanged.
    afterSave(await updatePatientIntake(activeAccidentId, {
      ...pick(form, OTHER_FIELDS),
      site_of_injury: savedForm.site_of_injury,
      secondary_site_of_injury: savedForm.secondary_site_of_injury,
    }), OTHER_FIELDS);
    setNoticeMsg('Accident details saved.');
  };

  const confirmPending = async () => {
    if (!pending) return;
    const action = pending;
    setBusy(true);
    setErrorMsg('');
    setNoticeMsg('');
    try {
      if (action.kind === 'basic') await saveBasic();
      if (action.kind === 'severity') await saveSeverityInputs(action.run);
      if (action.kind === 'other') await saveOtherInputs();
      if (action.kind === 'accept') {
        setSeverity(await decideSeverity(action.predictionId, { action: 'accept' }));
        resetOverride();
        setNoticeMsg('Final Severity decision saved: model prediction accepted.');
      }
      if (action.kind === 'override') {
        setSeverity(await decideSeverity(action.predictionId, {
          action: 'override',
          final_decision: action.decision,
          ...(action.reason ? { reason: action.reason } : {}),
        }));
        resetOverride();
        setNoticeMsg('Final Severity decision saved.');
      }
      await fetchHospitalPatients();
    } catch (error) {
      setErrorMsg(getApiErrorMessage(error, 'Unable to save. Please try again.'));
      // A decision can be refused because the screen is out of date; show the current state.
      if (activeAccidentId && (action.kind === 'accept' || action.kind === 'override')) {
        try {
          setSeverity(await getSeverityStatus(activeAccidentId));
          resetOverride();
        } catch {
          // keep the error already shown
        }
      }
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const confirmText = (action: PendingAction) => {
    switch (action.kind) {
      case 'basic':
        return <p>Save the basic details for {form.name || 'this patient'}?</p>;
      case 'severity':
        return action.run
          ? <p>Save the Severity inputs and run the Severity model? Once you record the Severity decision, these inputs are locked.</p>
          : <p>Save the Severity inputs?</p>;
      case 'other':
        return <p>Save the accident details used by the doctor&apos;s models?</p>;
      case 'accept':
        return (
          <p>
            Record the model&apos;s prediction <SeverityBadge value={action.label} /> as
            the final Severity decision? It cannot be changed afterwards.
          </p>
        );
      case 'override':
        return (
          <p>
            Record <SeverityBadge value={action.decision} /> as your final Severity decision instead of the
            model&apos;s <SeverityBadge value={action.modelLabel} />? It cannot be changed afterwards.
          </p>
        );
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold gradient-text">Nurse Dashboard</h1>
          {activeTab !== 'intake' && (
            <button onClick={handleNewPatient} className="px-4 py-2 text-sm gradient-btn">
              + New Patient
            </button>
          )}
        </div>

        <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <nav className="flex flex-wrap gap-0 -mb-px" role="tablist">
            {[
              { key: 'patients', label: 'Hospital Patients' },
              { key: 'transfers', label: 'Transfer Requests' },
              { key: 'intake', label: activeAccidentId ? 'Patient Intake' : 'New Patient' },
            ].map((tab) => (
              <button key={tab.key} type="button" role="tab" aria-selected={activeTab === tab.key} onClick={() => { setActiveTab(tab.key as NurseTab); setErrorMsg(''); setNoticeMsg(''); }}
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

        {errorMsg && (
          <div role="alert" className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ color: 'var(--tone-danger)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {errorMsg}
          </div>
        )}
        {noticeMsg && (
          <div role="status" className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ color: 'var(--tone-success)', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            {noticeMsg}
          </div>
        )}

        {activeTab === 'intake' && (
          <div className="space-y-6 animate-fade-in">
            {/* Severity result and decision (nurses work with the Severity model only) */}
            {activeAccidentId && severity && (
              <SeverityPanel
                patientName={activePatientName}
                workflow={severity}
                busy={busy}
                overrideOpen={overrideOpen}
                overrideChoice={overrideChoice}
                overrideReason={overrideReason}
                onRun={() => requestSeverity(true)}
                onAccept={requestAccept}
                onReject={() => setOverrideOpen(true)}
                onCancelOverride={resetOverride}
                onOverrideChoice={setOverrideChoice}
                onOverrideReason={setOverrideReason}
                onSaveOverride={requestOverride}
              />
            )}

            <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <nav className="flex flex-wrap gap-0 -mb-px" role="tablist">
                {[
                  { key: 'basic', label: 'Basic Details' },
                  { key: 'severity', label: 'Severity Inputs', disabled: !activeAccidentId },
                  { key: 'other', label: 'Other Inputs', disabled: !activeAccidentId },
                  { key: 'treatment', label: 'Treatment', disabled: !activeAccidentId },
                ].map((tab) => (
                  <button key={tab.key} type="button" role="tab" aria-selected={activeIntakeTab === tab.key} disabled={tab.disabled} onClick={() => setActiveIntakeTab(tab.key as IntakeTab)}
                    className="px-5 py-3 text-sm font-medium transition-all duration-200 relative disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ color: activeIntakeTab === tab.key ? 'var(--text-accent)' : 'var(--text-muted)' }}>
                    {tab.label}
                    {activeIntakeTab === tab.key && !tab.disabled && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: 'var(--gradient-brand)' }} />
                    )}
                  </button>
                ))}
              </nav>
            </div>

            <div className="space-y-6">
              <div style={{ display: activeIntakeTab === 'basic' ? 'block' : 'none' }}>
                <Card title="Box 1: Basic Details">
            <form onSubmit={requestBasic} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="name" className={labelClass} style={labelStyle}>Patient name</label>
                  <input id="name" name="name" type="text" required value={form.name} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="age" className={labelClass} style={labelStyle}>Age{isLocked('age') && <LockedTag />}</label>
                  <input id="age" name="age" type="number" min={1} max={100} value={form.age ?? ''} onChange={handleChange} disabled={isLocked('age')} className={inputClass}
                    aria-describedby={isLocked('age') ? 'lock-age' : undefined} title={isLocked('age') ? LOCK_REASONS.age : undefined} />
                </div>
                <div>
                  <label htmlFor="gender" className={labelClass} style={labelStyle}>Gender</label>
                  <select id="gender" name="gender" value={form.gender} onChange={handleChange} className={inputClass}>
                    <option value="">Not provided</option>
                    {GENDERS.map((g) => (<option key={g} value={g}>{g}</option>))}
                  </select>
                </div>
              </div>
              {isLocked('age') && <LockNotice group="age" />}
              <button type="submit" disabled={busy} className="py-2.5 px-6 text-sm gradient-btn">
                Save Basic Details
              </button>
            </form>
          </Card>
              </div>

              <div style={{ display: activeIntakeTab === 'severity' ? 'block' : 'none' }}>
          {activeAccidentId && (
            <Card title="Box 2: Severity Prediction Inputs">
              <form onSubmit={(e) => { e.preventDefault(); requestSeverity(false); }} className="space-y-4">
                {severityLocked && <LockNotice group="severity" />}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <SelectField name="collision_type" label="Collision with" value={form.collision_type} options={COLLISION_TYPES} placeholder="Select type" locked={isLocked('collision_type')} group="severity" onChange={handleChange} />
                  <SelectField name="mode_of_travel_during_accident" label="Mode of travel" value={form.mode_of_travel_during_accident} options={MODE_OF_TRAVEL} locked={isLocked('mode_of_travel_during_accident')} group="severity" onChange={handleChange} />
                  <SelectField name="passenger_type" label="Passenger type" value={form.passenger_type} options={PASSENGER_TYPES} locked={isLocked('passenger_type')} group="severity" onChange={handleChange} />
                  <SelectField name="mode_of_transport" label="Transport to hospital" value={form.mode_of_transport} options={TRANSPORT_MODES} locked={isLocked('mode_of_transport')} group="severity" onChange={handleChange} />
                  <SelectField name="time_to_hospital" label="Time to hospital" value={form.time_to_hospital} options={TRAVEL_TIMES} locked={isLocked('time_to_hospital')} group="severity" onChange={handleChange} />
                  <div>
                    <label htmlFor="incident_at" className={labelClass} style={labelStyle}>Time of collision{isLocked('incident_at') && <LockedTag />}</label>
                    <input id="incident_at" name="incident_at" type="datetime-local" value={form.incident_at} onChange={handleChange} disabled={isLocked('incident_at')} className={inputClass}
                      aria-describedby={isLocked('incident_at') ? 'lock-severity' : undefined} title={isLocked('incident_at') ? LOCK_REASONS.severity : undefined} />
                  </div>
                  <SelectField name="vehicle_type" label="Vehicle type" value={form.vehicle_type} options={VEHICLE_TYPES} locked={isLocked('vehicle_type')} group="severity" onChange={handleChange} />
                  <SelectField name="helmet_worn" label="Helmet worn" value={form.helmet_worn} options={YES_NO} locked={isLocked('helmet_worn')} group="severity" onChange={handleChange} />
                  <SelectField name="site_of_injury" label="Primary injury site" value={form.site_of_injury} options={INJURY_SITES} locked={isLocked('site_of_injury')} group="severity" onChange={handleChange} />
                  <SelectField name="secondary_site_of_injury" label="Secondary injury site" value={form.secondary_site_of_injury} options={SECONDARY_INJURY_SITES} locked={isLocked('secondary_site_of_injury')} group="severity" onChange={handleChange} />
                  <SelectField name="other_injury" label="Other injury" value={form.other_injury} options={OTHER_INJURY_OPTIONS} locked={isLocked('other_injury')} group="severity" onChange={handleChange} />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="submit" disabled={busy || severityLocked} aria-describedby={severityLocked ? 'lock-severity' : undefined} className="py-2.5 px-6 text-sm gradient-btn">
                    Save Severity Inputs
                  </button>
                  <button type="button" onClick={() => requestSeverity(true)} disabled={busy || severityLocked} aria-describedby={severityLocked ? 'lock-severity' : undefined} className="py-2.5 px-6 text-sm gradient-btn">
                    Save &amp; Run Severity
                  </button>
                </div>
              </form>
            </Card>
          )}
              </div>

              <div style={{ display: activeIntakeTab === 'other' ? 'block' : 'none' }}>
          {activeAccidentId && (
            <Card title="Box 3: Other Models Input">
              <form onSubmit={requestOther} className="space-y-4">
                {laterLocked && <LockNotice group="later" />}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <SelectField name="road_type" label="Road type" value={form.road_type} options={ROAD_TYPES} locked={isLocked('road_type')} group="later" onChange={handleChange} />
                  <SelectField name="speed" label="Approximate speed" value={form.speed} options={SPEEDS} locked={isLocked('speed')} group="later" onChange={handleChange} />
                  <SelectField name="road_condition" label="Road condition" value={form.road_condition} options={ROAD_CONDITIONS} locked={isLocked('road_condition')} group="later" onChange={handleChange} />
                  <SelectField name="visibility" label="Visibility" value={form.visibility} options={['adequate', 'poor']} locked={isLocked('visibility')} group="later" onChange={handleChange} />
                  <SelectField name="road_signals_exist" label="Road signals existed" value={form.road_signals_exist} options={YES_NO} locked={isLocked('road_signals_exist')} group="later" onChange={handleChange} />
                  <SelectField name="collision_force_from" label="Collision force from" value={form.collision_force_from} options={COLLISION_FORCES} locked={isLocked('collision_force_from')} group="later" onChange={handleChange} />
                  <SelectField name="alcohol_consumption" label="Alcohol consumption" value={form.alcohol_consumption} options={YES_NO} locked={isLocked('alcohol_consumption')} group="later" onChange={handleChange} />
                  <SelectField name="illicit_drugs" label="Illicit drugs" value={form.illicit_drugs} options={YES_NO} locked={isLocked('illicit_drugs')} group="later" onChange={handleChange} />
                  <SelectField name="type_of_injury" label="Type of injury (primary)" value={form.type_of_injury} options={INJURY_TYPES} locked={isLocked('type_of_injury')} group="later" onChange={handleChange} />
                  <SelectField name="secondary_type_of_injury" label="Type of injury (secondary)" value={form.secondary_type_of_injury} options={SECONDARY_INJURY_TYPES} locked={isLocked('secondary_type_of_injury')} group="later" onChange={handleChange} />
                </div>
                <button type="submit" disabled={busy || laterLocked} aria-describedby={laterLocked ? 'lock-later' : undefined} className="py-2.5 px-6 text-sm gradient-btn">
                  Save Other Inputs
                </button>
              </form>
            </Card>
          )}
              </div>

              <div style={{ display: activeIntakeTab === 'treatment' ? 'block' : 'none' }}>
          {activeAccidentId && (
            <TreatmentCard
              accidentId={activeAccidentId}
              onSaved={async () => {
                // Treatment locks Box 3 (the doctor models' accident inputs): show the new locks.
                try { setSeverity(await getSeverityStatus(activeAccidentId)); } catch { /* the card shows its own result */ }
                await fetchHospitalPatients();
              }}
            />
          )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transfers' && (
          <div className="animate-fade-in">
            {/* The hospital's patients, whichever nurse registered them */}
            <TransferRequestsCard />
          </div>
        )}

        {activeTab === 'patients' && (
          <div className="animate-fade-in">
            <Card title="Hospital patient records">
              <p className="-mt-3 mb-4 text-xs text-[color:var(--text-muted)]">
            Every patient at your hospital, whichever nurse registered them. Select a patient to continue their record.
          </p>
          {isLoadingPatients ? (
            <LoadingSpinner />
          ) : hospitalPatients.length === 0 ? (
            <p className="text-sm py-4 text-[color:var(--text-muted)]">No patient records at this hospital yet. Register a patient with Box 1 above.</p>
          ) : (
            <div className="rounded-lg overflow-hidden border border-slate-700">
              {hospitalPatients.map((p) => (
                <PatientListItem
                  key={p.accident_id}
                  patient={p}
                  onClick={() => handlePatientSelect(p)}
                  details={<WorkflowSummary workflow={p.severity_workflow} />}
                  badge={<WorkflowBadge workflow={p.severity_workflow} />}
                />
              ))}
            </div>
          )}
          {!isLoadingPatients && <ListFooter shown={hospitalPatients.length} total={patientTotal} loading={loadingMore} onMore={loadMorePatients} noun="patient records" />}
        </Card>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        confirmLabel={pending?.kind === 'accept' || pending?.kind === 'override' ? 'Yes, record decision' : 'Yes, save'}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        {pending && confirmText(pending)}
      </ConfirmDialog>
    </DashboardShell>
  );
}
