import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import type {
  AttendanceRecord,
  Employee,
  LeaveRequest,
  SystemHealth,
  TokenResponse,
  UserAuthProfile,
  WFHRequest,
} from '../types';

const STORAGE_KEY_BASE_URL = '@vorldx_api_base_url';
const STORAGE_KEY_TOKEN = '@vorldx_auth_token';

// Extract the host IP from Metro scriptURL (e.g. "http://172.20.10.2:8081/index.bundle...")
export const getDetectedHost = (): string | null => {
  try {
    const scriptURL = (NativeModules as Record<string, any>)?.SourceCode?.scriptURL;
    if (scriptURL && typeof scriptURL === 'string') {
      const match = scriptURL.match(/^https?:\/\/([^:\/\s]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1];
      }
    }
  } catch {
    // ignore
  }
  return null;
};

const detectedHost = getDetectedHost();

// Smart default: If Metro host IP is detected on physical device, use it; otherwise fallback to known PC IP / emulator
export const DEFAULT_URL = detectedHost
  ? `http://${detectedHost}:8000`
  : Platform.select({
    android: 'http://10.0.2.2:8000',
    ios: 'http://172.20.10.2:8000',
    default: 'http://172.20.10.2:8000',
  });

let cachedBaseUrl: string = DEFAULT_URL;
let cachedToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export class ApiService {
  public static setUnauthorizedHandler(handler: () => void): void {
    unauthorizedHandler = handler;
  }

  public static async getBaseUrl(): Promise<string> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_BASE_URL);
      if (stored) {
        // If stored URL was localhost on physical iOS device, override with detected/LAN host
        if (
          Platform.OS === 'ios' &&
          (stored.includes('127.0.0.1') || stored.includes('localhost')) &&
          DEFAULT_URL !== stored
        ) {
          cachedBaseUrl = DEFAULT_URL;
          await AsyncStorage.setItem(STORAGE_KEY_BASE_URL, DEFAULT_URL);
          return DEFAULT_URL;
        }
        cachedBaseUrl = stored;
        return stored;
      }
    } catch {
      // Fallback to cached default
    }
    cachedBaseUrl = DEFAULT_URL;
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

  public static async getToken(): Promise<string | null> {
    if (cachedToken) return cachedToken;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_TOKEN);
      cachedToken = stored;
      return stored;
    } catch {
      return null;
    }
  }

  public static async setToken(token: string): Promise<void> {
    cachedToken = token;
    await AsyncStorage.setItem(STORAGE_KEY_TOKEN, token);
  }

  public static async clearToken(): Promise<void> {
    cachedToken = null;
    await AsyncStorage.removeItem(STORAGE_KEY_TOKEN);
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    const token = await this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        // Handle session expiry
        await this.clearToken();
        if (unauthorizedHandler) {
          unauthorizedHandler();
        }
      }

      if (!response.ok) {
        let errorMsg = `Server responded with status ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson && errJson.detail) {
            errorMsg =
              typeof errJson.detail === 'string'
                ? errJson.detail
                : JSON.stringify(errJson.detail);
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
        if (
          err.name === 'AbortError' ||
          err.message.includes('FetchRequestCanceledException') ||
          err.message.includes('fetch request has been canceled') ||
          err.message.includes('timed out')
        ) {
          throw new Error(
            `Unable to connect to backend at ${baseUrl}. Please check that uvicorn is running with --host 0.0.0.0 and your phone is on the same Wi-Fi.`
          );
        }
        if (
          err.message.includes('Network request failed') ||
          err.message.includes('Failed to fetch') ||
          err.message.includes('Network Error')
        ) {
          throw new Error(
            `Network unreachable. Cannot connect to ${baseUrl}. Check your Wi-Fi connection and backend status.`
          );
        }
        throw err;
      }
      throw new Error('An unexpected network error occurred.');
    }
  }

  // --- Health Probe ---
  public static async checkHealth(): Promise<SystemHealth> {
    return this.request<SystemHealth>('/health');
  }

  // --- Authentication ---
  public static async login(loginId: string, password: string): Promise<TokenResponse> {
    const response = await this.request<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        login_id: loginId.trim(),
        password,
      }),
    });

    if (response.user.role !== 'EMPLOYEE') {
      throw new Error(
        'Administrator accounts cannot access employee self-service on mobile. Please log in through the VorldX Admin Web portal.'
      );
    }

    if (response.access_token) {
      await this.setToken(response.access_token);
    }

    return response;
  }

  public static async getMe(): Promise<UserAuthProfile> {
    return this.request<UserAuthProfile>('/api/v1/auth/me');
  }

  // --- Employees ---
  public static async getEmployee(id: number): Promise<Employee> {
    return this.request<Employee>(`/api/v1/employees/${id}`);
  }

  // --- Attendance ---
  public static async getAttendance(
    employeeId?: number,
    date?: string
  ): Promise<AttendanceRecord[]> {
    const params = new URLSearchParams();
    if (employeeId) params.append('employee_id', employeeId.toString());
    if (date) params.append('attendance_date', date);
    params.append('limit', '50');
    const query = `?${params.toString()}`;
    return this.request<AttendanceRecord[]>(`/api/v1/attendance${query}`);
  }

  public static async checkIn(
    employeeId: number,
    source: string = 'OFFICE_QR',
    qrToken?: string
  ): Promise<AttendanceRecord> {
    const bodyPayload: { employee_id: number; source: string; qr_token?: string } = {
      employee_id: employeeId,
      source,
    };
    if (qrToken && qrToken.trim()) {
      bodyPayload.qr_token = qrToken.trim();
    }

    return this.request<AttendanceRecord>('/api/v1/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(bodyPayload),
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

  // --- Leave Requests ---
  public static async getLeaveRequests(
    employeeId?: number,
    status?: string
  ): Promise<LeaveRequest[]> {
    const params = new URLSearchParams();
    if (employeeId) params.append('employee_id', employeeId.toString());
    if (status) params.append('status', status);
    params.append('limit', '50');
    const query = `?${params.toString()}`;
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

  // --- Work-From-Home (WFH) Requests ---
  public static async getWFHRequests(
    employeeId?: number,
    status?: string
  ): Promise<WFHRequest[]> {
    const params = new URLSearchParams();
    if (employeeId) params.append('employee_id', employeeId.toString());
    if (status) params.append('status', status);
    params.append('limit', '50');
    const query = `?${params.toString()}`;
    return this.request<WFHRequest[]>(`/api/v1/wfh${query}`);
  }

  public static async submitWFHRequest(payload: {
    employee_id: number;
    start_date: string;
    end_date: string;
    reason: string;
  }): Promise<WFHRequest> {
    return this.request<WFHRequest>('/api/v1/wfh', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}
