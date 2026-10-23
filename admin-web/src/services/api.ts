import type {
  AttendanceCorrectionPayload,
  AttendancePolicy,
  AttendanceRecord,
  AttendanceSummaryResponse,
  AttendanceTrendsResponse,
  AuditLog,
  BackendHealthResponse,
  DatabaseHealthResponse,
  DashboardMetricsResponse,
  Employee,
  LeaveRequest,
  LoginResponse,
  PolicyCalculationResponse,
  QRSession,
  SystemHealth,
  User,
  WFHRequest,
} from '../types';

function resolveApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  // Dynamic host fallback: When accessing admin-web over LAN (e.g. from mobile browser or tablet),
  // automatically target the same host on backend port 8000 instead of hardcoded 127.0.0.1.
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      return `${protocol}//${host}:8000`;
    }
  }
  return 'http://127.0.0.1:8000';
}

const BASE_URL = resolveApiBaseUrl();

const TOKEN_KEY = 'vorldx_admin_token';
const USER_KEY = 'vorldx_admin_user';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 8000
): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${BASE_URL.replace(/\/+$/, '')}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const token = getStoredToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers,
    });

    clearTimeout(id);

    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }

      let message = `Request failed with status ${res.status}`;
      if (typeof errorBody === 'object' && errorBody !== null && 'detail' in errorBody) {
        const detail = (errorBody as { detail: unknown }).detail;
        if (typeof detail === 'string') {
          message = detail;
        } else if (Array.isArray(detail) && detail.length > 0 && detail[0].msg) {
          message = detail.map((d: { msg?: string }) => d.msg).join(', ');
        }
      }

      // If token expired or unauthorized
      if (res.status === 401 && token) {
        clearStoredAuth();
        window.dispatchEvent(new Event('vorldx_auth_expired'));
      }

      throw new ApiError(res.status, message, errorBody);
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    clearTimeout(id);
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out. Please verify backend server.');
    }
    throw new ApiError(
      0,
      'Unable to connect to backend server. Make sure FastAPI is running.'
    );
  }
}

