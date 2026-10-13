import { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Database,
  Server,
  ShieldCheck,
  PlusCircle,
  QrCode,
} from 'lucide-react';
import { SummaryCard } from '../../components/dashboard/SummaryCard';
import { AttendanceChart } from '../../components/dashboard/AttendanceChart';
import { RecentAttendanceTable } from '../../components/dashboard/RecentAttendanceTable';
import type { AttendanceRecord, SystemHealth } from '../../types';
import { api } from '../../services/api';
import { Link } from 'react-router-dom';

interface DashboardPageProps {
  health: SystemHealth;
}

// Sample fallback records for demonstration
const SAMPLE_ATTENDANCE: AttendanceRecord[] = [
  {
    id: 1,
    employee_id: 101,
    employee_name: 'Alex Vance',
    employee_code: 'VX-0101',
    department: 'Engineering',
    attendance_date: new Date().toISOString().split('T')[0],
    check_in: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    check_out: null,
    status: 'PRESENT',
    source: 'OFFICE_QR',
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    employee_id: 102,
    employee_name: 'David Kim',
    employee_code: 'VX-0102',
    department: 'Product',
    attendance_date: new Date().toISOString().split('T')[0],
    check_in: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString(),
    check_out: null,
    status: 'PRESENT',
    source: 'OFFICE_QR',
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    employee_id: 103,
    employee_name: 'Elena Rostova',
    employee_code: 'VX-0103',
    department: 'Security',
    attendance_date: new Date().toISOString().split('T')[0],
    check_in: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    check_out: null,
    status: 'LATE',
    source: 'OFFICE_QR',
    created_at: new Date().toISOString(),
  },
  {
    id: 4,
    employee_id: 104,
    employee_name: 'Sarah Connor',
    employee_code: 'VX-0104',
    department: 'Engineering',
    attendance_date: new Date().toISOString().split('T')[0],
    check_in: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    check_out: new Date(Date.now() - 0.5 * 3600 * 1000).toISOString(),
    status: 'HALF_DAY',
    source: 'MANUAL',
    created_at: new Date().toISOString(),
  },
];

export const DashboardPage: React.FC<DashboardPageProps> = ({ health }) => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isDemoData, setIsDemoData] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const [liveRecords, employees] = await Promise.all([
        api.getAttendance(),
        api.getEmployees(),
      ]);

      setEmployeeCount(employees.length);

      if (liveRecords && liveRecords.length > 0) {
        // Enrich with employee names if available
        const employeeMap = new Map(employees.map((e) => [e.id, e]));
        const enriched = liveRecords.map((r) => {
          const emp = employeeMap.get(r.employee_id);
          return {
            ...r,
            employee_name: emp ? emp.full_name : `Employee #${r.employee_id}`,
            employee_code: emp ? emp.employee_code : `EMP-${r.employee_id}`,
            department: emp ? emp.department : 'General',
          };
        });
        setAttendanceRecords(enriched);
        setIsDemoData(false);
      } else {
        setAttendanceRecords(SAMPLE_ATTENDANCE);
        setIsDemoData(true);
      }
    } catch {
      setAttendanceRecords(SAMPLE_ATTENDANCE);
      setIsDemoData(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome & System Status Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Operations Overview
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live System
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time administrative telemetry, employee presence records, and backend status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            to="/employees"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add Employee
          </Link>
          <Link
            to="/attendance"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            <QrCode className="w-3.5 h-3.5 text-slate-500" />
            Attendance Console
          </Link>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Employees"
          value={employeeCount !== null && employeeCount > 0 ? employeeCount : 52}
          subtitle={employeeCount !== null && employeeCount > 0 ? 'Live database records' : 'Active workforce on roster'}
          icon={<Users className="w-5 h-5 text-indigo-600" />}
          iconBgColor="bg-indigo-50"
          isDemoData={employeeCount === null || employeeCount === 0}
        />
        <SummaryCard
          title="Present Today"
          value={46}
          subtitle="88.5% office attendance"
          icon={<UserCheck className="w-5 h-5 text-emerald-600" />}
          iconBgColor="bg-emerald-50"
          isDemoData={true}
        />
        <SummaryCard
          title="Absent Today"
          value={4}
          subtitle="2 on approved annual leave"
          icon={<UserX className="w-5 h-5 text-rose-600" />}
          iconBgColor="bg-rose-50"
          isDemoData={true}
        />
        <SummaryCard
          title="Pending Leaves"
          value={2}
          subtitle="Requires supervisor review"
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          iconBgColor="bg-amber-50"
          isDemoData={true}
        />
      </div>

      {/* Analytics & System Health Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AttendanceChart />
        </div>

        {/* Live Infrastructure State */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-600" />
                Backend Telemetry
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">FastAPI</span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-slate-400" /> PostgreSQL 18
                </span>
                <span
                  className={`font-semibold ${
                    health.databaseConnected ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {health.databaseConnected ? 'Connected (Pool OK)' : 'Unavailable'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50">
                <span className="text-slate-500">API Endpoint</span>
                <span className="font-mono text-[11px] text-slate-700">http://127.0.0.1:8000</span>
              </div>

              <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Alembic Schema</span>
                <span className="font-mono text-[11px] text-indigo-700 font-medium">Head (dd512940ae96)</span>
              </div>

              <div className="flex items-center justify-between text-xs py-1.5">
                <span className="text-slate-500">Health Latency</span>
                <span className="font-mono text-slate-700">
                  {health.latencyMs !== undefined ? `${health.latencyMs} ms` : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 text-slate-800 font-medium mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Production Foundation
            </div>
            <p className="text-[11px] text-slate-500">
              PostgreSQL connection pooling, Pydantic data validation, and Alembic migrations enabled.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Attendance Activity Table */}
      <RecentAttendanceTable
        records={attendanceRecords}
        isDemoData={isDemoData}
        onRefresh={fetchRecords}
        isLoading={isLoading}
      />
    </div>
  );
};
