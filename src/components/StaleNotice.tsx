import type { ReactNode } from 'react';

/**
 * The one way an out-of-date prediction is shown, in every role's view. The
 * backend decides staleness; the previous output stays visible but is never
 * presented as current.
 */
export function StaleNotice({ previous, reason, compact = false }: { previous?: ReactNode; reason?: string | null; compact?: boolean }) {
  if (compact) {
    return (
      <span className="text-xs" style={{ color: 'var(--tone-warning)' }} data-testid="stale-notice" title={reason ?? undefined}>
        Out of date — new prediction required
      </span>
    );
  }
  return (
    <div role="note" data-testid="stale-notice" className="rounded-lg px-3 py-2 text-sm"
      style={{ color: 'var(--tone-warning)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
      <p className="font-medium">Out of date — new prediction required</p>
      {(previous || reason) && (
        <p className="mt-1 text-xs">
          {previous ? <>Previous prediction: {previous}. </> : null}
          {reason ?? ''}
        </p>
      )}
    </div>
  );
}
