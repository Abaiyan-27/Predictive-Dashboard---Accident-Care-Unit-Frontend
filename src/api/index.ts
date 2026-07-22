/**
 * API module — the single import point for all components.
 *
 * Currently delegates to mock implementations. To switch to a real backend,
 * replace the mock imports with calls to `apiClient` from ./client.ts.
 * Component code does not change.
 */

import type {
  AccidentTrend,
  AuditLog,
  AuthResponse,
  CreateUserPayload,
  HospitalStatus,
  LoginCredentials,
  Patient,
  PatientIntakeForm,
  Prognosis,
  RiskPrediction,
  TransferRequest,
  TransferStatus,
  User,
} from '../types';

import {
  mockLogin,
  mockSubmitPatientIntake,
  mockGetMyPatients,
  mockGetHospitalPatients,
  mockGetPatientById,
  mockGetPatientPrognosis,
  mockGetHospitalStatus,
  mockGetAdmittedPatients,
  mockCreateUser,
  mockGetTransferRequests,
  mockUpdateTransferStatus,
  mockGetAuditLogs,
  mockGetAccidentTrends,
  mockGetRiskPredictions,
} from './mock';

// ── Auth ────────────────────────────────────────────────────────────────────

export function login(credentials: LoginCredentials): Promise<AuthResponse> {
  return mockLogin(credentials);
}

// ── Nurse ───────────────────────────────────────────────────────────────────

export function submitPatientIntake(
  form: PatientIntakeForm,
  createdBy: string,
  hospitalId: string,
): Promise<Patient> {
  return mockSubmitPatientIntake(form, createdBy, hospitalId);
}

export function getMyPatients(nurseId: string): Promise<Patient[]> {
  return mockGetMyPatients(nurseId);
}

// ── Doctor ──────────────────────────────────────────────────────────────────

export function getHospitalPatients(hospitalId: string): Promise<Patient[]> {
  return mockGetHospitalPatients(hospitalId);
}

export function getPatientById(patientId: string): Promise<Patient | undefined> {
  return mockGetPatientById(patientId);
}

export function getPatientPrognosis(patientId: string): Promise<Prognosis> {
  return mockGetPatientPrognosis(patientId);
}

// ── Admin ───────────────────────────────────────────────────────────────────

export function getHospitalStatus(): Promise<HospitalStatus> {
  return mockGetHospitalStatus();
}

export function getAdmittedPatients(hospitalId: string): Promise<Patient[]> {
  return mockGetAdmittedPatients(hospitalId);
}

export function createUser(data: CreateUserPayload): Promise<User> {
  return mockCreateUser(data);
}

export function getTransferRequests(): Promise<TransferRequest[]> {
  return mockGetTransferRequests();
}

export function updateTransferStatus(
  id: string,
  status: TransferStatus,
): Promise<TransferRequest> {
  return mockUpdateTransferStatus(id, status);
}

export function getAuditLogs(): Promise<AuditLog[]> {
  return mockGetAuditLogs();
}

// ── Government ──────────────────────────────────────────────────────────────

export function getAccidentTrends(): Promise<AccidentTrend[]> {
  return mockGetAccidentTrends();
}

export function getRiskPredictions(): Promise<RiskPrediction[]> {
  return mockGetRiskPredictions();
}
