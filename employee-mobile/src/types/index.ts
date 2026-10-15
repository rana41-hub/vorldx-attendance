export type AttendanceStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type WFHStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type UserRole = 'ADMIN' | 'EMPLOYEE';

export interface UserAuthProfile {
  id: number;
  role: UserRole;
  admin_id?: string | null;
  employee_id?: number | null;
  employee_code?: string | null;
  full_name?: string | null;
  email: string;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserAuthProfile;
}

export interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  department: string;
  designation: string;
  phone?: string | null;
  full_name?: string;
  user_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceRecord {
  id: number;
  employee_id: number;
  attendance_date: string;
  check_in: string;
  check_out: string | null;
  status: AttendanceStatus;
  source: string;
  created_at: string;
}

export interface LeaveRequest {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface WFHRequest {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  reason: string;
  status: WFHStatus;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface SystemHealth {
  status: string;
  service?: string;
  environment?: string;
  timestamp?: string;
}
