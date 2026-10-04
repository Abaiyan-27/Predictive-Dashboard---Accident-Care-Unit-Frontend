import { useEffect, useState } from 'react';
import axios from 'axios';
import { getApiErrorMessage } from '../../api/client';

/* Recharts dark tooltip styles */
export const tooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(148, 163, 184, 0.15)',
  borderRadius: '10px',
  color: '#f1f5f9',
  fontSize: '13px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
};

export const thStyle = {
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border-subtle)',
};

export const axisProps = {
  tick: { fontSize: 12, fill: '#64748b' },
  tickLine: false,
  axisLine: { stroke: 'rgba(148, 163, 184, 0.15)' },
};

/** Forecast volume bands and the dataset's recorded severity_label, not patient-model outputs. */
export const RISK_BADGE_STYLES: Record<string, { bg: string; color: string; border: string; glow: string }> = {
  Low: {
    bg: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--tone-success)',
    border: 'rgba(16, 185, 129, 0.3)',
    glow: '0 0 10px rgba(16, 185, 129, 0.15)',
  },
  Medium: {
    bg: 'rgba(245, 158, 11, 0.15)',
    color: 'var(--tone-warning)',
    border: 'rgba(245, 158, 11, 0.3)',
    glow: '0 0 10px rgba(245, 158, 11, 0.15)',
  },
  High: {
    bg: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--tone-danger)',
    border: 'rgba(239, 68, 68, 0.3)',
    glow: '0 0 10px rgba(239, 68, 68, 0.2)',
  },
};

export type Loaded<T> =
  | { state: 'loading' }
  | { state: 'error'; message: string; unauthorized: boolean }
  | { state: 'ready'; data: T };

/** Loads one Government API response; failures are kept as errors, never shown as zeros. */
export function useGovernmentData<T>(load: () => Promise<T>, fallback: string, deps: unknown[] = []): Loaded<T> {
  const [result, setResult] = useState<Loaded<T>>({ state: 'loading' });
  useEffect(() => {
    let active = true;
    setResult({ state: 'loading' });
    load()
      .then((data) => { if (active) setResult({ state: 'ready', data }); })
      .catch((error: unknown) => {
        if (!active) return;
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        setResult({ state: 'error', message: getApiErrorMessage(error, fallback), unauthorized: status === 401 || status === 403 });
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return result;
}

export function percent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}
