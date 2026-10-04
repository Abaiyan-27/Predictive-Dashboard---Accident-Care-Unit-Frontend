/**
 * The only severity outputs the triage model can return.
 *
 * Mirrors app/contracts/severity_labels.json in the backend; the backend test
 * tests/unit/test_severity_contract.py fails if the two lists drift apart.
 * Import from here instead of writing severity strings anywhere else.
 */
export const SEVERITY_LABELS = [
  'HIGH',
  'BORDERLINE',
  'LOW',
  'DEFER TO CLINICAL JUDGEMENT',
] as const;

export type Severity = (typeof SEVERITY_LABELS)[number];

export const SEVERITY_DEFER = 'DEFER TO CLINICAL JUDGEMENT' satisfies Severity;

export function isSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && (SEVERITY_LABELS as readonly string[]).includes(value);
}

/** Anything outside the contract (missing response, unknown string) defers to the clinician. */
export function toSeverity(value: unknown): Severity {
  return isSeverity(value) ? value : SEVERITY_DEFER;
}

/**
 * The Severity labels a nurse may choose as a final decision. DEFER is the
 * model's "cannot score" answer, never a human decision (the backend and the
 * database refuse it), so it is excluded here.
 */
export const HUMAN_SEVERITY_DECISIONS = SEVERITY_LABELS.filter(
  (label): label is Exclude<Severity, typeof SEVERITY_DEFER> => label !== SEVERITY_DEFER,
);

export type HumanSeverityDecision = (typeof HUMAN_SEVERITY_DECISIONS)[number];

/** Severity workflow states reported by GET /severity/accidents/{id}. */
export const SEVERITY_STATES = {
  NOT_RUN: 'Not yet run',
  WAITING_FOR_INPUTS: 'Waiting for inputs',
  PREDICTION_AVAILABLE: 'Prediction available — awaiting nurse decision',
  MODEL_DEFERRED: 'Model deferred — clinical decision required',
  PREDICTION_FAILED: 'Prediction failed — clinical decision required',
  ACCEPTED: 'Nurse accepted the model prediction',
  OVERRIDDEN: 'Nurse overrode the model prediction',
} as const;

export type SeverityState = keyof typeof SEVERITY_STATES;
