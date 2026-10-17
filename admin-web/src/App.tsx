import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { EmployeesPage } from './features/employees/EmployeesPage';
import { AttendancePage } from './features/attendance/AttendancePage';
import { LeavePage } from './features/leave/LeavePage';
import { WFHPage } from './features/wfh/WFHPage';
import { PolicyPage } from './features/policy/PolicyPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { KioskPage } from './features/kiosk/KioskPage';
import { api } from './services/api';
import type { SystemHealth } from './types';

export const App: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth>({
    state: 'checking',
    databaseConnected: false,
  });
  const [isHealthLoading, setIsHealthLoading] = useState(false);

  const fetchHealth = useCallback(async () => {
    setIsHealthLoading(true);
    try {
      const res = await api.checkSystemHealth();
      setHealth(res);
    } catch {
      setHealth({
        state: 'disconnected',
        backendMessage: 'Connection failed',
        databaseConnected: false,
      });
    } finally {
      setIsHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Dedicated Fullscreen Office Attendance Kiosk Route */}
          <Route
            path="/kiosk"
            element={
              <ProtectedRoute>
                <KioskPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Administrator Application Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout
                  health={health}
                  onRefreshHealth={fetchHealth}
                  isHealthLoading={isHealthLoading}
                />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage health={health} />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="leave" element={<LeavePage />} />
            <Route path="wfh" element={<WFHPage />} />
            <Route path="policy" element={<PolicyPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage health={health} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
