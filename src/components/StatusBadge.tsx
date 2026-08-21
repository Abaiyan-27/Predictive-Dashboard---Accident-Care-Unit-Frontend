import type { TransferStatus } from '../types';

const STATUS_STYLES: Record<TransferStatus, string> = {
  pending_authorization: 'bg-amber-50 text-amber-700 border-amber-200',
  authorized: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
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
  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded border ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
