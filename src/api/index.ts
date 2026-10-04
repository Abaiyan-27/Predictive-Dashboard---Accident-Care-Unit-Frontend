/** Live FastAPI facade and response adapters used by the React components. */
import apiClient from './client';
import { toSeverity } from '../contracts/severity';

import type {
  AccidentTrend,
  AccidentForecast,
  AssociationRulesResponse,
  GovernmentStatistics,
  ModelKey,
  ModelSummary,
  AdminEpisode,
  AdminPatientRow,
  AuditLog,
  AuthResponse,
  CreatedUser,
  CreateUserPayload,
  NetworkHospital,
  PagedList,
  StaffUser,
  LoginCredentials,
  Patient,
  PatientIntakeForm,
  Role,
  TransferRequest,
  TreatmentPayload,
  DoctorEpisode,
  DoctorWorkflowSummary,
  ModelDecisionRequest,
  SeverityDecisionRequest,
  SeverityWorkflow,
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
  /** 1 = primary injury, 2 = secondary injury. */
  injury_order?: 1 | 2;
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
  mode_of_transport?: string | null;
  incident_at?: string | null;
  helmet_worn?: string | null;
  road_condition?: string | null;
  visibility?: string | null;
  road_signals_exist?: string | null;
  alcohol_consumption?: string | null;
  illicit_drugs?: string | null;
  mode_of_travel_during_accident?: string | null;
  passenger_type?: string | null;
  other_injury?: string | null;
  severity_workflow?: SeverityWorkflow;
  doctor_workflow?: DoctorWorkflowSummary;
}

/** Saving intake runs no model; the response reports the stored Severity state. */
interface BackendIntakeResponse {
  patient: BackendPatient;
  accident_record: BackendAccident;
  injuries: BackendInjury[];
  severity: SeverityWorkflow;
}

export interface IntakeResult {
  patient: Patient;
  severity: SeverityWorkflow;
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
        : user.hospital_id
          ? 'Assigned hospital'
          : 'No hospital assigned'),
  };
}

function firstPatient(value: BackendAccident['Patient']): BackendPatient | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function injuriesFrom(value: BackendAccident['Injury_Description']): BackendInjury[] {
  const rows = Array.isArray(value) ? value : value ? [value] : [];
  return [...rows].sort((left, right) => (left.injury_order ?? 0) - (right.injury_order ?? 0));
}

/** Primary and secondary injury picked by their stored order, never by list position. */
function injurySlots(value: BackendAccident['Injury_Description']): [BackendInjury, BackendInjury] {
  const empty: BackendInjury = { site_of_injury: null, type_of_injury: null };
  const rows = injuriesFrom(value);
  return [
    rows.find((row) => row.injury_order === 1) ?? empty,
    rows.find((row) => row.injury_order === 2) ?? empty,
  ];
}

/** Injuries for the intake API, each tagged with its slot so a lone secondary stays secondary. */
function injuryPayload(form: Partial<PatientIntakeForm>) {
  return [
    ...(form.site_of_injury || form.type_of_injury
      ? [{
          injury_order: 1,
          site_of_injury: form.site_of_injury || null,
          type_of_injury: form.type_of_injury || null,
        }]
      : []),
    ...(form.secondary_site_of_injury || form.secondary_type_of_injury
      ? [{
          injury_order: 2,
          site_of_injury: form.secondary_site_of_injury || null,
          type_of_injury: form.secondary_type_of_injury || null,
        }]
      : []),
  ];
}

function normalizeGender(value: string | null | undefined): Patient['gender'] {
  if (value === 'Male' || value === 'Female' || value === 'Other') return value;
  return 'Unknown';
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
  const workflow = accident.severity_workflow;
  const severity = toSeverity(
    severityValue
      ?? (workflow ? workflow.final_severity ?? workflow.prediction?.prediction : undefined),
  );
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
    created_by: accident.created_by ?? '',
    hospital_id: accident.hospital_id ?? '',
    severity_workflow: workflow,
    doctor_workflow: accident.doctor_workflow,
  };
}

