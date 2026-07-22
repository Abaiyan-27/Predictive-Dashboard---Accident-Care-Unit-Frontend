import type {
  AccidentTrend,
  AuditLog,
  AuthResponse,
  CreateUserPayload,
  HospitalStatus,
  LoginCredentials,
  Patient,
  PatientIntakeForm,
  Priority,
  Prognosis,
  RiskPrediction,
  Severity,
  TransferRequest,
  TransferStatus,
  User,
} from '../types';

// ── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms?: number): Promise<void> {
  const duration = ms ?? 200 + Math.random() * 600;
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function randomId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ── Demo users ──────────────────────────────────────────────────────────────

export const DEMO_USERS: Record<string, { password: string; user: User }> = {
  'nurse@accidentcare.org': {
    password: 'demo',
    user: {
      id: 'u-nurse-01',
      name: 'Sarah Chen',
      email: 'nurse@accidentcare.org',
      role: 'nurse',
      hospital_id: 'h-001',
      hospital_name: 'City General Hospital',
    },
  },
  'doctor@accidentcare.org': {
    password: 'demo',
    user: {
      id: 'u-doctor-01',
      name: 'Dr. James Okafor',
      email: 'doctor@accidentcare.org',
      role: 'doctor',
      hospital_id: 'h-001',
      hospital_name: 'City General Hospital',
    },
  },
  'admin@accidentcare.org': {
    password: 'demo',
    user: {
      id: 'u-admin-01',
      name: 'Priya Sharma',
      email: 'admin@accidentcare.org',
      role: 'admin',
      hospital_id: 'h-001',
      hospital_name: 'City General Hospital',
    },
  },
  'gov@accidentcare.org': {
    password: 'demo',
    user: {
      id: 'u-gov-01',
      name: 'Michael Torres',
      email: 'gov@accidentcare.org',
      role: 'government',
      hospital_id: 'gov-central',
      hospital_name: 'Department of Health',
    },
  },
};

// ── Mock patient data ───────────────────────────────────────────────────────

const severities: Severity[] = ['Critical', 'Moderate', 'Minor'];
const priorities: Priority[] = ['High', 'Medium', 'Low'];
const collisionTypes = [
  'Vehicle-Vehicle',
  'Vehicle-Pedestrian',
  'Single Vehicle',
  'Vehicle-Bicycle',
  'Multi-Vehicle Pileup',
  'Other',
];

