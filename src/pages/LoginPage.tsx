import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../types';
import axios from 'axios';
import { getApiErrorMessage } from '../api/client';
import { changePassword, PASSWORD_CHANGE_REQUIRED } from '../api';
import logo from '../../Predictive Care Dashboard Logo.png';

const ROLE_HOME: Record<Role, string> = {
  nurse: '/nurse',
  doctor: '/doctor',
  admin: '/admin',
  government: '/government',
};

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Accounts created by an admin must replace their temporary password first.
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // If already logged in, redirect
  if (user) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const authenticatedUser = await login({ email, password });
      navigate(ROLE_HOME[authenticatedUser.role], { replace: true });
    } catch (loginError) {
      if (axios.isAxiosError(loginError) && loginError.response?.data?.detail === PASSWORD_CHANGE_REQUIRED) {
        setMustChange(true);
      } else {
        setError(getApiErrorMessage(loginError, 'Unable to sign in.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await changePassword(email, password, newPassword);
      const authenticatedUser = await login({ email, password: newPassword });
      navigate(ROLE_HOME[authenticatedUser.role], { replace: true });
    } catch (changeError) {
      setError(getApiErrorMessage(changeError, 'Unable to change the password.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Animated gradient orbs */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-30 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
          animation: 'gradientShift 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)',
          animation: 'gradientShift 10s ease-in-out infinite reverse',
        }}
      />

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <img src={logo} alt="Accident Care Logo" className="h-16 w-auto mb-4" />
          <h1 className="text-3xl font-bold tracking-tight gradient-text">
            Accident Care
          </h1>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            Predictive hospital dashboard
          </p>
        </div>

        {/* Login card */}
        <div
          className="glass-card p-8"
          style={{ cursor: 'default' }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'none'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
        >
          <h2
            className="text-lg font-semibold mb-6"
            style={{ color: 'var(--text-primary)' }}
          >
            {mustChange ? 'Set your password' : 'Sign in'}
          </h2>

          {mustChange ? (
            <form onSubmit={handleChangePassword} className="space-y-5">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Your account was created with a temporary password. Choose your own password to continue.
              </p>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>New password</label>
                <input id="new-password" type="password" minLength={8} required value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-2.5 text-sm dark-input" />
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Confirm new password</label>
                <input id="confirm-password" type="password" minLength={8} required value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-2.5 text-sm dark-input" />
              </div>
              {error && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--tone-danger)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  {error}
                </p>
              )}
              <button type="submit" disabled={isSubmitting} className="w-full py-2.5 px-4 text-sm gradient-btn">
                {isSubmitting ? 'Saving...' : 'Set password and sign in'}
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 text-sm dark-input"
                placeholder="you@accidentcare.org"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 text-sm dark-input"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <p
                className="text-sm px-3 py-2 rounded-lg"
                style={{
                  color: 'var(--tone-danger)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 text-sm gradient-btn"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          )}
        </div>

        <p className="mt-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          Sign in with an account provisioned in Accident Care.
        </p>
      </div>
    </div>
  );
}
