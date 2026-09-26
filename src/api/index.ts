/** Live FastAPI facade and response adapters used by the React components. */
import apiClient from './client';

import type {
  AccidentTrend,
  AccidentForecast,
  AuditLog,
  AuthResponse,
  CreateUserPayload,
  HospitalInfo,
  LoginCredentials,
  Patient,
  PatientIntakeForm,
  Prognosis,
  Role,
  Severity,
  TransferRequest,
  TransferStatus,
  TreatmentPayload,
  ModelPrediction,
  User,
  XAIExplanation,
} from '../types';

interface BackendUser {
  user_id: string;
  name: string;
  email: string;
  role: Role;
  hospital_id: string | null;
  hospital_name?: string | null;
}

interface BackendAuthResponse {
  token: string;
  user: BackendUser;
}

interface BackendPatient {
  patient_id: string;
  full_name: string | null;
  age: string | null;
  gender: string | null;
  accident_records?: BackendAccident[];
}

interface BackendInjury {
  site_of_injury: string | null;
  type_of_injury: string | null;
}

interface BackendAccident {
  accident_id: string;
  patient_id: string | null;
  hospital_id: string | null;
  created_by: string | null;
  created_at: string | null;
  vehicle_type: string | null;
  collision_with: string | null;
  time_to_hospital?: string | null;
  collision_force_from?: string | null;
  speed?: string | null;
  road_type?: string | null;
  Patient?: BackendPatient | BackendPatient[] | null;
  Injury_Description?: BackendInjury[] | BackendInjury | null;
  severity_prediction?: BackendSeverityPrediction | null;
  stay_duration_prediction?: BackendSeverityPrediction | null;
  transfer_prediction?: BackendSeverityPrediction | null;
}

interface BackendSeverityPrediction {
  prediction: string | null;
  probability?: number | null;
  completeness?: number;
  status?: string;
  confidence_level?: string | null;
  probabilities?: Record<string, number>;
  model_name?: string;
  model_version?: string | null;
  message?: string | null;
}

interface BackendIntakeResponse {
  patient: BackendPatient;
  accident_record: BackendAccident;
  injuries: BackendInjury[];
  severity_prediction: BackendSeverityPrediction;
  stay_duration_prediction: BackendSeverityPrediction;
  transfer_prediction: BackendSeverityPrediction;
}

interface BackendPrognosisResponse {
  severity: BackendSeverityPrediction;
  stay_duration: BackendSeverityPrediction;
  transfer: BackendSeverityPrediction;
  discharge: BackendSeverityPrediction;
}

interface BackendTransfer {
  transfer_id: string;
  accident_id: string | null;
  from_hospital_id: string | null;
  to_hospital_id: string | null;
  status: string | null;
  requested_at: string | null;
  patient_name: string | null;
  source_hospital: string | null;
  destination_hospital: string | null;
}

interface BackendAuditLog {
  log_id: string;
  actor_id: string;
  role: Role;
  action_type: string;
  timestamp: string | null;
}

function toUser(user: BackendUser): User {
  return {
    id: user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
    hospital_id: user.hospital_id ?? '',
    hospital_name: user.hospital_name
      ?? (user.role === 'government'
        ? 'Department of Health'
        : user.role === 'admin' && !user.hospital_id
          ? 'All hospitals'
          : 'Assigned hospital'),
  };
}

