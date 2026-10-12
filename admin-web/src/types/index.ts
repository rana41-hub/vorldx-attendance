export type HealthState = 'checking' | 'connected' | 'disconnected' | 'degraded';

export interface BackendHealthResponse {
  status: string;
  service?: string;
  environment?: string;
}

export interface DatabaseHealthResponse {
  status: string;
  database: string;
}

export interface SystemHealth {
  state: HealthState;
  backendMessage?: string;
  databaseConnected: boolean;
  latencyMs?: number;
  lastChecked?: string;
}

export interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  department: string;
  designation: string;
  phone?: string | null;
  user_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: number;
  employee_id: number;
  attendance_date: string;
  check_in: string;
  check_out?: string | null;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT';
  source?: string | null;
  created_at: string;
  // Optional enriched fields for presentation
  employee_name?: string;
  employee_code?: string;
  department?: string;
}

export interface LeaveRequest {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  created_at: string;
  // Optional enriched field
  employee_name?: string;
}

export interface DashboardMetrics {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  pendingLeaves: number;
  isDemoData: boolean;
}