// Age bucketing is now handled on the backend.

// ── Auth ────────────────────────────────────────────────────────────────────

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const { data } = await apiClient.post<BackendAuthResponse>('/auth/login', credentials);
  return { token: data.token, user: toUser(data.user) };
}

// ── Nurse ───────────────────────────────────────────────────────────────────

export async function submitPatientIntake(
  form: PatientIntakeForm,
  hospitalId: string,
): Promise<IntakeResult> {
  const { data } = await apiClient.post<BackendIntakeResponse>('/patients/intake', {
    full_name: form.name,
    age: form.age === null ? null : form.age.toString(),
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
    // Severity model raw inputs
    mode_of_travel_during_accident: form.mode_of_travel_during_accident || null,
    passenger_type: form.passenger_type || null,
    other_injury: form.other_injury || null,
    injuries: injuryPayload(form),
  });

  return toIntakeResult(data);
}

function toIntakeResult(data: BackendIntakeResponse): IntakeResult {
  return {
    patient: toPatient(
      { ...data.accident_record, Injury_Description: data.injuries, severity_workflow: data.severity },
      data.patient,
    ),
    severity: data.severity,
  };
}

/** Saves the given intake fields. The hospital is taken from the account by the backend. */
export async function updatePatientIntake(
  accidentId: string,
  form: Partial<PatientIntakeForm>,
): Promise<IntakeResult> {
  const payload: Record<string, unknown> = {
    full_name: form.name || undefined,
    age: form.age === null ? null : (form.age !== undefined ? form.age.toString() : undefined),
    gender: form.gender !== undefined ? (form.gender || null) : undefined,
    mode_of_transport: form.mode_of_transport !== undefined ? (form.mode_of_transport || null) : undefined,
    time_to_hospital: form.time_to_hospital !== undefined ? (form.time_to_hospital || null) : undefined,
    collision_with: form.collision_type !== undefined ? (form.collision_type || null) : undefined,
    incident_at: form.incident_at !== undefined ? (form.incident_at || null) : undefined,
    vehicle_type: form.vehicle_type !== undefined ? (form.vehicle_type || null) : undefined,
    helmet_worn: form.helmet_worn !== undefined ? (form.helmet_worn || null) : undefined,
    road_type: form.road_type !== undefined ? (form.road_type || null) : undefined,
    speed: form.speed !== undefined ? (form.speed || null) : undefined,
    road_condition: form.road_condition !== undefined ? (form.road_condition || null) : undefined,
    visibility: form.visibility !== undefined ? (form.visibility || null) : undefined,
    road_signals_exist: form.road_signals_exist !== undefined ? (form.road_signals_exist || null) : undefined,
    collision_force_from: form.collision_force_from !== undefined ? (form.collision_force_from || null) : undefined,
    alcohol_consumption: form.alcohol_consumption !== undefined ? (form.alcohol_consumption || null) : undefined,
    illicit_drugs: form.illicit_drugs !== undefined ? (form.illicit_drugs || null) : undefined,
    mode_of_travel_during_accident: form.mode_of_travel_during_accident !== undefined ? (form.mode_of_travel_during_accident || null) : undefined,
    passenger_type: form.passenger_type !== undefined ? (form.passenger_type || null) : undefined,
    other_injury: form.other_injury !== undefined ? (form.other_injury || null) : undefined,
  };

  if (form.site_of_injury !== undefined || form.type_of_injury !== undefined || form.secondary_site_of_injury !== undefined || form.secondary_type_of_injury !== undefined) {
    payload.injuries = injuryPayload(form);
  }

  const { data } = await apiClient.patch<BackendIntakeResponse>(`/patients/intake/${accidentId}`, payload);

  return toIntakeResult(data);
}

export async function getSeverityStatus(accidentId: string): Promise<SeverityWorkflow> {
  const { data } = await apiClient.get<SeverityWorkflow>(`/severity/accidents/${accidentId}`);
  return data;
}