function firstPatient(value: BackendAccident['Patient']): BackendPatient | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function injuriesFrom(value: BackendAccident['Injury_Description']): BackendInjury[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function normalizeGender(value: string | null | undefined): Patient['gender'] {
  if (value === 'Male' || value === 'Female' || value === 'Other') return value;
  return 'Unknown';
}

function normalizeSeverity(value: string | null | undefined): Severity | null {
  const normalized = value?.toLowerCase();
  if (normalized === 'severe' || normalized === 'critical' || normalized === 'high') return 'Critical';
  if (normalized === 'minor' || normalized === 'mild' || normalized === 'low') return 'Minor';
  if (normalized === 'moderate' || normalized === 'borderline') return 'Moderate';
  return null;
}

function toPrediction(
  value: BackendSeverityPrediction | null | undefined,
  modelName: string,
): ModelPrediction {
  const allowedStatuses = ['OK', 'LOW_CONFIDENCE', 'REFUSED', 'UNAVAILABLE', 'ERROR'] as const;
  const status = allowedStatuses.find((item) => item === value?.status) ?? 'UNAVAILABLE';
  return {
    prediction: value?.prediction ?? null,
    probability: value?.probability ?? null,
    probabilities: value?.probabilities ?? {},
    completeness: value?.completeness ?? 0,
    status,
    confidence_level: value?.confidence_level === 'high' || value?.confidence_level === 'low'
      ? value.confidence_level
      : null,
    model_name: value?.model_name ?? modelName,
    model_version: value?.model_version ?? null,
    message: value?.message ?? null,
  };
}

function injurySummary(injuries: BackendInjury[]): string {
  const descriptions = injuries.flatMap((injury) => {
    if (injury.site_of_injury && injury.type_of_injury) {
      return [`${injury.site_of_injury}: ${injury.type_of_injury}`];
    }
    if (injury.site_of_injury || injury.type_of_injury) {
      return [injury.site_of_injury ?? injury.type_of_injury ?? ''];
    }
    return [];
  });
  return descriptions.join('; ') || 'No injury details recorded';
}

function toPatient(
  accident: BackendAccident,
  patientOverride?: BackendPatient,
  severityValue?: string | null,
): Patient {
  const patient = patientOverride ?? firstPatient(accident.Patient);
  const severity = normalizeSeverity(
    severityValue ?? accident.severity_prediction?.prediction,
  );
  const severityPrediction = toPrediction(accident.severity_prediction, 'severity');
  const stayDurationPrediction = toPrediction(accident.stay_duration_prediction, 'stay_duration');
  const transferPrediction = toPrediction(accident.transfer_prediction, 'transfer_probability');
  const injuries = injuriesFrom(accident.Injury_Description);

  return {
    id: patient?.patient_id ?? accident.patient_id ?? accident.accident_id,
    accident_id: accident.accident_id,
    name: patient?.full_name ?? 'Unknown patient',
    age: patient?.age ?? 'Unknown',
    gender: normalizeGender(patient?.gender),
    admission_date: accident.created_at?.slice(0, 10) ?? 'Unknown',
    collision_type: accident.collision_with ?? accident.vehicle_type ?? 'Unknown',
    injury_description: injurySummary(injuries),
    severity,
    priority: severity === 'Critical' ? 'High' : severity === 'Minor' ? 'Low' : severity ? 'Medium' : null,
    predicted_los: stayDurationPrediction.prediction,
    severity_prediction: severityPrediction,
    stay_duration_prediction: stayDurationPrediction,
    transfer_prediction: transferPrediction,
    created_by: accident.created_by ?? '',
    hospital_id: accident.hospital_id ?? '',
  };
}

function ageBucket(age: number): string {
  const normalized = Math.max(1, Math.min(100, Math.trunc(age)));
  if (normalized <= 9) return '1-9';
  const lower = Math.min(Math.floor(normalized / 10) * 10, 90);
  return `${lower}-${lower === 90 ? 100 : lower + 9}`;
}

function normalizeTransferStatus(status: string | null): TransferStatus {
  if (
    status === 'authorized'
    || status === 'approved'
    || status === 'rejected'
  ) return status;
  return 'pending_authorization';
}

function shortId(value: string | null): string {
  if (!value) return 'Unknown';
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const { data } = await apiClient.post<BackendAuthResponse>('/auth/login', credentials);
  return { token: data.token, user: toUser(data.user) };
}

// ── Nurse ───────────────────────────────────────────────────────────────────

export async function submitPatientIntake(
  form: PatientIntakeForm,
  hospitalId: string,
): Promise<Patient> {
  const { data } = await apiClient.post<BackendIntakeResponse>('/patients/intake', {
    full_name: form.name,
    age: form.age === null ? null : ageBucket(form.age),
    gender: form.gender || null,
    hospital_id: hospitalId || null,
    first_hospital_id: hospitalId || null,
    mode_of_transport: form.mode_of_transport || null,
    time_to_hospital: form.time_to_hospital || null,
    collision_with: form.collision_type || null,
    incident_at: form.incident_at || null,
    vehicle_type: form.vehicle_type || null,
    helmet_worn: form.helmet_worn || null,
    road_type: form.road_type || null,
    speed: form.speed || null,
    road_condition: form.road_condition || null,
    visibility: form.visibility || null,
    road_signals_exist: form.road_signals_exist || null,
    collision_force_from: form.collision_force_from || null,
    alcohol_consumption: form.alcohol_consumption || null,
    illicit_drugs: form.illicit_drugs || null,
    injuries: [
      ...(form.site_of_injury || form.injury_description
        ? [{
            site_of_injury: form.site_of_injury || null,
            type_of_injury: form.injury_description || null,
          }]
        : []),
      ...(form.secondary_site_of_injury || form.secondary_injury_description
        ? [{
            site_of_injury: form.secondary_site_of_injury || null,
            type_of_injury: form.secondary_injury_description || null,
          }]
        : []),
    ],
  });

  return toPatient(
    {
      ...data.accident_record,
      Injury_Description: data.injuries,
      severity_prediction: data.severity_prediction,
      stay_duration_prediction: data.stay_duration_prediction,
      transfer_prediction: data.transfer_prediction,
    },
    data.patient,
    data.severity_prediction.prediction,
  );
}

export async function getMyPatients(): Promise<Patient[]> {
  const { data } = await apiClient.get<BackendAccident[]>('/patients/my');
  return data.map((accident) => toPatient(accident));
}

// ── Doctor ──────────────────────────────────────────────────────────────────

export async function getHospitalPatients(hospitalId: string): Promise<Patient[]> {
  const { data } = await apiClient.get<BackendAccident[]>(
    `/patients/hospital/${hospitalId}`,
  );
  return data.map((accident) => toPatient(accident));
}

export async function getPatientById(patientId: string): Promise<Patient | undefined> {
  const { data } = await apiClient.get<BackendPatient>(`/patients/${patientId}`);
  const accidents = data.accident_records ?? [];
  const latest = [...accidents].sort((left, right) =>
    (right.created_at ?? '').localeCompare(left.created_at ?? ''),
  )[0];
  if (!latest) return undefined;
  return toPatient(latest, data);
}

export async function getPatientPrognosis(patientId: string): Promise<Prognosis> {
  const { data } = await apiClient.get<BackendPrognosisResponse>(
    `/patients/${patientId}/prognosis`,
  );
  return {
    severity: toPrediction(data.severity, 'severity'),
    stay_duration: toPrediction(data.stay_duration, 'stay_duration'),
    transfer: toPrediction(data.transfer, 'transfer_probability'),
    discharge: toPrediction(data.discharge, 'discharge_outcome'),
  };
}

export async function createTreatment(payload: TreatmentPayload): Promise<void> {
  await apiClient.post('/treatments', {
    ...payload,
    ward_number: payload.ward_number || null,
    reason: payload.reason || null,
    investigation_done: payload.investigation_done || null,
    management_name_1: payload.management_name_1 || null,
    management_name_2: payload.management_name_2 || null,
  });
}

// ── Explainability ──────────────────────────────────────────────────────────

export async function getExplanation(
  modelName: string,
  accidentId: string,
): Promise<XAIExplanation> {
  const { data } = await apiClient.post<XAIExplanation>('/xai/explain', {
    model_name: modelName,
    accident_id: accidentId,
  });
  return data;
}

// ── Admin ───────────────────────────────────────────────────────────────────

export async function getHospital(hospitalId: string): Promise<HospitalInfo> {
  const { data } = await apiClient.get<HospitalInfo>(`/admin/hospitals/${hospitalId}`);
  return data;
}

export async function getHospitals(): Promise<HospitalInfo[]> {
  const { data } = await apiClient.get<HospitalInfo[]>('/admin/hospitals');
  return data;
}

export function getAdmittedPatients(hospitalId: string): Promise<Patient[]> {
  return getHospitalPatients(hospitalId);
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const { data } = await apiClient.post<BackendUser>('/admin/users', payload);
  return toUser(data);
}

export async function getTransferRequests(): Promise<TransferRequest[]> {
  const { data } = await apiClient.get<BackendTransfer[]>('/admin/transfers');
  return data.map((transfer) => ({
    id: transfer.transfer_id,
    patient_name: transfer.patient_name ?? `Accident ${shortId(transfer.accident_id)}`,
    source_hospital: transfer.source_hospital ?? shortId(transfer.from_hospital_id),
    destination_hospital: transfer.destination_hospital ?? shortId(transfer.to_hospital_id),
    status: normalizeTransferStatus(transfer.status),
    requested_date: transfer.requested_at?.slice(0, 10) ?? 'Unknown',
  }));
}

export async function updateTransferStatus(
  id: string,
  status: TransferStatus,
): Promise<TransferRequest> {
  await apiClient.patch(`/admin/transfers/${id}/status`, { status });
  const transfers = await getTransferRequests();
  const updated = transfers.find((transfer) => transfer.id === id);
  if (!updated) throw new Error('Updated transfer was not returned by the API.');
  return updated;
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const { data } = await apiClient.get<BackendAuditLog[]>('/admin/audit-logs');
  return data.map((log) => ({
    id: log.log_id,
    user: shortId(log.actor_id),
    role: log.role,
    action: log.action_type.split('_').join(' '),
    timestamp: log.timestamp ?? new Date(0).toISOString(),
  }));
}

// ── Government ──────────────────────────────────────────────────────────────

export async function getAccidentTrends(): Promise<AccidentTrend[]> {
  const { data } = await apiClient.get<AccidentTrend[]>('/government/accident-trends');
  return data;
}

export async function getHistoricalAccidentTrends(): Promise<AccidentTrend[]> {
  const { data } = await apiClient.get<AccidentTrend[]>(
    '/government/accident-historical-trends',
  );
  return data;
}

export async function getAccidentForecast(horizon = 6): Promise<AccidentForecast> {
  const { data } = await apiClient.get<AccidentForecast>(
    `/government/accident-forecast?horizon=${horizon}`,
  );
  return data;
}