const MOCK_PATIENTS: Patient[] = [
  {
    id: 'p-001',
    name: 'Amara Obi',
    age: 34,
    gender: 'Female',
    admission_date: '2026-07-18',
    collision_type: 'Vehicle-Vehicle',
    injury_description: 'Fractured left femur and multiple lacerations to the forearm',
    severity: 'Critical',
    priority: 'High',
    predicted_los_days: 14,
    created_by: 'u-nurse-01',
    hospital_id: 'h-001',
  },
  {
    id: 'p-002',
    name: 'David Park',
    age: 28,
    gender: 'Male',
    admission_date: '2026-07-19',
    collision_type: 'Vehicle-Pedestrian',
    injury_description: 'Concussion with mild traumatic brain injury, bruised ribs',
    severity: 'Critical',
    priority: 'High',
    predicted_los_days: 10,
    created_by: 'u-nurse-01',
    hospital_id: 'h-001',
  },
  {
    id: 'p-003',
    name: 'Fatima Al-Rashid',
    age: 45,
    gender: 'Female',
    admission_date: '2026-07-19',
    collision_type: 'Single Vehicle',
    injury_description: 'Whiplash and cervical spine strain, minor glass cuts',
    severity: 'Moderate',
    priority: 'Medium',
    predicted_los_days: 5,
    created_by: 'u-nurse-01',
    hospital_id: 'h-001',
  },
  {
    id: 'p-004',
    name: 'Liam O\'Connor',
    age: 22,
    gender: 'Male',
    admission_date: '2026-07-20',
    collision_type: 'Vehicle-Bicycle',
    injury_description: 'Dislocated shoulder and road rash on left side',
    severity: 'Moderate',
    priority: 'Medium',
    predicted_los_days: 3,
    created_by: 'u-nurse-01',
    hospital_id: 'h-001',
  },
  {
    id: 'p-005',
    name: 'Maria Santos',
    age: 57,
    gender: 'Female',
    admission_date: '2026-07-20',
    collision_type: 'Multi-Vehicle Pileup',
    injury_description: 'Chest contusion, suspected internal bleeding, fractured wrist',
    severity: 'Critical',
    priority: 'High',
    predicted_los_days: 18,
    created_by: 'u-nurse-01',
    hospital_id: 'h-001',
  },
  {
    id: 'p-006',
    name: 'Raj Patel',
    age: 41,
    gender: 'Male',
    admission_date: '2026-07-20',
    collision_type: 'Vehicle-Vehicle',
    injury_description: 'Mild concussion, seatbelt abrasion across chest',
    severity: 'Minor',
    priority: 'Low',
    predicted_los_days: 2,
    created_by: 'u-nurse-01',
    hospital_id: 'h-001',
  },
  {
    id: 'p-007',
    name: 'Elena Volkov',
    age: 33,
    gender: 'Female',
    admission_date: '2026-07-21',
    collision_type: 'Vehicle-Pedestrian',
    injury_description: 'Tibial fracture, severe ankle sprain, abdominal bruising',
    severity: 'Critical',
    priority: 'High',
    predicted_los_days: 12,
    created_by: 'u-nurse-01',
    hospital_id: 'h-001',
  },
  {
    id: 'p-008',
    name: 'Thomas Weber',
    age: 19,
    gender: 'Male',
    admission_date: '2026-07-21',
    collision_type: 'Single Vehicle',
    injury_description: 'Minor bruising and shallow lacerations from windshield glass',
    severity: 'Minor',
    priority: 'Low',
    predicted_los_days: 1,
    created_by: 'u-nurse-01',
    hospital_id: 'h-001',
  },
  {
    id: 'p-009',
    name: 'Aisha Mohammed',
    age: 50,
    gender: 'Female',
    admission_date: '2026-07-21',
    collision_type: 'Vehicle-Vehicle',
    injury_description: 'Lumbar vertebrae compression, hip contusion',
    severity: 'Moderate',
    priority: 'Medium',
    predicted_los_days: 7,
    created_by: 'u-nurse-01',
    hospital_id: 'h-001',
  },
  {
    id: 'p-010',
    name: 'Carlos Mendez',
    age: 38,
    gender: 'Male',
    admission_date: '2026-07-22',
    collision_type: 'Vehicle-Bicycle',
    injury_description: 'Broken collarbone, road rash on right leg and arm',
    severity: 'Moderate',
    priority: 'Medium',
    predicted_los_days: 4,
    created_by: 'u-nurse-01',
    hospital_id: 'h-001',
  },
  {
    id: 'p-011',
    name: 'Sophie Laurent',
    age: 26,
    gender: 'Female',
    admission_date: '2026-07-22',
    collision_type: 'Multi-Vehicle Pileup',
    injury_description: 'Bilateral rib fractures, pneumothorax under observation',
    severity: 'Critical',
    priority: 'High',
    predicted_los_days: 16,
    created_by: 'u-nurse-01',
    hospital_id: 'h-001',
  },
  {
    id: 'p-012',
    name: 'Kenji Tanaka',
    age: 62,
    gender: 'Male',
    admission_date: '2026-07-22',
    collision_type: 'Vehicle-Pedestrian',
    injury_description: 'Sprained ankle and knee contusion, minor abrasions',
    severity: 'Minor',
    priority: 'Low',
    predicted_los_days: 2,
    created_by: 'u-nurse-01',
    hospital_id: 'h-001',
  },
];

// ── Mock transfer requests ──────────────────────────────────────────────────

