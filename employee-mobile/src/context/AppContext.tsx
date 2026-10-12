import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from '../services/api';
import type { AttendanceRecord, Employee } from '../types';

interface AppContextType {
  currentEmployee: Employee | null;
  setCurrentEmployee: (emp: Employee) => void;
  employees: Employee[];
  todayRecord: AttendanceRecord | null;
  isLoading: boolean;
  isBackendOnline: boolean;
  baseUrl: string;
  updateBaseUrl: (url: string) => Promise<void>;
  refreshTodayStatus: () => Promise<void>;
  refreshEmployees: () => Promise<void>;
  toastMessage: { text: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const STORAGE_KEY_SELECTED_EMP = '@vorldx_selected_emp_id';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentEmployee, setCurrentEmployeeState] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      const today = new Date().toISOString().split('T')[0];
      const records = await ApiService.getAttendance(currentEmployee.id, today);
      if (records && records.length > 0) {
        setTodayRecord(records[0]);
      } else {
        setTodayRecord(null);
      }
    } catch {
      // In offline mode or error, keep existing state
    }
  }, [currentEmployee]);

  const refreshEmployees = useCallback(async () => {
    try {
      const list = await ApiService.getEmployees();
      setEmployees(list);
      setIsBackendOnline(true);

      const savedEmpId = await AsyncStorage.getItem(STORAGE_KEY_SELECTED_EMP);
      if (savedEmpId) {
        const found = list.find((e) => e.id === Number(savedEmpId));
        if (found) {
          setCurrentEmployeeState(found);
          return;
        }
      }

      // Default to first employee if not set
      if (list.length > 0 && !currentEmployee) {
        setCurrentEmployeeState(list[0]);
      }
    } catch {
      setIsBackendOnline(false);
    }
  }, [currentEmployee]);

  const updateBaseUrl = async (newUrl: string) => {
    await ApiService.setBaseUrl(newUrl);
    setBaseUrlState(newUrl);
    await refreshEmployees();
  };

  const setCurrentEmployee = async (emp: Employee) => {
    setCurrentEmployeeState(emp);
    await AsyncStorage.setItem(STORAGE_KEY_SELECTED_EMP, emp.id.toString());
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const url = await ApiService.getCurrentBaseUrl();
      setBaseUrlState(url);
      try {
        await ApiService.checkHealth();
        setIsBackendOnline(true);
      } catch {
        setIsBackendOnline(false);
      }
      await refreshEmployees();
      setIsLoading(false);
    };
    init();
  }, [refreshEmployees]);

  useEffect(() => {
    if (currentEmployee) {
      refreshTodayStatus();
    }
  }, [currentEmployee, refreshTodayStatus]);

  return (
    <AppContext.Provider
      value={{
        currentEmployee,
        setCurrentEmployee,
        employees,
        todayRecord,
        isLoading,
        isBackendOnline,
        baseUrl,
        updateBaseUrl,
        refreshTodayStatus,
        refreshEmployees,
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
