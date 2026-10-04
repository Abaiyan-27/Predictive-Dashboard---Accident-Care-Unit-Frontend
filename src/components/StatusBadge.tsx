import type { TransferStatus } from '../types';

const STATUS_STYLES: Record<TransferStatus, { bg: string; color: string; border: string; glow: string }> = {
  pending_authorization: {
    bg: 'rgba(245, 158, 11, 0.15)',
    color: 'var(--tone-warning)',
    border: 'rgba(245, 158, 11, 0.3)',
    glow: '0 0 12px rgba(245, 158, 11, 0.15)',
  },
  authorized: {
    bg: 'rgba(59, 130, 246, 0.15)',
    color: 'var(--tone-info)',
    border: 'rgba(59, 130, 246, 0.3)',
    glow: '0 0 12px rgba(59, 130, 246, 0.15)',
  },
  approved: {
    bg: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--tone-success)',
    border: 'rgba(16, 185, 129, 0.3)',
    glow: '0 0 12px rgba(16, 185, 129, 0.15)',
  },
  rejected: {
    bg: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--tone-danger)',
    border: 'rgba(239, 68, 68, 0.3)',
    glow: '0 0 12px rgba(239, 68, 68, 0.2)',
  },
};

// approved = the nurse confirmed the physical transfer; rejected = refused by the
// admin, or (when a nurse processed it) recorded as not transferred.
const STATUS_LABELS: Record<TransferStatus, string> = {
  pending_authorization: 'Requested — awaiting authorization',
  authorized: 'Authorized — awaiting transfer',
  approved: 'Transferred',
  rejected: 'Rejected by administrator',
};

interface StatusBadgeProps {
  status: TransferStatus;
  /** A rejected request that a nurse closed: the patient was not transferred. */
  notTransferred?: boolean;
}

export function StatusBadge({ status, notTransferred = false }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];
  const label = status === 'rejected' && notTransferred ? 'Not transferred' : STATUS_LABELS[status];

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
      {label}
    </span>
  );
}
