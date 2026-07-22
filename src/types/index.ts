// ── Role ────────────────────────────────────────────────────────────────────

export type Role = 'nurse' | 'doctor' | 'admin' | 'government';

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
export type TransferStatus = 'pending' | 'approved' | 'rejected';
export type RiskLevel = 'High' | 'Medium' | 'Low';

// ── Patient ─────────────────────────────────────────────────────────────────

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  admission_date: string;
  collision_type: string;
  injury_description: string;
  severity: Severity;
  priority: Priority;
  predicted_los_days: number;
  created_by: string;
  hospital_id: string;
}

export interface PatientIntakeForm {
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  collision_type: string;
  injury_description: string;
}

// ── Prognosis ───────────────────────────────────────────────────────────────

export interface Prognosis {
  expected_recovery_level: string;
  partial_recovery_probability: number;
  transfer_recommendation: string;
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

// ── User creation ───────────────────────────────────────────────────────────

export interface CreateUserPayload {
  name: string;
  email: string;
  role: Role;
  hospital_id: string;
}
