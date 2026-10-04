import type { TransferRequest } from '../types';
import { StatusBadge } from './StatusBadge';

function when(value: string | null) {
  return value ? new Date(value).toLocaleString() : '';
}

/** One transfer request: route, message, and who did each step (and when). */
export function TransferSummary({ transfer }: { transfer: TransferRequest }) {
  const notTransferred = transfer.status === 'rejected' && Boolean(transfer.processed_by);
  return (
    <div data-testid={`transfer-${transfer.transfer_id}`} className="space-y-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={transfer.status} notTransferred={notTransferred} />
        <span className="text-[color:var(--text-primary)] font-medium">
          {transfer.patient_name ?? 'Patient'}: {transfer.source_hospital} → <span data-testid="destination">{transfer.destination_hospital}</span>
        </span>
      </div>
      {transfer.request_message && (
        <p className="text-[color:var(--text-secondary)]"><span className="text-xs text-[color:var(--text-muted)]">Administrator message: </span>“{transfer.request_message}”</p>
      )}
      <ul className="text-xs text-[color:var(--text-muted)] space-y-0.5">
        <li>Requested by {transfer.requested_by_name ?? 'unknown'} · {when(transfer.requested_at)}</li>
        {transfer.authorized_at && (
          <li>
            Authorized by {transfer.authorized_by_name ?? 'unknown'} · {when(transfer.authorized_at)}
            {transfer.authorization_reason ? ` · ${transfer.authorization_reason}` : ''}
          </li>
        )}
        {transfer.rejected_by_name && (
          <li>Rejected by {transfer.rejected_by_name} · {when(transfer.decided_at)} · {transfer.rejection_reason}</li>
        )}
        {transfer.processed_at && (
          <li>
            {notTransferred ? 'Recorded as not transferred' : 'Transfer processed'} by {transfer.processed_by_name ?? 'unknown'}
            {' · '}{when(transfer.processed_at)}
            {transfer.status === 'approved' && transfer.state_of_transfer ? ` · ${transfer.state_of_transfer}` : ''}
            {transfer.processing_note ? ` · ${transfer.processing_note}` : ''}
          </li>
        )}
      </ul>
    </div>
  );
}
