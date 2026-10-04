import { LoadingSpinner } from '../../components/LoadingSpinner';
import type { Loaded } from './governmentData';

export function ErrorNotice({ message, unauthorized }: { message: string; unauthorized?: boolean }) {
  return (
    <p role="alert" className="text-sm py-4" style={{ color: 'var(--tone-danger)' }}>
      {unauthorized ? `You are not authorized to view this information. ${message}` : message}
    </p>
  );
}

/** Renders loading, error or the content for one response. */
export function LoadState<T>({ result, children }: { result: Loaded<T>; children: (data: T) => React.ReactNode }) {
  if (result.state === 'loading') return <LoadingSpinner />;
  if (result.state === 'error') return <ErrorNotice message={result.message} unauthorized={result.unauthorized} />;
  return <>{children(result.data)}</>;
}

export function StatTile({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId?: string }) {
  return (
    <div data-testid={testId} className="rounded-lg p-4" style={{ border: '1px solid var(--border-subtle)' }}>
      <p className="text-xs text-[color:var(--text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[color:var(--text-primary)]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[color:var(--text-muted)]">{hint}</p>}
    </div>
  );
}
