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