/** Runs the real Severity model on the saved inputs; 422 while required inputs are missing. */
export async function runSeverity(accidentId: string): Promise<SeverityWorkflow> {
  const { data } = await apiClient.post<SeverityWorkflow>(`/severity/accidents/${accidentId}/run`);
  return data;
}

/** Records the nurse's final decision on the exact prediction shown on screen. */
export async function decideSeverity(
  predictionId: string,
  decision: SeverityDecisionRequest,
): Promise<SeverityWorkflow> {
  const { data } = await apiClient.post<SeverityWorkflow>(
    `/severity/predictions/${predictionId}/decision`,
    decision,
  );
  return data;
}

/** Every patient record at the nurse's hospital (the backend path is /patients/my for historical reasons). */
export const PAGE_SIZE = 50;

/** A paged list request: the rows and the full size from the X-Total-Count header. */
async function getPage<T>(path: string, offset: number): Promise<PagedList<T>> {
  const response = await apiClient.get<T[]>(path, { params: { limit: PAGE_SIZE, offset } });
  const header = Number(response.headers['x-total-count']);
  return { rows: response.data, total: Number.isFinite(header) ? header : offset + response.data.length };
}

export async function getHospitalPatientRecords(offset = 0): Promise<PagedList<Patient>> {
  const page = await getPage<BackendAccident>('/patients/my', offset);
  return { rows: page.rows.map((accident) => toPatient(accident)), total: page.total };
}

// ── Doctor ──────────────────────────────────────────────────────────────────

export async function getHospitalPatients(hospitalId: string, offset = 0): Promise<PagedList<Patient>> {
  const page = await getPage<BackendAccident>(`/patients/hospital/${hospitalId}`, offset);
  return { rows: page.rows.map((accident) => toPatient(accident)), total: page.total };
}

export async function getPatientDetail(patientId: string): Promise<{ patient: BackendPatient, accident: BackendAccident, injuries: BackendInjury[] }> {
  const { data } = await apiClient.get<BackendPatient>(`/patients/${patientId}`);
  const accidents = data.accident_records ?? [];
  const latest = [...accidents].sort((left, right) =>
    (right.created_at ?? '').localeCompare(left.created_at ?? ''),
  )[0];
  if (!latest) throw new Error("No accident record found");
  return {
    patient: data,
    accident: latest,
    injuries: injurySlots(latest.Injury_Description)
  };
}

/** The doctor's view of one episode: Severity (read-only), treatment, the three doctor models, history. */
export async function getDoctorEpisode(accidentId: string): Promise<DoctorEpisode> {
  const { data } = await apiClient.get<DoctorEpisode>(`/doctor/accidents/${accidentId}`);
  return data;
}

/** Runs the undecided doctor models whose inputs are complete; 422 while inputs are missing. */
export async function runDoctorModels(accidentId: string): Promise<DoctorEpisode> {
  const { data } = await apiClient.post<DoctorEpisode>(`/doctor/accidents/${accidentId}/run`);
  return data;
}

