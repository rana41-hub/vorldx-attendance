import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { ApiService } from '../services/api';
import type { AttendanceRecord, Employee, UserAuthProfile } from '../types';

interface AppContextType {
  isAuthenticated: boolean;
  isRestoringSession: boolean;
  user: UserAuthProfile | null;
  currentEmployee: Employee | null;
  todayRecord: AttendanceRecord | null;
  isLoading: boolean;
  isBackendOnline: boolean;
  baseUrl: string;
  login: (loginId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateBaseUrl: (url: string) => Promise<void>;
  refreshTodayStatus: () => Promise<void>;
  refreshEmployee: () => Promise<void>;
  toastMessage: { text: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [user, setUser] = useState<UserAuthProfile | null>(null);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [baseUrl, setBaseUrlState] = useState('http://127.0.0.1:8000');
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  const refreshTodayStatus = useCallback(async () => {
    if (!currentEmployee) {
      setTodayRecord(null);
      return;
    }
    try {
      // 1. Prefer authoritative backend dashboard data
      try {
        const dashData = await ApiService.getDashboardData();
        if (dashData && dashData.today_record !== undefined) {
          setTodayRecord(dashData.today_record);
          return;
        }
      } catch {
        // Fallback to record query if dashboard endpoint is unavailable
      }

      // 2. Resilient fallback: Query recent records without UTC date mismatch
      const records = await ApiService.getAttendance(currentEmployee.id);
      if (records && records.length > 0) {
        const latest = records[0];
        const now = new Date();
        const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        // Match today's shift or any unclosed shift started in the last 24h
        if (latest.attendance_date === localTodayStr || !latest.check_out) {
          setTodayRecord(latest);
        } else {
          setTodayRecord(null);
        }
      } else {
        setTodayRecord(null);
      }
    } catch {
      // In offline mode or error, keep existing state
    }
  }, [currentEmployee]);

  const refreshEmployee = useCallback(async () => {
    if (!user?.employee_id) return;
    try {
      const emp = await ApiService.getEmployee(user.employee_id);
      setCurrentEmployee(emp);
    } catch {
      // Fallback
    }
  }, [user]);

  const checkServerStatus = useCallback(async () => {
    try {
      await ApiService.checkHealth();
      setIsBackendOnline(true);
    } catch {
      setIsBackendOnline(false);
    }
  }, []);

  const updateBaseUrl = async (newUrl: string) => {
    await ApiService.setBaseUrl(newUrl);
    setBaseUrlState(newUrl);
    await checkServerStatus();
  };

  const logout = useCallback(async () => {
    await ApiService.clearToken();
    setUser(null);
    setCurrentEmployee(null);
    setTodayRecord(null);
    setIsAuthenticated(false);
    showToast('Logged out successfully', 'info');
  }, [showToast]);

  const login = async (loginId: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await ApiService.login(loginId, password);
      setUser(res.user);
      setIsAuthenticated(true);

      if (res.user.employee_id) {
        const emp = await ApiService.getEmployee(res.user.employee_id);
        setCurrentEmployee(emp);
      } else {
        // Build fallback employee from user profile if not directly fetched
        setCurrentEmployee({
          id: res.user.employee_id || 0,
          employee_code: res.user.employee_code || loginId,
          first_name: res.user.full_name?.split(' ')[0] || 'Team',
          last_name: res.user.full_name?.split(' ').slice(1).join(' ') || 'Member',
          department: 'General',
          designation: 'Staff',
        });
      }

      showToast(`Welcome back, ${res.user.full_name || res.user.employee_code}!`, 'success');
    } finally {
      setIsLoading(false);
    }
  };

  // Restore authenticated session on app mount
  useEffect(() => {
    const init = async () => {
      setIsRestoringSession(true);
      const url = await ApiService.getCurrentBaseUrl();
      setBaseUrlState(url);

      // Register session expiration handler
      ApiService.setUnauthorizedHandler(() => {
        setIsAuthenticated(false);
        setUser(null);
        setCurrentEmployee(null);
        setTodayRecord(null);
        showToast('Your session has expired. Please log in again.', 'error');
      });

      await checkServerStatus();

      const token = await ApiService.getToken();
      if (token) {
        try {
          const profile = await ApiService.getMe();
          if (profile && profile.role === 'EMPLOYEE') {
            setUser(profile);
            setIsAuthenticated(true);
            if (profile.employee_id) {
              const emp = await ApiService.getEmployee(profile.employee_id);
              setCurrentEmployee(emp);
            }
          } else {
            // Admin or invalid role in mobile app
            await ApiService.clearToken();
            setIsAuthenticated(false);
          }
        } catch {
          // Token expired or invalid
          await ApiService.clearToken();
          setIsAuthenticated(false);
        }
      }

      setIsRestoringSession(false);
    };

    init();
  }, [checkServerStatus, showToast]);

  // Keep today's attendance status refreshed whenever currentEmployee changes
  useEffect(() => {
    if (currentEmployee) {
      refreshTodayStatus();
    }
  }, [currentEmployee, refreshTodayStatus]);

  // Foreground sync: Automatically refresh attendance & health when app returns to active state
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkServerStatus();
        if (currentEmployee) {
          refreshTodayStatus();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [checkServerStatus, currentEmployee, refreshTodayStatus]);

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        isRestoringSession,
        user,
        currentEmployee,
        todayRecord,
        isLoading,
        isBackendOnline,
        baseUrl,
        login,
        logout,
        updateBaseUrl,
        refreshTodayStatus,
        refreshEmployee,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
