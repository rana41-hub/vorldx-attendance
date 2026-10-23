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
  incomplete_today?: number;
  attendance_percentage?: number;
  pending_leave_requests: number;
  pending_wfh_requests: number;
}

export interface DailyAttendanceReportResponse {
  report_date: string;
  total_active_employees: number;
  eligible_employees: number;
  present_count: number;
  late_count: number;
  half_day_count: number;
  total_attended: number;
  incomplete_count: number;
  on_leave_count: number;
  wfh_count: number;
  absent_count: number;
  attended_eligible_count?: number;
  wfh_remote_count?: number;
  attended_wfh_count?: number;
  attendance_percentage: number;
  definitions: Record<string, string>;
}

export interface LateAttendanceItem {
  record_id: number;
  employee_id: number;
  employee_code: string;
  employee_name: string;
  department: string;
  attendance_date: string;
  check_in: string;
  check_out?: string | null;
  minutes_late?: number | null;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT';
  is_corrected: boolean;
  source?: string | null;
}

export interface LateAttendanceReportResponse {
  start_date: string;
  end_date: string;
  total_late_records: number;
  total_attendance_records: number;
  late_percentage: number;
  shift_start_time: string;
  late_grace_minutes: number;
  records: LateAttendanceItem[];
}

export interface WFHReportItem {
  id: number;
  employee_id: number;
  employee_code: string;
  employee_name: string;
  department: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  submitted_at: string;
  reviewed_at?: string | null;
  reviewer_id?: number | null;
  reviewer_name?: string | null;
}

export interface WFHReportResponse {
  start_date: string;
  end_date: string;
  filter_by: string;
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  cancelled_requests: number;
  total_approved_wfh_days: number;
  requests: WFHReportItem[];
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