const MOCK_TRANSFERS: TransferRequest[] = [
  {
    id: 'tr-001',
    patient_name: 'Maria Santos',
    source_hospital: 'City General Hospital',
    destination_hospital: 'Regional Trauma Center',
    status: 'pending',
    requested_date: '2026-07-21',
  },
  {
    id: 'tr-002',
    patient_name: 'Sophie Laurent',
    source_hospital: 'City General Hospital',
    destination_hospital: 'University Medical Center',
    status: 'pending',
    requested_date: '2026-07-22',
  },
  {
    id: 'tr-003',
    patient_name: 'David Park',
    source_hospital: 'City General Hospital',
    destination_hospital: 'Neurology Specialty Hospital',
    status: 'approved',
    requested_date: '2026-07-19',
  },
  {
    id: 'tr-004',
    patient_name: 'Raj Patel',
    source_hospital: 'Westside Clinic',
    destination_hospital: 'City General Hospital',
    status: 'rejected',
    requested_date: '2026-07-20',
  },
  {
    id: 'tr-005',
    patient_name: 'Elena Volkov',
    source_hospital: 'City General Hospital',
    destination_hospital: 'Regional Trauma Center',
    status: 'pending',
    requested_date: '2026-07-22',
  },
];

// ── Mock audit logs ─────────────────────────────────────────────────────────

const MOCK_AUDIT_LOGS: AuditLog[] = [
  { id: 'log-001', user: 'Sarah Chen', role: 'nurse', action: 'Created patient record for Amara Obi', timestamp: '2026-07-18T09:14:00Z' },
  { id: 'log-002', user: 'Dr. James Okafor', role: 'doctor', action: 'Viewed prognosis for David Park', timestamp: '2026-07-19T10:32:00Z' },
  { id: 'log-003', user: 'Sarah Chen', role: 'nurse', action: 'Created patient record for Fatima Al-Rashid', timestamp: '2026-07-19T11:05:00Z' },
  { id: 'log-004', user: 'Priya Sharma', role: 'admin', action: 'Approved transfer request for David Park', timestamp: '2026-07-19T14:20:00Z' },
  { id: 'log-005', user: 'Sarah Chen', role: 'nurse', action: 'Created patient record for Liam O\'Connor', timestamp: '2026-07-20T08:45:00Z' },
  { id: 'log-006', user: 'Priya Sharma', role: 'admin', action: 'Created new user account for Dr. Anil Kapoor', timestamp: '2026-07-20T09:30:00Z' },
  { id: 'log-007', user: 'Priya Sharma', role: 'admin', action: 'Rejected transfer request for Raj Patel', timestamp: '2026-07-20T15:10:00Z' },
  { id: 'log-008', user: 'Dr. James Okafor', role: 'doctor', action: 'Viewed prognosis for Maria Santos', timestamp: '2026-07-20T16:00:00Z' },
  { id: 'log-009', user: 'Sarah Chen', role: 'nurse', action: 'Created patient record for Elena Volkov', timestamp: '2026-07-21T07:55:00Z' },
  { id: 'log-010', user: 'Michael Torres', role: 'government', action: 'Accessed monthly accident trends report', timestamp: '2026-07-21T10:00:00Z' },
  { id: 'log-011', user: 'Dr. James Okafor', role: 'doctor', action: 'Viewed prognosis for Sophie Laurent', timestamp: '2026-07-22T08:15:00Z' },
  { id: 'log-012', user: 'Priya Sharma', role: 'admin', action: 'Requested transfer for Sophie Laurent', timestamp: '2026-07-22T09:00:00Z' },
];

// ── Mock accident trends ────────────────────────────────────────────────────

const MOCK_TRENDS: AccidentTrend[] = [
  { month: 'Aug 2025', count: 142 },
  { month: 'Sep 2025', count: 128 },
  { month: 'Oct 2025', count: 156 },
  { month: 'Nov 2025', count: 189 },
  { month: 'Dec 2025', count: 210 },
  { month: 'Jan 2026', count: 198 },
  { month: 'Feb 2026', count: 167 },
  { month: 'Mar 2026', count: 145 },
  { month: 'Apr 2026', count: 132 },
  { month: 'May 2026', count: 158 },
  { month: 'Jun 2026', count: 174 },
  { month: 'Jul 2026', count: 191 },
];

