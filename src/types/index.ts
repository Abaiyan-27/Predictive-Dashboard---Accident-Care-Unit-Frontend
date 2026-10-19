import type { HumanSeverityDecision, Severity, SeverityState } from '../contracts/severity';

// ── Role ────────────────────────────────────────────────────────────────────

export type Role = 'nurse' | 'doctor' | 'admin' | 'government';
export type StaffRole = Exclude<Role, 'government'>;

// ── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  hospital_id: string;
  hospital_name: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ── Severity ────────────────────────────────────────────────────────────────

export type { Severity } from '../contracts/severity';

export type TransferStatus = 'pending_authorization' | 'authorized' | 'approved' | 'rejected';
/** The accident forecast's monthly volume bands. Not patient Severity labels. */
export type ForecastVolumeBand = 'High' | 'Medium' | 'Low';
export type PredictionStatus = 'OK' | 'LOW_CONFIDENCE' | 'REFUSED' | 'UNAVAILABLE' | 'ERROR';

// ── Severity workflow (nurse) ───────────────────────────────────────────────

/** A stored Severity prediction (a Model_Prediction row). Never changed after it is made. */
export interface StoredSeverityPrediction {
  prediction_id: string;
  prediction: Severity;
  status: PredictionStatus;
  probability: number | null;
  completeness: number;
  message: string | null;
  predicted_at: string | null;
  is_defer: boolean;
  /** The inputs changed (or the episode moved) after this prediction; it cannot be decided. */
  stale: boolean;
  stale_reason: string | null;
}

/** The final human decision on a prediction (a Prediction_Decision row). */
export interface SeverityDecision {
  decision_id: string;
  prediction_id: string;
  final_decision: HumanSeverityDecision;
  decision_source: 'MODEL' | 'NURSE';
  decided_by: string;
  decided_at: string | null;
  reason: string | null;
  model_prediction: Severity;
}

export interface SeverityWorkflow {
  accident_id: string;
  state: SeverityState;
  basic_complete: boolean;
  inputs: {
    recorded: number;
    total: number;
    minimum: number | null;
    complete: boolean;
    ready: boolean;
    /** Intake field names still empty (backend names, e.g. collision_with). */
    missing: string[];
    model_available: boolean;
    model_message: string | null;
  };
  prediction: StoredSeverityPrediction | null;
  decision: SeverityDecision | null;
  final_severity: HumanSeverityDecision | null;
  locks: {
    severity_inputs: boolean;
    later_model_inputs: boolean;
    /** Intake field names the nurse can no longer change (backend names). */
    fields: string[];
  };
  can_run: boolean;
  can_accept: boolean;
  can_override: boolean;
}

export type SeverityDecisionRequest =
  | { action: 'accept' }
  | { action: 'override'; final_decision: HumanSeverityDecision; reason?: string };

// ── Doctor workflow ─────────────────────────────────────────────────────────

export type DoctorModelKey = 'stay_duration' | 'transfer' | 'discharge';

export type DoctorModelState =
  | 'WAITING_FOR_INPUTS'
  | 'NOT_RUN'
  | 'PREDICTION_AVAILABLE'
  | 'PREDICTION_FAILED'
  | 'ACCEPTED'
  | 'OVERRIDDEN';

/** A stored doctor-model prediction (a Model_Prediction row). Never changed after it is made. */
export interface StoredModelPrediction {
  prediction_id: string;
  status: PredictionStatus;
  prediction: string | null;
  probability: number | null;
  probabilities: Record<string, number>;
  completeness: number;
  message: string | null;
  predicted_at: string | null;
  stale: boolean;
  stale_reason: string | null;
}

export interface ModelDecision {
  decision_id: string;
  prediction_id: string;
  final_decision: string;
  decision_source: 'MODEL' | 'DOCTOR';
  decided_by: string;
  decided_at: string | null;
  reason: string | null;
  model_prediction: string | null;
}

export interface DoctorModelStatus {
  model_key: DoctorModelKey;
  title: string;
  /** The valid decisions for this model, in display order. */
  labels: string[];
  state: DoctorModelState;
  readiness: {
    ready: boolean;
    missing_required: string[];
    missing_features: string[];
    completeness: number | null;
    minimum_completeness: number | null;
    model_available: boolean;
    message: string | null;
  };
  prediction: StoredModelPrediction | null;
  decision: ModelDecision | null;
  final_decision: string | null;
  can_run: boolean;
  can_accept: boolean;
  can_override: boolean;
}

export interface TreatmentRecord {
  treatment_id: string;
  number_of_days_stay: number | null;
  investigation_done: string | null;
  management_name_1: string | null;
  management_name_2: string | null;
  created_at: string | null;
}

/** An episode's treatment. Entered by a nurse (can_record is true only for nurses). */
export interface TreatmentStatus {
  records: TreatmentRecord[];
  recorded: boolean;
  locked: boolean;
  lock_reason: string | null;
  can_record: boolean;
}

