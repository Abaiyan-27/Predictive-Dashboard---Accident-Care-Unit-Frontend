import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { NurseDashboard } from './pages/nurse/NurseDashboard';
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { DoctorEpisodePage } from './pages/doctor/DoctorEpisodePage';
import { AdminEpisodePage } from './pages/admin/AdminEpisodePage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { GovernmentLayout } from './pages/government/GovernmentLayout';
import { ForecastPage } from './pages/government/ForecastPage';
import { AssociationRulesPage } from './pages/government/AssociationRulesPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Nurse */}
          <Route
            path="/nurse"
            element={
              <ProtectedRoute allowedRoles={['nurse']}>
                <NurseDashboard />
              </ProtectedRoute>
            }
          />

          {/* Doctor */}
          <Route
            path="/doctor"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/episodes/:accidentId/:section?"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorEpisodePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/episodes/:accidentId"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminEpisodePage />
              </ProtectedRoute>
            }
          />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Government: accident forecasting and association rules only (read-only) */}
          <Route
            path="/government"
            element={
              <ProtectedRoute allowedRoles={['government']}>
                <GovernmentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="forecast" replace />} />
            <Route path="forecast" element={<ForecastPage />} />
            <Route path="associations" element={<AssociationRulesPage />} />
            <Route path="*" element={<Navigate to="/government/forecast" replace />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
