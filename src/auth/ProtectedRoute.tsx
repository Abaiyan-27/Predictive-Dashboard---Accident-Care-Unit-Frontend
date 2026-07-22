import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { Role } from '../types';

interface ProtectedRouteProps {
  allowedRoles: Role[];
  children: React.ReactNode;
}

const ROLE_HOME: Record<Role, string> = {
  nurse: '/nurse',
  doctor: '/doctor',
  admin: '/admin',
  government: '/government',
};

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return <>{children}</>;
}
