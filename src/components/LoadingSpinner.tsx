export function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12" role="progressbar" aria-label="Loading">
      <div
        className="h-10 w-10 rounded-full animate-pulse-glow"
        style={{
          border: '3px solid rgba(100, 116, 139, 0.2)',
          borderTopColor: '#8b5cf6',
          borderRightColor: '#6366f1',
          animation: 'spin 0.8s linear infinite, pulseGlow 2s ease-in-out infinite',
        }}
      />
      <span className="text-xs text-[color:var(--text-muted)]">Loading…</span>
    </div>
  );
}
