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

// ── Severity & Priority ─────────────────────────────────────────────────────

export type Severity = 'Critical' | 'Moderate' | 'Minor';
export type Priority = 'High' | 'Medium' | 'Low';
export type TransferStatus = 'pending_authorization' | 'authorized' | 'approved' | 'rejected';
export type RiskLevel = 'High' | 'Medium' | 'Low';
export type PredictionStatus = 'OK' | 'LOW_CONFIDENCE' | 'REFUSED' | 'UNAVAILABLE' | 'ERROR';

export interface ModelPrediction {
  prediction: string | null;
  probability: number | null;
  probabilities: Record<string, number>;
  completeness: number;
  status: PredictionStatus;
  confidence_level: 'high' | 'low' | null;
  model_name: string;
  model_version: string | null;
  message: string | null;
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
  severity: Severity | null;
  priority: Priority | null;
  predicted_los: string | null;
  severity_prediction: ModelPrediction;
  stay_duration_prediction: ModelPrediction;
  transfer_prediction: ModelPrediction;
  created_by: string;
  hospital_id: string;
}

export interface PatientIntakeForm {
  name: string;
  age: number | null;
  gender: 'Male' | 'Female' | 'Other' | '';
  collision_type: string;
  mode_of_transport: string;
  time_to_hospital: string;
  site_of_injury: string;
  secondary_site_of_injury: string;
  secondary_injury_description: string;
  injury_description: string;
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
}

// ── Prognosis ───────────────────────────────────────────────────────────────

export interface Prognosis {
  severity: ModelPrediction;
  stay_duration: ModelPrediction;
  transfer: ModelPrediction;
  discharge: ModelPrediction;
}

export interface TreatmentPayload {
  accident_id: string;
  hospital_id: string;
  ward_number?: string;
  reason?: string;
  number_of_days_stay: number | null;
  investigation_done: string;
  management_name_1: string;
  management_name_2: string;
}

// ── Transfers ───────────────────────────────────────────────────────────────

export interface TransferRequest {
  id: string;
  patient_name: string;
  source_hospital: string;
  destination_hospital: string;
  status: TransferStatus;
  requested_date: string;
}

// ── Audit Logs ──────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  user: string;
  role: Role;
  action: string;
  timestamp: string;
}

// ── Hospital status ─────────────────────────────────────────────────────────

export interface HospitalStatus {
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
}

export interface HospitalInfo {
  hospital_id: string;
  name: string;
  type: string | null;
  region: string | null;
  district: string | null;
  address: string | null;
}

// ── Government analytics ────────────────────────────────────────────────────

export interface AccidentTrend {
  month: string;
  count: number;
}

export interface RiskPrediction {
  region: string;
  risk_level: RiskLevel;
  predicted_accidents: number;
}

export interface AccidentForecastPoint {
  period: string;
  predicted_accidents: number;
  lower_bound: number | null;
  upper_bound: number | null;
  risk_level: RiskLevel | null;
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

// ── User creation ───────────────────────────────────────────────────────────

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  hospital_id: string;
}
