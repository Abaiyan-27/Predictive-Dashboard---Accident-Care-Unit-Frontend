export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div
        className="h-10 w-10 rounded-full animate-pulse-glow"
        style={{
          border: '3px solid rgba(100, 116, 139, 0.2)',
          borderTopColor: '#8b5cf6',
          borderRightColor: '#6366f1',
          animation: 'spin 0.8s linear infinite, pulseGlow 2s ease-in-out infinite',
        }}
      />
    </div>
  );
}
