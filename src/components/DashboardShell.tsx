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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Wordmark */}
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
                Accident Care
              </h1>
              {user && (
                <span className="hidden sm:inline-block px-2.5 py-0.5 text-xs font-medium rounded bg-purple-50 text-purple-700 border border-purple-200">
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              )}
            </div>

            {/* Right side */}
            {user && (
              <div className="flex items-center gap-4">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-gray-700">{user.name}</p>
                  <p className="text-xs text-gray-500">
                    {user.role === 'admin' && !user.hospital_id ? 'All hospitals' : user.hospital_name}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
