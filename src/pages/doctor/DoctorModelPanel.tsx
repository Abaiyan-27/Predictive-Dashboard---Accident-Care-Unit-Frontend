import { useState } from 'react';
import { Card } from '../../components/Card';
import type { DoctorModelStatus, XAIExplanation } from '../../types';
import { ExplanationPanel } from '../../components/ExplanationPanel';
import { StaleNotice } from '../../components/StaleNotice';

const STATE_TEXT: Record<DoctorModelStatus['state'], string> = {
  WAITING_FOR_INPUTS: 'Waiting for required inputs',
  NOT_RUN: 'Ready to run',
  PREDICTION_AVAILABLE: 'Prediction available — awaiting your decision',
  PREDICTION_FAILED: 'Prediction failed',
  ACCEPTED: 'Doctor accepted the model prediction',
  OVERRIDDEN: 'Doctor overrode the model prediction',
};

const secondaryButton = 'py-2 px-5 text-sm rounded-lg border';
const secondaryStyle = { borderColor: 'var(--border-input)', color: 'var(--text-secondary)' };

function Value({ children, testId }: { children: string; testId?: string }) {
  return (
    <span data-testid={testId} className="inline-block px-3 py-1 text-sm font-semibold rounded-full"
      style={{ background: 'rgba(139, 92, 246, 0.12)', color: 'var(--text-accent)', border: '1px solid var(--border-accent)' }}>
      {children}
    </span>
  );
}

interface DoctorModelPanelProps {
  status: DoctorModelStatus;
  busy: boolean;
  onAccept: (status: DoctorModelStatus) => void;
  onOverride: (status: DoctorModelStatus, decision: string, reason: string) => void;
  onRun: () => void;
  onExplain: (status: DoctorModelStatus) => void;
  explanation?: XAIExplanation | null;
  explaining: boolean;
}

