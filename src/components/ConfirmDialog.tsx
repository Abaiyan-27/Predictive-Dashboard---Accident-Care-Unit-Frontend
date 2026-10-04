import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  /** Dialog heading; the question being confirmed. */
  title?: string;
  /** What will be saved, shown under the question. */
  children?: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * "Are you sure?" gate shown before every saving action in every role. Nothing
 * is sent until Confirm; Cancel and Escape send nothing. Focus stays inside.
 */
export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  children,
  confirmLabel = 'Yes, save',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
      // Keep keyboard focus on the dialog's two buttons.
      if (event.key === 'Tab') {
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        else if (document.activeElement !== first && document.activeElement !== last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 overflow-y-auto py-6"
      style={{ background: 'rgba(2, 6, 23, 0.6)' }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={children ? 'confirm-dialog-body' : undefined}
        className="glass-card w-full max-w-md p-6"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
        {children && (
          <div id="confirm-dialog-body" className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {children}
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm rounded-lg border"
            style={{ borderColor: 'var(--border-input)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={busy} className="px-4 py-2 text-sm gradient-btn">
            {busy ? 'Saving...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