export interface HistoryPrediction {
  prediction_id: string;
  model_key: string;
  status: PredictionStatus;
  prediction: string | null;
  trigger_event: string;
  predicted_at: string | null;
  decisions: { decision_id: string; final_decision: string; decision_source: string; decided_at: string | null }[];
}

export interface DoctorEpisode {
  patient: { patient_id: string; full_name: string | null; age: string | null; gender: string | null };
  accident: {
    accident_id: string;
    patient_id: string;
    created_at: string | null;
    status: string | null;
    incident_at: string | null;
    collision_with: string | null;
    vehicle_type: string | null;
    mode_of_travel_during_accident: string | null;
    mode_of_transport: string | null;
    time_to_hospital: string | null;
    injuries: { injury_order?: number; site_of_injury: string | null; type_of_injury: string | null }[];
  };
  severity: SeverityWorkflow;
  treatment: TreatmentStatus;
  models: Record<DoctorModelKey, DoctorModelStatus>;
  history: {
    episodes: { accident_id: string; created_at: string | null; status: string | null }[];
    transfers: { transfer_id: string; status: string | null; requested_at: string | null; to_hospital_id: string | null }[];
    predictions: HistoryPrediction[];
  };
}

/** Compact per-episode doctor state on the hospital patient list. */
export interface DoctorWorkflowSummary {
  treatment_recorded: boolean;
  models: Record<DoctorModelKey, { state: DoctorModelState; prediction: string | null; final_decision: string | null }>;
}

export type ModelDecisionRequest =
  | { action: 'accept' }
  | { action: 'override'; final_decision: string; reason?: string };

// ── Explainability (XAI) ────────────────────────────────────────────────────

export interface XAIVOIRecord {
  field: string;
  expected_reduction_bits: number;
}

export interface XAICounterfactualRecord {
  field: string;
  max_confidence_shift: number;
  any_flip: boolean;
}

/** One factor in a SHAP explanation: its effect on the explained prediction (log-odds). */
export interface ShapFactor {
  factor: string;
  value: string;
  effect: 'strong' | 'moderate' | 'slight';
  shap: number;
}

/** SHAP explanation of one doctor-model prediction (POST /xai/explain). */
export interface XAIExplanation {
  model: string;
  title: string;
  /** False when the model cannot run yet (e.g. no treatment recorded); see message. */
  available: boolean;
  message?: string;
  prediction?: string;
  headline?: string;
  /** How the predicted outcome is phrased in "Points towards …". */
  outcome?: string;
  probabilities?: Record<string, number>;
  points_towards?: ShapFactor[];
  points_away?: ShapFactor[];
  not_recorded?: string[];
  note?: string | null;
  disclaimer: string;
  method: string;
  doctor_text?: string;
  /** The stored prediction this explains, when it is the current one. */
  prediction_id?: string | null;
}

// ── Patient ─────────────────────────────────────────────────────────────────

export interface Patient {
  id: string;
  accident_id: string;
  name: string;
  age: number | string;
  gender: 'Male' | 'Female' | 'Other' | 'Unknown';
  admission_date: string;
  collision_type: string;
  injury_description: string;
  severity: Severity;
  created_by: string;
  hospital_id: string;
  /** Stored Severity state; present on the nurse's and doctor's patient lists. */
  severity_workflow?: SeverityWorkflow;
  /** Stored doctor-model state; present on the doctor's patient list. */
  doctor_workflow?: DoctorWorkflowSummary;
}

export interface PatientIntakeForm {
  name: string;
  age: number | null;
  gender: 'Male' | 'Female' | 'Other' | '';
  collision_type: string;
  mode_of_transport: string;
  time_to_hospital: string;
  site_of_injury: string;
  type_of_injury: string;
  secondary_site_of_injury: string;
  secondary_type_of_injury: string;
  incident_at: string;
  vehicle_type: string;
  helmet_worn: string;
  road_type: string;
  speed: string;
  road_condition: string;
  visibility: string;
  road_signals_exist: string;
  collision_force_from: string;
  alcohol_consumption: string;
  illicit_drugs: string;
  // Severity model raw inputs
  mode_of_travel_during_accident: string;
  passenger_type: string;
  other_injury: string;
}

export interface TreatmentPayload {
  accident_id: string;
  /** Optional: the backend uses the nurse's own hospital. */
  hospital_id?: string;
  ward_number?: string;
  reason?: string;
  number_of_days_stay: number | null;
  investigation_done: string;
  management_name_1: string;
  management_name_2: string;
}

// ── Transfers ───────────────────────────────────────────────────────────────

export type TransferAction = 'authorize' | 'reject' | 'complete' | 'not_transferred';