// ── Mock risk predictions ───────────────────────────────────────────────────

const MOCK_RISK_PREDICTIONS: RiskPrediction[] = [
  { region: 'Downtown Core', risk_level: 'High', predicted_accidents: 87 },
  { region: 'Highway 401 Corridor', risk_level: 'High', predicted_accidents: 104 },
  { region: 'Suburban East', risk_level: 'Medium', predicted_accidents: 45 },
  { region: 'Industrial District', risk_level: 'Medium', predicted_accidents: 52 },
  { region: 'Residential North', risk_level: 'Low', predicted_accidents: 18 },
];

// ── Mock hospital status ────────────────────────────────────────────────────

const MOCK_HOSPITAL_STATUS: HospitalStatus = {
  total_beds: 120,
  occupied_beds: 87,
  available_beds: 33,
};

// ── Prognosis templates ─────────────────────────────────────────────────────

const PROGNOSIS_MAP: Record<string, Prognosis> = {
  'p-001': { expected_recovery_level: 'Partial Recovery', partial_recovery_probability: 68, transfer_recommendation: 'Transfer to Regional Trauma Center recommended for orthopedic surgery' },
  'p-002': { expected_recovery_level: 'Full Recovery', partial_recovery_probability: 85, transfer_recommendation: 'Transfer to Neurology Specialty Hospital recommended for TBI monitoring' },
  'p-003': { expected_recovery_level: 'Full Recovery', partial_recovery_probability: 94, transfer_recommendation: 'No transfer needed' },
  'p-004': { expected_recovery_level: 'Full Recovery', partial_recovery_probability: 97, transfer_recommendation: 'No transfer needed' },
  'p-005': { expected_recovery_level: 'Long-term Care', partial_recovery_probability: 42, transfer_recommendation: 'Transfer to University Medical Center recommended for surgical intervention' },
  'p-006': { expected_recovery_level: 'Full Recovery', partial_recovery_probability: 99, transfer_recommendation: 'No transfer needed' },
  'p-007': { expected_recovery_level: 'Partial Recovery', partial_recovery_probability: 72, transfer_recommendation: 'Transfer to Regional Trauma Center recommended' },
  'p-008': { expected_recovery_level: 'Full Recovery', partial_recovery_probability: 99, transfer_recommendation: 'No transfer needed' },
  'p-009': { expected_recovery_level: 'Partial Recovery', partial_recovery_probability: 76, transfer_recommendation: 'No transfer needed — monitor for 48 hours' },
  'p-010': { expected_recovery_level: 'Full Recovery', partial_recovery_probability: 91, transfer_recommendation: 'No transfer needed' },
  'p-011': { expected_recovery_level: 'Long-term Care', partial_recovery_probability: 55, transfer_recommendation: 'Transfer to University Medical Center recommended for thoracic surgery' },
  'p-012': { expected_recovery_level: 'Full Recovery', partial_recovery_probability: 98, transfer_recommendation: 'No transfer needed' },
};

// ── In-memory state for session mutations ───────────────────────────────────

let patients = [...MOCK_PATIENTS];
let transfers = [...MOCK_TRANSFERS];
let auditLogs = [...MOCK_AUDIT_LOGS];

// ── Exported mock API functions ─────────────────────────────────────────────

export async function mockLogin(credentials: LoginCredentials): Promise<AuthResponse> {
  await delay(400);

  const entry = DEMO_USERS[credentials.email];
  if (!entry || entry.password !== credentials.password) {
    throw new Error('Invalid email or password');
  }

  return {
    token: `mock-jwt-${randomId()}`,
    user: entry.user,
  };
}