/** One doctor model: its stored prediction and its own, independent decision. */
export function DoctorModelPanel({
  status, busy, onAccept, onOverride, onRun, onExplain, explanation, explaining,
}: DoctorModelPanelProps) {
  const [overriding, setOverriding] = useState(false);
  const [choice, setChoice] = useState('');
  const [reason, setReason] = useState('');
  const { prediction, decision, readiness, state } = status;
  const usable = prediction && !prediction.stale && !decision;
  // An override must differ from the model; after a failure every label is open.
  const choices = status.labels.filter((label) => label !== prediction?.prediction);

  return (
    <Card>
      <section data-testid={`model-${status.model_key}`} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{status.title}</h2>
          <span className="text-xs text-[color:var(--text-muted)]">{STATE_TEXT[state]}</span>
        </div>

        {state === 'WAITING_FOR_INPUTS' && (
          <p className="text-sm text-[color:var(--text-muted)]">
            {readiness.missing_required.length > 0
              ? `Waiting for a nurse to record treatment. Missing: ${readiness.missing_required.join(', ')}.`
              : `Not enough patient details yet (${Math.round((readiness.completeness ?? 0) * 100)}% of `
                + `${Math.round((readiness.minimum_completeness ?? 0) * 100)}% needed). Missing: `
                + `${readiness.missing_features.join(', ')}.`}
          </p>
        )}

        {prediction?.stale && !decision && (
          <StaleNotice previous={prediction.prediction ?? 'none'} reason={prediction.stale_reason} />
        )}

        {state === 'NOT_RUN' && status.can_run && (
          <button type="button" onClick={onRun} disabled={busy} className="py-2 px-5 text-sm gradient-btn">
            Run model
          </button>
        )}

        {usable && (
          <div className="space-y-3">
            {state === 'PREDICTION_FAILED' ? (
              <p className="text-sm" style={{ color: 'var(--tone-danger)' }}>
                The model could not produce a prediction ({prediction.status}): {prediction.message ?? 'no details'}.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-[color:var(--text-muted)]">Model prediction:</span>
                  <Value testId={`prediction-${status.model_key}`}>{prediction.prediction ?? ''}</Value>
                  {prediction.probability !== null && (
                    <span className="text-xs text-[color:var(--text-muted)]">
                      {Math.round(prediction.probability * 100)}% probability
                      {prediction.status === 'LOW_CONFIDENCE' ? ' · low confidence' : ''}
                    </span>
                  )}
                </div>
                {prediction.message && <p className="text-xs text-[color:var(--text-muted)]">{prediction.message}</p>}
              </>
            )}

            {!overriding && status.can_accept && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-[color:var(--text-primary)]">Do you want to accept this decision?</p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => onAccept(status)} disabled={busy} className="py-2 px-5 text-sm gradient-btn">
                    Accept
                  </button>
                  <button type="button" onClick={() => setOverriding(true)} disabled={busy} className={secondaryButton} style={secondaryStyle}>
                    Reject / Make my own decision
                  </button>
                </div>
              </div>
            )}
            {!overriding && !status.can_accept && status.can_override && (
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setOverriding(true)} disabled={busy} className="py-2 px-5 text-sm gradient-btn">
                  Make my own decision
                </button>
                {status.can_run && (
                  <button type="button" onClick={onRun} disabled={busy} className={secondaryButton} style={secondaryStyle}>
                    Run model again
                  </button>
                )}
              </div>
            )}

            {overriding && status.can_override && (
              <fieldset className="space-y-3 rounded-lg p-4" style={{ border: '1px solid var(--border-subtle)' }}>
                <legend className="px-1 text-sm font-medium text-[color:var(--text-primary)]">Your {status.title} decision</legend>
                <div className="flex flex-wrap gap-4">
                  {choices.map((label) => (
                    <label key={label} className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                      <input type="radio" name={`override-${status.model_key}`} value={label}
                        checked={choice === label} onChange={() => setChoice(label)} />
                      {label}
                    </label>
                  ))}
                </div>
                <div>
                  <label htmlFor={`reason-${status.model_key}`} className="block text-xs mb-1 text-[color:var(--text-muted)]">Reason (optional)</label>
                  <input id={`reason-${status.model_key}`} type="text" maxLength={1000} value={reason}
                    onChange={(event) => setReason(event.target.value)} className="w-full px-4 py-2 text-sm dark-input" />
                </div>
                <div className="flex gap-3">
                  <button type="button" disabled={busy || !choice}
                    onClick={() => onOverride(status, choice, reason.trim())} className="py-2 px-5 text-sm gradient-btn">
                    Save my decision
                  </button>
                  <button type="button" disabled={busy} className={secondaryButton} style={secondaryStyle}
                    onClick={() => { setOverriding(false); setChoice(''); setReason(''); }}>
                    Back
                  </button>
                </div>
              </fieldset>
            )}
          </div>
        )}

        {decision && prediction && (
          <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2 text-sm" data-testid={`decided-${status.model_key}`}>
            <dt className="text-[color:var(--text-muted)]">Model prediction:</dt>
            <dd className="text-[color:var(--text-secondary)]">{decision.model_prediction ?? 'none (model failed)'}</dd>
            <dt className="text-[color:var(--text-muted)]">Doctor decision:</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <Value testId={`final-${status.model_key}`}>{decision.final_decision}</Value>
              <span className="text-xs text-[color:var(--text-muted)]">
                Source: {decision.decision_source === 'MODEL' ? 'model prediction accepted' : 'doctor override'}
                {decision.decided_at ? ` · ${new Date(decision.decided_at).toLocaleString()}` : ''}
              </span>
            </dd>
            {decision.reason && (
              <>
                <dt className="text-[color:var(--text-muted)]">Reason:</dt>
                <dd className="text-xs text-[color:var(--text-secondary)]">{decision.reason}</dd>
              </>
            )}
          </dl>
        )}

        {prediction && prediction.prediction && !prediction.stale && (
          explanation ? <ExplanationPanel data={explanation} /> : (
            <button type="button" onClick={() => onExplain(status)} disabled={explaining}
              className="text-xs underline text-[color:var(--text-accent)]">
              {explaining ? 'Generating explanation…' : 'Explain this prediction (SHAP)'}
            </button>
          )
        )}
      </section>
    </Card>
  );
}
