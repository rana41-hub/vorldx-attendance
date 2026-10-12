import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { EmployeesPage } from './features/employees/EmployeesPage';
import { AttendancePage } from './features/attendance/AttendancePage';
import { LeavePage } from './features/leave/LeavePage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SettingsPage } from './features/settings/SettingsPage';
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
    // Poll health status every 25 seconds
    const interval = setInterval(fetchHealth, 25000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <AppLayout
              health={health}
              onRefreshHealth={fetchHealth}
              isHealthLoading={isHealthLoading}
            />
          }
        >
          <Route index element={<DashboardPage health={health} />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="leave" element={<LeavePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage health={health} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