/** Records the doctor's decision on the exact prediction shown on screen. */
export async function decideDoctorModel(
  accidentId: string,
  predictionId: string,
  decision: ModelDecisionRequest,
): Promise<DoctorEpisode> {
  const { data } = await apiClient.post<DoctorEpisode>(
    `/doctor/accidents/${accidentId}/predictions/${predictionId}/decision`,
    decision,
  );
  return data;
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

/** The admin's patients: basics, Stay and Transfer predictions, open transfer. */
export async function getAdminPatients(offset = 0): Promise<PagedList<AdminPatientRow>> {
  return getPage<AdminPatientRow>('/admin/patients', offset);
}

/** One episode, read-only: basics, hospital stays, Stay/Transfer predictions, transfers. */
export async function getAdminEpisode(accidentId: string): Promise<AdminEpisode> {
  const { data } = await apiClient.get<AdminEpisode>(`/admin/episodes/${accidentId}`);
  return data;
}

export async function getNetworkHospitals(): Promise<NetworkHospital[]> {
  const { data } = await apiClient.get<NetworkHospital[]>('/admin/network-hospitals');
  return data;
}

export async function getStaffUsers(): Promise<StaffUser[]> {
  const { data } = await apiClient.get<StaffUser[]>('/admin/users');
  return data;
}

/** Creates a staff account at the admin's own hospital (the backend sets the hospital). */
export async function createUser(payload: CreateUserPayload): Promise<CreatedUser> {
  const { data } = await apiClient.post<CreatedUser>('/admin/users', {
    ...payload,
    password: payload.password || undefined,
  });
  return data;
}

export async function getTransferRequests(offset = 0): Promise<PagedList<TransferRequest>> {
  return getPage<TransferRequest>('/admin/transfers', offset);
}

export async function createTransferRequest(
  accidentId: string,
  toHospitalId: string,
  message: string,
): Promise<TransferRequest> {
  const { data } = await apiClient.post<TransferRequest>('/admin/transfers', {
    accident_id: accidentId,
    to_hospital_id: toHospitalId,
    message,
  });
  return data;
}

export async function authorizeTransfer(transferId: string, note?: string): Promise<TransferRequest> {
  const { data } = await apiClient.post<TransferRequest>(`/admin/transfers/${transferId}/authorize`, note ? { note } : {});
  return data;
}

export async function rejectTransfer(transferId: string, reason: string): Promise<TransferRequest> {
  const { data } = await apiClient.post<TransferRequest>(`/admin/transfers/${transferId}/reject`, { reason });
  return data;
}

export interface AuditLogQuery {
  action?: string;
  accidentId?: string;
  limit?: number;
  offset?: number;
}

export async function getAuditLogs(query: AuditLogQuery = {}): Promise<AuditLog[]> {
  const { data } = await apiClient.get<AuditLog[]>('/admin/audit-logs', {
    params: {
      action: query.action || undefined,
      accident_id: query.accidentId || undefined,
      limit: query.limit,
      offset: query.offset,
    },
  });
  return data;
}

// ── Nurse: transfer requests ────────────────────────────────────────────────

export async function getNurseTransferRequests(): Promise<TransferRequest[]> {
  const { data } = await apiClient.get<TransferRequest[]>('/patients/transfer-requests');
  return data;
}

export async function getTransferStates(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/patients/transfer-states');
  return data;
}

/** Records whether an authorized transfer physically happened. */
export async function processTransferRequest(
  transferId: string,
  body: { outcome: 'transferred'; state_of_transfer: string; note?: string } | { outcome: 'not_transferred'; note: string },
): Promise<TransferRequest> {
  const { data } = await apiClient.post<TransferRequest>(`/patients/transfer-requests/${transferId}/process`, body);
  return data;
}

// ── Auth: first sign-in password change ─────────────────────────────────────

export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

export async function changePassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/change-password', {
    email,
    current_password: currentPassword,
    new_password: newPassword,
  });
}

// ── Government ──────────────────────────────────────────────────────────────

/** Network-wide statistics: counts of records and operational transfer requests by status. */
export async function getGovernmentStatistics(): Promise<GovernmentStatistics> {
  const { data } = await apiClient.get<GovernmentStatistics>('/government/statistics');
  return data;
}

/** Aggregate statistics for one patient model, across every hospital. */
export async function getModelSummary(model: ModelKey): Promise<ModelSummary> {
  const { data } = await apiClient.get<ModelSummary>(`/government/models/${model}`);
  return data;
}

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

export async function getAssociationRules(
  options: { consequent?: string; limit?: number; sortBy?: string } = {},
): Promise<AssociationRulesResponse> {
  const params = new URLSearchParams();
  if (options.consequent) params.set('consequent', options.consequent);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.sortBy) params.set('sort_by', options.sortBy);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const { data } = await apiClient.get<AssociationRulesResponse>(
    `/government/association-rules${qs}`,
  );
  return data;
}
