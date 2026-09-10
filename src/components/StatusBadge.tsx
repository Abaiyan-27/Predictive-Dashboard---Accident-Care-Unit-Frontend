import type { TransferStatus } from '../types';

const STATUS_STYLES: Record<TransferStatus, { bg: string; color: string; border: string; glow: string }> = {
  pending_authorization: {
    bg: 'rgba(245, 158, 11, 0.15)',
    color: '#fcd34d',
    border: 'rgba(245, 158, 11, 0.3)',
    glow: '0 0 12px rgba(245, 158, 11, 0.15)',
  },
  authorized: {
    bg: 'rgba(59, 130, 246, 0.15)',
    color: '#93c5fd',
    border: 'rgba(59, 130, 246, 0.3)',
    glow: '0 0 12px rgba(59, 130, 246, 0.15)',
  },
  approved: {
    bg: 'rgba(16, 185, 129, 0.15)',
    color: '#6ee7b7',
    border: 'rgba(16, 185, 129, 0.3)',
    glow: '0 0 12px rgba(16, 185, 129, 0.15)',
  },
  rejected: {
    bg: 'rgba(239, 68, 68, 0.15)',
    color: '#fca5a5',
    border: 'rgba(239, 68, 68, 0.3)',
    glow: '0 0 12px rgba(239, 68, 68, 0.2)',
  },
};

const STATUS_LABELS: Record<TransferStatus, string> = {
  pending_authorization: 'Pending authorization',
  authorized: 'Authorized',
  approved: 'Approved',
  rejected: 'Rejected',
};

interface StatusBadgeProps {
  status: TransferStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];

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
      {STATUS_LABELS[status]}
    </span>
  );
}
