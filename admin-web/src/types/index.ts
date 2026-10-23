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

export interface User {
  id: number;
  admin_id?: string | null;
  employee_code?: string | null;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  is_active: boolean;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
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
  // Optional enriched fields
  employee_name?: string;
  employee_code?: string;
  department?: string;
  hours_worked?: number | null;
  session_state?: string | null;
  is_corrected?: boolean;
  corrected_at?: string | null;
  corrected_by?: number | null;
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
  employee_name?: string;
  employee_code?: string;
  department?: string;
}

export interface WFHRequest {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  created_at: string;
  employee_name?: string;
  employee_code?: string;
  department?: string;
}

export interface AttendancePolicy {
  id: number;
  policy_name: string;
  work_start_time: string;
  work_end_time: string;
  late_grace_minutes: number;
  early_departure_grace_minutes: number;
  half_day_hours_threshold: number;
  full_day_hours_threshold: number;
  auto_detect_late_arrival: boolean;
  auto_detect_early_departure: boolean;
  is_active: boolean;
  updated_at: string;
  updated_by?: number | null;
}

export interface PolicyCalculationResponse {
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT';
  hours_worked?: number | null;
  is_late: boolean;
  is_early_departure: boolean;
  details: string;
}

export interface DashboardMetricsResponse {
  date: string;
  total_active_employees: number;
  present_today: number;
  absent_today: number;
  on_leave_today: number;
  wfh_today: number;
  half_day_today: number;
  late_today: number;
  pending_leave_requests: number;
  pending_wfh_requests: number;
}

export interface AttendanceSummaryResponse {
  start_date: string;
  end_date: string;
  total_days: number;
  total_active_employees: number;
  total_attendance_records: number;
  present_count: number;
  late_count: number;
  half_day_count: number;
  approved_leave_days: number;
  approved_wfh_days: number;
  average_daily_attendance: number;
  attendance_rate_percentage: number;
}

export interface DailyTrendItem {
  date: string;
  present: number;
  late: number;
  half_day: number;
  on_leave: number;
  wfh: number;
  absent: number;
  total_active: number;
}

export interface AttendanceTrendsResponse {
  start_date: string;
  end_date: string;
  trends: DailyTrendItem[];
}

export interface QRSession {
  session_id: number;
  token: string;
  qr_code_payload: string;
  office_code: string;
  created_at: string;
  expires_at: string;
  remaining_seconds: number;
  is_active: boolean;
}

export interface AuditLog {
  id: number;
  admin_id?: number | null;
  admin_name?: string | null;
  action_type: string;
  employee_id?: number | null;
  employee_name?: string | null;
  attendance_record_id?: number | null;
  policy_id?: number | null;
  reason: string;
  previous_values?: Record<string, unknown> | null;
  updated_values?: Record<string, unknown> | null;
  created_at: string;
}

export interface AttendanceCorrectionPayload {
  check_in?: string | null;
  check_out?: string | null;
  status?: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | null;
  reason: string;
}


