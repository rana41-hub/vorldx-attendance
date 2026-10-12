export type AttendanceStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  department: string;
  designation: string;
  phone?: string | null;
  created_at?: string;
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
  created_at: string;
}

export interface SystemHealth {
  status: string;
  service: string;
  environment: string;
}
