import type { Severity, Priority } from '../types';

type BadgeValue = Severity | Priority;

const BADGE_STYLES: Record<BadgeValue, { bg: string; color: string; border: string; glow: string }> = {
  High: {
    bg: 'rgba(239, 68, 68, 0.15)',
    color: '#fca5a5',
    border: 'rgba(239, 68, 68, 0.3)',
    glow: '0 0 12px rgba(239, 68, 68, 0.2)',
  },
  Moderate: {
    bg: 'rgba(245, 158, 11, 0.15)',
    color: '#fcd34d',
    border: 'rgba(245, 158, 11, 0.3)',
    glow: '0 0 12px rgba(245, 158, 11, 0.15)',
  },
  Medium: {
    bg: 'rgba(245, 158, 11, 0.15)',
    color: '#fcd34d',
    border: 'rgba(245, 158, 11, 0.3)',
    glow: '0 0 12px rgba(245, 158, 11, 0.15)',
  },
  Low: {
    bg: 'rgba(16, 185, 129, 0.15)',
    color: '#6ee7b7',
    border: 'rgba(16, 185, 129, 0.3)',
    glow: '0 0 12px rgba(16, 185, 129, 0.15)',
  },
  'Severity not classified': {
    bg: 'rgba(100, 116, 139, 0.15)',
    color: '#94a3b8',
    border: 'rgba(100, 116, 139, 0.3)',
    glow: 'none',
  },
};

const DEFAULT_STYLE = {
  bg: 'rgba(100, 116, 139, 0.15)',
  color: '#94a3b8',
  border: 'rgba(100, 116, 139, 0.3)',
  glow: 'none',
};

interface SeverityBadgeProps {
  value: BadgeValue | null;
}

export function SeverityBadge({ value }: SeverityBadgeProps) {
  const style = value ? (BADGE_STYLES[value] ?? DEFAULT_STYLE) : DEFAULT_STYLE;

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
      {value ?? 'Severity not classified'}
    </span>
  );
}