export const api = {
  // Authentication
  async login(loginId: string, password: string): Promise<LoginResponse> {
    const res = await request<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login_id: loginId, password }),
    });
    setStoredToken(res.access_token);
    setStoredUser(res.user);
    return res;
  },

  async getMe(): Promise<User> {
    const user = await request<User>('/api/v1/auth/me');
    setStoredUser(user);
    return user;
  },

  logout(): void {
    clearStoredAuth();
  },

  // System Health
  async checkSystemHealth(): Promise<SystemHealth> {
    const start = performance.now();
    try {
      const [backend, db] = await Promise.all([
        request<BackendHealthResponse>('/health'),
        request<DatabaseHealthResponse>('/health/database'),
      ]);

      const latencyMs = Math.round(performance.now() - start);
      const isDbOk = db.status === 'healthy' && db.database === 'connected';
      const isBackendOk = backend.status === 'healthy';

      if (isBackendOk && isDbOk) {
        return {
          state: 'connected',
          backendMessage: `${backend.service || 'API'} online (${backend.environment || 'dev'})`,
          databaseConnected: true,
          latencyMs,
          lastChecked: new Date().toLocaleTimeString(),
        };
      }

      return {
        state: 'degraded',
        backendMessage: 'API connected, database degraded',
        databaseConnected: isDbOk,
        latencyMs,
        lastChecked: new Date().toLocaleTimeString(),
      };
    } catch (err) {
      return {
        state: 'disconnected',
        backendMessage: err instanceof Error ? err.message : 'Backend unreachable',
        databaseConnected: false,
        lastChecked: new Date().toLocaleTimeString(),
      };
    }
  },

  // Dashboard & Analytics
  async getDashboardMetrics(targetDate?: string): Promise<DashboardMetricsResponse> {
    const query = targetDate ? `?target_date=${encodeURIComponent(targetDate)}` : '';
    return request<DashboardMetricsResponse>(`/api/v1/analytics/dashboard${query}`);
  },

  async getAttendanceSummary(
    startDate: string,
    endDate: string
  ): Promise<AttendanceSummaryResponse> {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    return request<AttendanceSummaryResponse>(`/api/v1/analytics/summary?${params.toString()}`);
  },

  async getAttendanceTrends(
    startDate?: string,
    endDate?: string
  ): Promise<AttendanceTrendsResponse> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<AttendanceTrendsResponse>(`/api/v1/analytics/trends${query}`);
  },

  // Employees
  async getEmployees(department?: string): Promise<Employee[]> {
    const query = department ? `?department=${encodeURIComponent(department)}` : '';
    return request<Employee[]>(`/api/v1/employees${query}`);
  },

  async getEmployee(id: number): Promise<Employee> {
    return request<Employee>(`/api/v1/employees/${id}`);
  },

  async createEmployee(data: {
    employee_code: string;
    first_name: string;
    last_name: string;
    department: string;
    designation: string;
    phone?: string;
  }): Promise<Employee> {
    return request<Employee>('/api/v1/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateEmployee(
    id: number,
    data: {
      employee_code?: string;
      first_name?: string;
      last_name?: string;
      department?: string;
      designation?: string;
      phone?: string;
    }
  ): Promise<Employee> {
    return request<Employee>(`/api/v1/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteEmployee(id: number): Promise<{ message: string; id: number }> {
    return request<{ message: string; id: number }>(`/api/v1/employees/${id}`, {
      method: 'DELETE',
    });
  },

  async createEmployeeAccount(
    id: number,
    data: { email: string; password: string }
  ): Promise<{ message: string; employee_id: number; user_id: number }> {
    return request<{ message: string; employee_id: number; user_id: number }>(
      `/api/v1/employees/${id}/account`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  async updateEmployeeStatus(
    id: number,
    isActive: boolean
  ): Promise<{ message: string; is_active: boolean }> {
    return request<{ message: string; is_active: boolean }>(
      `/api/v1/employees/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive }),
      }
    );
  },

  // Attendance
  async getAttendance(
    filters?:
      | {
          date?: string;
          employeeId?: number;
          startDate?: string;
          endDate?: string;
          status?: string;
          limit?: number;
          offset?: number;
        }
      | string,
    employeeIdParam?: number
  ): Promise<AttendanceRecord[]> {
    const params = new URLSearchParams();
    if (typeof filters === 'string') {
      if (filters) params.append('attendance_date', filters);
      if (employeeIdParam) params.append('employee_id', String(employeeIdParam));
    } else if (filters) {
      if (filters.date) params.append('attendance_date', filters.date);
      if (filters.employeeId) params.append('employee_id', String(filters.employeeId));
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.limit) params.append('limit', String(filters.limit));
      if (filters.offset) params.append('offset', String(filters.offset));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<AttendanceRecord[]>(`/api/v1/attendance${query}`);
  },

  async correctAttendance(
    recordId: number,
    payload: AttendanceCorrectionPayload
  ): Promise<AttendanceRecord> {
    return request<AttendanceRecord>(`/api/v1/attendance/${recordId}/correct`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async getAttendanceAuditLogs(params?: {
    attendanceRecordId?: number;
    employeeId?: number;
    actionType?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    const q = new URLSearchParams();
    if (params?.attendanceRecordId) q.append('attendance_record_id', String(params.attendanceRecordId));
    if (params?.employeeId) q.append('employee_id', String(params.employeeId));
    if (params?.actionType) q.append('action_type', params.actionType);
    if (params?.limit) q.append('limit', String(params.limit));
    if (params?.offset) q.append('offset', String(params.offset));
    const query = q.toString() ? `?${q.toString()}` : '';
    return request<AuditLog[]>(`/api/v1/attendance/audit-logs${query}`);
  },

  async recordCheckIn(
    employeeId: number,
    source = 'OFFICE_QR',
    timestamp?: string
  ): Promise<AttendanceRecord> {
    return request<AttendanceRecord>('/api/v1/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({ employee_id: employeeId, source, timestamp }),
    });
  },

  async recordCheckOut(employeeId: number, timestamp?: string): Promise<AttendanceRecord> {
    return request<AttendanceRecord>('/api/v1/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify({ employee_id: employeeId, timestamp }),
    });
  },

  // Attendance Policy
  async getPolicy(): Promise<AttendancePolicy> {
    return request<AttendancePolicy>('/api/v1/attendance/policy');
  },

  async updatePolicy(data: Partial<AttendancePolicy> & { reason?: string }): Promise<AttendancePolicy> {
    return request<AttendancePolicy>('/api/v1/attendance/policy', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async calculatePolicy(
    checkIn: string,
    checkOut?: string
  ): Promise<PolicyCalculationResponse> {
    return request<PolicyCalculationResponse>('/api/v1/attendance/policy/calculate', {
      method: 'POST',
      body: JSON.stringify({ check_in: checkIn, check_out: checkOut }),
    });
  },

  // Leave Requests
  async getLeaveRequests(status?: string, employeeId?: number): Promise<LeaveRequest[]> {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') params.append('status', status);
    if (employeeId) params.append('employee_id', String(employeeId));
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<LeaveRequest[]>(`/api/v1/leave${query}`);
  },

  async createLeaveRequest(data: {
    employee_id: number;
    start_date: string;
    end_date: string;
    reason: string;
  }): Promise<LeaveRequest> {
    return request<LeaveRequest>('/api/v1/leave', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async reviewLeaveRequest(
    id: number,
    action: 'APPROVE' | 'REJECT',
    notes?: string
  ): Promise<LeaveRequest> {
    return request<LeaveRequest>(`/api/v1/leave/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ action, review_notes: notes }),
    });
  },

  // Work-from-Home (WFH) Requests
  async getWFHRequests(status?: string, employeeId?: number): Promise<WFHRequest[]> {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') params.append('status', status);
    if (employeeId) params.append('employee_id', String(employeeId));
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<WFHRequest[]>(`/api/v1/wfh${query}`);
  },

  async createWFHRequest(data: {
    employee_id: number;
    start_date: string;
    end_date: string;
    reason: string;
  }): Promise<WFHRequest> {
    return request<WFHRequest>('/api/v1/wfh', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async reviewWFHRequest(
    id: number,
    action: 'APPROVE' | 'REJECT',
    notes?: string
  ): Promise<WFHRequest> {
    return request<WFHRequest>(`/api/v1/wfh/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ action, review_notes: notes }),
    });
  },

  // Dynamic QR Kiosk Sessions
  async getActiveQRSession(officeCode: string = 'HQ_MAIN'): Promise<QRSession> {
    return request<QRSession>(`/api/v1/qr/active?office_code=${encodeURIComponent(officeCode)}`);
  },

  async rotateQRSession(officeCode: string = 'HQ_MAIN', expireSeconds?: number): Promise<QRSession> {
    return request<QRSession>('/api/v1/qr/rotate', {
      method: 'POST',
      body: JSON.stringify({ office_code: officeCode, expire_seconds: expireSeconds }),
    });
  },
};
