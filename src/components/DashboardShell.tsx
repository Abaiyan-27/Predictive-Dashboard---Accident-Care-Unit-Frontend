import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';

const ROLE_LABELS: Record<string, string> = {
  nurse: 'Nurse',
  doctor: 'Doctor',
  admin: 'Administrator',
  government: 'Government',
};

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header className="glass-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Wordmark */}
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold tracking-tight gradient-text">
                Accident Care
              </h1>
              {user && (
                <span
                  className="hidden sm:inline-block px-3 py-1 text-xs font-semibold rounded-full"
                  style={{
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: 'var(--text-accent)',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                  }}
                >
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              )}
            </div>

            {/* Right side */}
            {user && (
              <div className="flex items-center gap-4">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {user.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {user.role === 'admin' && !user.hospital_id ? 'All hospitals' : user.hospital_name}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200"
                  style={{
                    color: 'var(--text-secondary)',
                    background: 'rgba(148, 163, 184, 0.08)',
                    border: '1px solid var(--border-subtle)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(148, 163, 184, 0.15)';
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.25)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(148, 163, 184, 0.08)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
