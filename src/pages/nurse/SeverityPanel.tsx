import { SeverityBadge } from '../../components/SeverityBadge';
import { StaleNotice } from '../../components/StaleNotice';
import { HUMAN_SEVERITY_DECISIONS, SEVERITY_STATES } from '../../contracts/severity';
import type { HumanSeverityDecision } from '../../contracts/severity';
import type { SeverityWorkflow } from '../../types';

/** Intake field names (as the backend reports them) shown as form labels. */
const FIELD_LABELS: Record<string, string> = {
  full_name: 'Patient name',
  age: 'Age',
  gender: 'Gender',
  incident_at: 'Time of collision',
  mode_of_travel_during_accident: 'Mode of travel',
  collision_with: 'Collision with',
  vehicle_type: 'Vehicle type',
  helmet_worn: 'Helmet worn',
  passenger_type: 'Passenger type',
  mode_of_transport: 'Transport to hospital',
  time_to_hospital: 'Time to hospital',
  site_of_injury: 'Primary injury site',
  secondary_site_of_injury: 'Secondary injury site',
  other_injury: 'Other injury',
};

const TONES = {
  info: { color: 'var(--text-secondary)', border: 'var(--border-subtle)' },
  waiting: { color: 'var(--tone-warning)', border: 'rgba(245, 158, 11, 0.3)' },
  ready: { color: 'var(--tone-accent)', border: 'rgba(139, 92, 246, 0.35)' },
  defer: { color: 'var(--text-secondary)', border: 'rgba(100, 116, 139, 0.4)' },
  failed: { color: 'var(--tone-danger)', border: 'rgba(239, 68, 68, 0.3)' },
  done: { color: 'var(--tone-success)', border: 'rgba(16, 185, 129, 0.3)' },
} as const;

const STATE_TONE: Record<SeverityWorkflow['state'], keyof typeof TONES> = {
  NOT_RUN: 'info',
  WAITING_FOR_INPUTS: 'waiting',
  PREDICTION_AVAILABLE: 'ready',
  MODEL_DEFERRED: 'defer',
  PREDICTION_FAILED: 'failed',
  ACCEPTED: 'done',
  OVERRIDDEN: 'done',
};

interface SeverityPanelProps {
  patientName: string;
  workflow: SeverityWorkflow;
  busy: boolean;
  overrideOpen: boolean;
  overrideChoice: HumanSeverityDecision | '';
  overrideReason: string;
  onRun: () => void;
  onAccept: () => void;
  onReject: () => void;
  onCancelOverride: () => void;
  onOverrideChoice: (value: HumanSeverityDecision) => void;
  onOverrideReason: (value: string) => void;
  onSaveOverride: () => void;
}