/** An operational transfer request (not a model prediction or a doctor decision). */
export interface TransferRequest {
  transfer_id: string;
  accident_id: string;
  from_hospital_id: string;
  to_hospital_id: string;
  status: TransferStatus;
  request_message: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  requested_at: string | null;
  authorized_by_name: string | null;
  authorization_reason: string | null;
  authorized_at: string | null;
  rejected_by_name: string | null;
  rejection_reason: string | null;
  processed_by: string | null;
  processed_by_name: string | null;
  processed_at: string | null;
  processing_note: string | null;
  decided_at: string | null;
  state_of_transfer: string | null;
  patient_name: string | null;
  source_hospital: string | null;
  destination_hospital: string | null;
  /** What the signed-in user may do now (decided by the backend). */
  allowed_actions: TransferAction[];
}

export interface NetworkHospital {
  hospital_id: string;
  name: string;
  district: string | null;
  type: string | null;
}

export interface AdminPredictionView {
  title: string;
  state: DoctorModelState;
  prediction: {
    prediction_id: string;
    prediction: string | null;
    status: PredictionStatus;
    probability: number | null;
    predicted_at: string | null;
    stale: boolean;
    stale_reason: string | null;
  } | null;
}

export interface AdminPatientRow {
  accident_id: string;
  created_at: string | null;
  status: string | null;
  patient: { patient_id: string; full_name: string | null; age: string | null; gender: string | null };
  stay_duration: AdminPredictionView;
  transfer: AdminPredictionView;
  open_transfer: { transfer_id: string; status: TransferStatus; to_hospital_id: string } | null;
}

export interface AdminEpisode {
  accident_id: string;
  patient: AdminPatientRow['patient'];
  episode: {
    created_at: string | null;
    status: string | null;
    hospital_id: string;
    hospital_name: string | null;
    incident_at: string | null;
    injuries: { site_of_injury: string | null; type_of_injury: string | null }[];
  };
  stays: { id: string; hospital_id: string; hospital_name: string | null; entered_at: string; exited_at: string | null }[];
  predictions: { stay_duration: AdminPredictionView; transfer: AdminPredictionView };
  transfers: TransferRequest[];
  open_transfer: TransferRequest | null;
  can_request_transfer: boolean;
}

// ── Audit Logs ──────────────────────────────────────────────────────────────

export interface AuditLog {
  log_id: string;
  actor_id: string;
  actor_name: string | null;
  role: Role;
  hospital_id: string | null;
  hospital_name: string | null;
  action_type: string;
  accident_id: string | null;
  patient_name: string | null;
  timestamp: string | null;
  details: Record<string, unknown> | null;
}

// ── Hospital status ─────────────────────────────────────────────────────────

// ── Government analytics ────────────────────────────────────────────────────

export interface AccidentTrend {
  month: string;
  count: number;
}

export interface AccidentForecastPoint {
  period: string;
  predicted_accidents: number;
  lower_bound: number | null;
  upper_bound: number | null;
  risk_level: ForecastVolumeBand | null;
}

export interface AccidentForecast {
  status: PredictionStatus;
  model_name: string;
  model_version: string | null;
  points: AccidentForecastPoint[];
  message: string | null;
  risk_thresholds: {
    medium_min: number;
    high_min: number;
    method: string;
  } | null;
}

/** The notebook's strength bands, by lift. */
export type RuleStrength = 'very strong' | 'strong' | 'moderate' | 'mild';

/** One plain-language rule from Association_Rule_Mining.ipynb. */
export interface AssociationRule {
  rank: number;
  rule: string;
  interpretation: string;
  strength: RuleStrength;
  topic: string;
  accidents: number;
  confidence: number;
  lift: number;
  if_items: string[];
  then_items: string[];
}

export interface AssociationRulesResponse {
  status: string;
  total_rules: number;
  matched_rules: number;
  total_accidents: number | null;
  thresholds: { min_support?: number; min_confidence?: number; min_lift?: number };
  stability: { n_splits?: number; stability_floor?: number };
  topics: Record<string, number>;
  strengths: Record<RuleStrength, number>;
  disclaimer: string;
  rules: AssociationRule[];
  message: string | null;
}

// ── Paged lists ─────────────────────────────────────────────────────────────

/** One page of a list plus the full number of rows (the X-Total-Count header). */
export interface PagedList<T> {
  rows: T[];
  total: number;
}

// ── User creation ───────────────────────────────────────────────────────────

export interface CreateUserPayload {
  name: string;
  email: string;
  /** Leave empty to have a temporary password generated. */
  password?: string;
  role: StaffRole;
}

export interface StaffUser {
  user_id: string;
  name: string;
  email: string;
  role: Role;
  hospital_id: string | null;
  created_at: string | null;
}

export interface CreatedUser extends StaffUser {
  /** Shown once when generated; the user must replace it at first sign-in. */
  temporary_password: string | null;
  must_change_password: boolean;
}