export async function mockSubmitPatientIntake(
  form: PatientIntakeForm,
  createdBy: string,
  hospitalId: string,
): Promise<Patient> {
  await delay(600);

  const severity = severities[Math.floor(Math.random() * severities.length)];
  const priorityIndex = severities.indexOf(severity);
  const priority = priorities[priorityIndex];

  const newPatient: Patient = {
    id: `p-${randomId()}`,
    ...form,
    admission_date: new Date().toISOString().split('T')[0],
    severity,
    priority,
    predicted_los_days: severity === 'Critical' ? 10 + Math.floor(Math.random() * 10) : severity === 'Moderate' ? 3 + Math.floor(Math.random() * 5) : 1 + Math.floor(Math.random() * 2),
    created_by: createdBy,
    hospital_id: hospitalId,
  };

  patients = [newPatient, ...patients];

  auditLogs = [
    {
      id: `log-${randomId()}`,
      user: createdBy,
      role: 'nurse',
      action: `Created patient record for ${form.name}`,
      timestamp: new Date().toISOString(),
    },
    ...auditLogs,
  ];

  return newPatient;
}

export async function mockGetMyPatients(nurseId: string): Promise<Patient[]> {
  await delay();
  return patients.filter((p) => p.created_by === nurseId);
}

export async function mockGetHospitalPatients(hospitalId: string): Promise<Patient[]> {
  await delay();
  return patients.filter((p) => p.hospital_id === hospitalId);
}

export async function mockGetPatientById(patientId: string): Promise<Patient | undefined> {
  await delay(200);
  return patients.find((p) => p.id === patientId);
}

export async function mockGetPatientPrognosis(patientId: string): Promise<Prognosis> {
  await delay(800);

  if (PROGNOSIS_MAP[patientId]) {
    return PROGNOSIS_MAP[patientId];
  }

  return {
    expected_recovery_level: 'Partial Recovery',
    partial_recovery_probability: 60 + Math.floor(Math.random() * 30),
    transfer_recommendation: 'Assessment pending — monitor patient condition',
  };
}

export async function mockGetHospitalStatus(): Promise<HospitalStatus> {
  await delay(300);
  return { ...MOCK_HOSPITAL_STATUS };
}

export async function mockGetAdmittedPatients(hospitalId: string): Promise<Patient[]> {
  await delay();
  return patients.filter((p) => p.hospital_id === hospitalId);
}

export async function mockCreateUser(data: CreateUserPayload): Promise<User> {
  await delay(500);

  const newUser: User = {
    id: `u-${randomId()}`,
    name: data.name,
    email: data.email,
    role: data.role,
    hospital_id: data.hospital_id,
    hospital_name: 'City General Hospital',
  };

  auditLogs = [
    {
      id: `log-${randomId()}`,
      user: 'Priya Sharma',
      role: 'admin',
      action: `Created new user account for ${data.name} (${data.role})`,
      timestamp: new Date().toISOString(),
    },
    ...auditLogs,
  ];

  return newUser;
}

export async function mockGetTransferRequests(): Promise<TransferRequest[]> {
  await delay();
  return [...transfers];
}

export async function mockUpdateTransferStatus(
  id: string,
  status: TransferStatus,
): Promise<TransferRequest> {
  await delay(400);

  const index = transfers.findIndex((t) => t.id === id);
  if (index === -1) throw new Error('Transfer request not found');

  transfers = transfers.map((t) => (t.id === id ? { ...t, status } : t));

  auditLogs = [
    {
      id: `log-${randomId()}`,
      user: 'Priya Sharma',
      role: 'admin',
      action: `${status === 'approved' ? 'Approved' : 'Rejected'} transfer request for ${transfers[index].patient_name}`,
      timestamp: new Date().toISOString(),
    },
    ...auditLogs,
  ];

  return transfers[index];
}

export async function mockGetAuditLogs(): Promise<AuditLog[]> {
  await delay();
  return [...auditLogs];
}

export async function mockGetAccidentTrends(): Promise<AccidentTrend[]> {
  await delay(500);
  return [...MOCK_TRENDS];
}

export async function mockGetRiskPredictions(): Promise<RiskPrediction[]> {
  await delay(500);
  return [...MOCK_RISK_PREDICTIONS];
}
