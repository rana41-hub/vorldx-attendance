import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { AttendanceRecord, Employee, LeaveRequest, SystemHealth } from '../types';

const STORAGE_KEY_BASE_URL = '@vorldx_api_base_url';
const DEFAULT_URL = Platform.select({
  android: 'http://10.0.2.2:8000',
  default: 'http://127.0.0.1:8000',
});

let cachedBaseUrl: string = DEFAULT_URL;

export class ApiService {
  private static async getBaseUrl(): Promise<string> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_BASE_URL);
      if (stored) {
        cachedBaseUrl = stored;
        return stored;
      }
    } catch {
      // Fallback to cached/default
    }
    return cachedBaseUrl;
  }

  public static async setBaseUrl(url: string): Promise<void> {
    const trimmed = url.trim().replace(/\/+$/, '');
    cachedBaseUrl = trimmed;
    await AsyncStorage.setItem(STORAGE_KEY_BASE_URL, trimmed);
  }

  public static async getCurrentBaseUrl(): Promise<string> {
    return this.getBaseUrl();
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = `Server responded with status ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson && errJson.detail) {
            errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
          }
        } catch {
          // Keep generic message
        }
        throw new Error(errorMsg);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error('Connection timed out. Check backend URL or server status.');
        }
        throw err;
      }
      throw new Error('An unexpected network error occurred.');
    }
  }

  public static async checkHealth(): Promise<SystemHealth> {
    return this.request<SystemHealth>('/health');
  }

  public static async getEmployees(): Promise<Employee[]> {
    return this.request<Employee[]>('/api/v1/employees?limit=100');
  }

  public static async getEmployee(id: number): Promise<Employee> {
    return this.request<Employee>(`/api/v1/employees/${id}`);
  }

  public static async getAttendance(employeeId?: number, date?: string): Promise<AttendanceRecord[]> {
    const params = new URLSearchParams();
    if (employeeId) params.append('employee_id', employeeId.toString());
    if (date) params.append('attendance_date', date);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<AttendanceRecord[]>(`/api/v1/attendance${query}`);
  }

  public static async checkIn(employeeId: number, source: string = 'OFFICE_QR'): Promise<AttendanceRecord> {
    return this.request<AttendanceRecord>('/api/v1/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({
        employee_id: employeeId,
        source,
      }),
    });
  }

  public static async checkOut(employeeId: number): Promise<AttendanceRecord> {
    return this.request<AttendanceRecord>('/api/v1/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify({
        employee_id: employeeId,
      }),
    });
  }

  public static async getLeaveRequests(employeeId?: number): Promise<LeaveRequest[]> {
    const params = new URLSearchParams();
    if (employeeId) params.append('employee_id', employeeId.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<LeaveRequest[]>(`/api/v1/leave${query}`);
  }

  public static async submitLeaveRequest(payload: {
    employee_id: number;
    start_date: string;
    end_date: string;
    reason: string;
  }): Promise<LeaveRequest> {
    return this.request<LeaveRequest>('/api/v1/leave', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}
