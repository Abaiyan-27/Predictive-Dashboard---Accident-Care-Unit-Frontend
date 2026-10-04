import type { Severity } from '../contracts/severity';

const BADGE_STYLES: Record<Severity, { bg: string; color: string; border: string; glow: string }> = {
  HIGH: {
    bg: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--tone-danger)',
    border: 'rgba(239, 68, 68, 0.3)',
    glow: '0 0 12px rgba(239, 68, 68, 0.2)',
  },
  BORDERLINE: {
    bg: 'rgba(245, 158, 11, 0.15)',
    color: 'var(--tone-warning)',
    border: 'rgba(245, 158, 11, 0.3)',
    glow: '0 0 12px rgba(245, 158, 11, 0.15)',
  },
  LOW: {
    bg: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--tone-success)',
    border: 'rgba(16, 185, 129, 0.3)',
    glow: '0 0 12px rgba(16, 185, 129, 0.15)',
  },
  'DEFER TO CLINICAL JUDGEMENT': {
    bg: 'rgba(100, 116, 139, 0.15)',
    color: 'var(--text-secondary)',
    border: 'rgba(100, 116, 139, 0.3)',
    glow: 'none',
  },
};

interface SeverityBadgeProps {
  value: Severity;
}

export function SeverityBadge({ value }: SeverityBadgeProps) {
  const style = BADGE_STYLES[value];

  return (
    <span
      className="inline-block px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200"
      style={{
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        boxShadow: style.glow,
      }}
    >
      {value}
    </span>
  );
}
