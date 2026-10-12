import type {
  AttendanceRecord,
  BackendHealthResponse,
  DatabaseHealthResponse,
  Employee,
  LeaveRequest,
  SystemHealth,
} from '../types';

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) || 'http://127.0.0.1:8000';

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

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 6000
): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${BASE_URL.replace(/\/+$/, '')}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(id);

    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }
      const message =
        (typeof errorBody === 'object' &&
          errorBody !== null &&
          'detail' in errorBody &&
          typeof errorBody.detail === 'string' &&
          errorBody.detail) ||
        `Request failed with status ${res.status}`;
      throw new ApiError(res.status, message, errorBody);
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    clearTimeout(id);
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out. Please check backend server.');
    }
    throw new ApiError(
      0,
      'Unable to connect to backend server. Make sure FastAPI is running.'
    );
  }
}

export const api = {
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

  // Employees
  async getEmployees(department?: string): Promise<Employee[]> {
    const query = department ? `?department=${encodeURIComponent(department)}` : '';
    return request<Employee[]>(`/api/v1/employees${query}`);
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

  // Attendance
  async getAttendance(date?: string, employeeId?: number): Promise<AttendanceRecord[]> {
    const params = new URLSearchParams();
    if (date) params.append('attendance_date', date);
    if (employeeId) params.append('employee_id', String(employeeId));
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<AttendanceRecord[]>(`/api/v1/attendance${query}`);
  },

  async recordCheckIn(employeeId: number, source = 'OFFICE_QR'): Promise<AttendanceRecord> {
    return request<AttendanceRecord>('/api/v1/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({ employee_id: employeeId, source }),
    });
  },

  async recordCheckOut(employeeId: number): Promise<AttendanceRecord> {
    return request<AttendanceRecord>('/api/v1/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify({ employee_id: employeeId }),
    });
  },

  // Leave Requests
  async getLeaveRequests(status?: string): Promise<LeaveRequest[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<LeaveRequest[]>(`/api/v1/leave${query}`);
  },
};