export function SeverityPanel({
  patientName,
  workflow,
  busy,
  overrideOpen,
  overrideChoice,
  overrideReason,
  onRun,
  onAccept,
  onReject,
  onCancelOverride,
  onOverrideChoice,
  onOverrideReason,
  onSaveOverride,
}: SeverityPanelProps) {
  const { state, inputs, prediction, decision } = workflow;
  const tone = TONES[STATE_TONE[state]];
  const isDeferred = state === 'MODEL_DEFERRED' || state === 'PREDICTION_FAILED';
  // An override must differ from the model; after a DEFER every actionable label is open.
  const choices = HUMAN_SEVERITY_DECISIONS.filter((label) => label !== prediction?.prediction);
  const missing = inputs.missing.map((field) => FIELD_LABELS[field] ?? field);

  return (
    <div className="glass-card p-6" style={{ border: `1px solid ${tone.border}` }} data-testid="severity-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold" style={{ color: tone.color }}>
          Severity — {SEVERITY_STATES[state]}
        </h3>
        <span className="text-xs text-[color:var(--text-muted)]">
          {patientName} · Severity inputs {inputs.recorded}/{inputs.total}
        </span>
      </div>

      {state === 'NOT_RUN' && (
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          Enough Severity inputs are recorded. Use “Save &amp; run Severity” when the inputs are final.
        </p>
      )}

      {state === 'WAITING_FOR_INPUTS' && (
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          The Severity model needs at least {inputs.minimum ?? '—'} of {inputs.total} inputs.
          Missing: {missing.join(', ') || '—'}.
        </p>
      )}

      {prediction?.stale && !decision && (
        <div className="mt-3 space-y-2">
          <StaleNotice previous={<SeverityBadge value={prediction.prediction} />} reason={prediction.stale_reason} />
          {workflow.can_run && (
            <p className="text-xs text-[color:var(--text-muted)]">Use “Save &amp; Run Severity” to produce a new prediction.</p>
          )}
        </div>
      )}

      {prediction && !prediction.stale && !decision && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-[color:var(--text-muted)]">Model prediction:</span>
            <SeverityBadge value={prediction.prediction} />
            {prediction.probability !== null && (
              <span className="text-xs text-[color:var(--text-muted)]">
                {(prediction.probability * 100).toFixed(0)}% estimated chance of needing escalated care
              </span>
            )}
          </div>
          {state === 'MODEL_DEFERRED' && (
            <p className="text-sm text-[color:var(--text-muted)]">
              The model did not classify this patient (DEFER TO CLINICAL JUDGEMENT). Record your clinical Severity decision.
            </p>
          )}
          {state === 'PREDICTION_FAILED' && (
            <p className="text-sm" style={{ color: TONES.failed.color }}>
              The model could not produce a prediction ({prediction.status}): {prediction.message ?? 'no details'}.
              Record your clinical Severity decision, or run Severity again.
            </p>
          )}

          {!overrideOpen && state === 'PREDICTION_AVAILABLE' && workflow.can_accept && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[color:var(--text-primary)]">
                Do you want to accept this decision?
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={onAccept} disabled={busy} className="py-2 px-5 text-sm gradient-btn">
                  Accept
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  disabled={busy}
                  className="py-2 px-5 text-sm rounded-lg border"
                  style={{ borderColor: 'var(--border-input)', color: 'var(--text-secondary)' }}
                >
                  Reject / Make my own decision
                </button>
              </div>
            </div>
          )}

          {!overrideOpen && isDeferred && workflow.can_override && (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={onReject} disabled={busy} className="py-2 px-5 text-sm gradient-btn">
                Make my clinical decision
              </button>
              {state === 'PREDICTION_FAILED' && workflow.can_run && (
                <button
                  type="button"
                  onClick={onRun}
                  disabled={busy}
                  className="py-2 px-5 text-sm rounded-lg border"
                  style={{ borderColor: 'var(--border-input)', color: 'var(--text-secondary)' }}
                >
                  Run Severity again
                </button>
              )}
            </div>
          )}

          {overrideOpen && workflow.can_override && (
            <fieldset className="space-y-3 rounded-lg p-4" style={{ border: '1px solid var(--border-subtle)' }}>
              <legend className="px-1 text-sm font-medium text-[color:var(--text-primary)]">
                Your final Severity decision
              </legend>
              <div className="flex flex-wrap gap-4">
                {choices.map((label) => (
                  <label key={label} className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                    <input
                      type="radio"
                      name="override_decision"
                      value={label}
                      checked={overrideChoice === label}
                      onChange={() => onOverrideChoice(label)}
                    />
                    <SeverityBadge value={label} />
                  </label>
                ))}
              </div>
              <div>
                <label htmlFor="override_reason" className="block text-xs mb-1 text-[color:var(--text-muted)]">
                  Reason (optional)
                </label>
                <input
                  id="override_reason"
                  type="text"
                  maxLength={1000}
                  value={overrideReason}
                  onChange={(event) => onOverrideReason(event.target.value)}
                  className="w-full px-4 py-2 text-sm dark-input"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onSaveOverride}
                  disabled={busy || !overrideChoice}
                  className="py-2 px-5 text-sm gradient-btn"
                >
                  Save my decision
                </button>
                <button
                  type="button"
                  onClick={onCancelOverride}
                  disabled={busy}
                  className="py-2 px-5 text-sm rounded-lg border"
                  style={{ borderColor: 'var(--border-input)', color: 'var(--text-secondary)' }}
                >
                  Back
                </button>
              </div>
            </fieldset>
          )}
        </div>
      )}

      {decision && prediction && (
        <dl className="mt-3 grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2 text-sm" data-testid="severity-decision">
          <dt className="text-[color:var(--text-muted)]">Model prediction:</dt>
          <dd><SeverityBadge value={decision.model_prediction} /></dd>
          <dt className="text-[color:var(--text-muted)]">Final nurse decision:</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <SeverityBadge value={decision.final_decision} />
            <span className="text-xs text-[color:var(--text-muted)]">
              Source: {decision.decision_source === 'MODEL' ? 'model prediction accepted' : 'nurse override'}
              {decision.decided_at ? ` · ${new Date(decision.decided_at).toLocaleString()}` : ''}
            </span>
          </dd>
          {decision.reason && (
            <>
              <dt className="text-[color:var(--text-muted)]">Reason:</dt>
              <dd className="text-[color:var(--text-secondary)]">{decision.reason}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
