import { useEffect, useState } from 'react';
import {
  CalendarCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  UserCheck,
  LogOut,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import type { AttendanceRecord, Employee } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';

export const AttendancePage: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');

  // Simulation Console
  const [simEmployeeId, setSimEmployeeId] = useState<number | ''>('');
  const [simSource, setSimSource] = useState<string>('OFFICE_QR');
  const [simLoading, setSimLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [attData, empData] = await Promise.all([
        api.getAttendance(
          filterDate || undefined,
          filterEmployeeId ? Number(filterEmployeeId) : undefined
        ),
        api.getEmployees(),
      ]);
      setEmployees(empData);

      const empMap = new Map(empData.map((e) => [e.id, e]));
      const enriched = attData.map((r) => {
        const emp = empMap.get(r.employee_id);
        return {
          ...r,
          employee_name: emp ? emp.full_name : `Employee #${r.employee_id}`,
          employee_code: emp ? emp.employee_code : `VX-${r.employee_id}`,
          department: emp ? emp.department : 'General',
        };
      });
      setRecords(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching attendance records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDate, filterEmployeeId]);

  const handleSimulateCheckIn = async () => {
    if (!simEmployeeId) return;
    setSimLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const rec = await api.recordCheckIn(Number(simEmployeeId), simSource);
      setSuccess(
        `Check-in recorded for Employee #${rec.employee_id} (Status: ${rec.status}).`
      );
      loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Check-in failed.');
    } finally {
      setSimLoading(false);
    }
  };

  const handleSimulateCheckOut = async () => {
    if (!simEmployeeId) return;
    setSimLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const rec = await api.recordCheckOut(Number(simEmployeeId));
      setSuccess(
        `Check-out recorded for Employee #${rec.employee_id} (Status: ${rec.status}).`
      );
      loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Check-out failed.');
    } finally {
      setSimLoading(false);
    }
  };

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const calculateHours = (inTime: string, outTime?: string | null) => {
    if (!outTime) return 'Active';
    try {
      const start = new Date(inTime).getTime();
      const end = new Date(outTime).getTime();
      const diffHrs = (end - start) / (1000 * 3600);
      return `${Math.max(0, diffHrs).toFixed(1)} hrs`;
    } catch {
      return '—';
    }
  };

  const filteredRecords = records.filter((r) => {
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Attendance Records & Console
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit office check-ins, punctuality timestamps, and shift durations
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="font-bold">×</button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Admin Test / Verification Console */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <CalendarCheck className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-900">
            Administrative Check-In / Check-Out Console
          </h3>
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Simulate or record an employee presence event using the backend verification endpoints.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={simEmployeeId}
            onChange={(e) => setSimEmployeeId(e.target.value ? Number(e.target.value) : '')}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 min-w-[200px]"
          >
            <option value="">Select Employee...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} ({e.employee_code})
              </option>
            ))}
          </select>

          <select
            value={simSource}
            onChange={(e) => setSimSource(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
          >
            <option value="OFFICE_QR">Source: OFFICE_QR</option>
            <option value="MANUAL">Source: MANUAL</option>
            <option value="REMOTE">Source: REMOTE</option>
          </select>

          <button
            onClick={handleSimulateCheckIn}
            disabled={!simEmployeeId || simLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Record Check-In</span>
          </button>

          <button
            onClick={handleSimulateCheckOut}
            disabled={!simEmployeeId || simLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Record Check-Out</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">Filters:</span>
        </div>

        <div>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PRESENT">PRESENT</option>
            <option value="LATE">LATE</option>
            <option value="HALF_DAY">HALF_DAY</option>
            <option value="ABSENT">ABSENT</option>
          </select>
        </div>

        <div>
          <select
            value={filterEmployeeId}
            onChange={(e) => setFilterEmployeeId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="">All Personnel</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} ({e.employee_code})
              </option>
            ))}
          </select>
        </div>

        {(filterDate || filterStatus !== 'ALL' || filterEmployeeId) && (
          <button
            onClick={() => {
              setFilterDate('');
              setFilterStatus('ALL');
              setFilterEmployeeId('');
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5 font-medium">Employee</th>
                <th className="px-5 py-3.5 font-medium">Date</th>
                <th className="px-5 py-3.5 font-medium">Check-In</th>
                <th className="px-5 py-3.5 font-medium">Check-Out</th>
                <th className="px-5 py-3.5 font-medium">Duration</th>
                <th className="px-5 py-3.5 font-medium">Source</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-700">No attendance records found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try clearing filters or check in an employee using the console above.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      <div>
                        <div>{r.employee_name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{r.employee_code}</div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700">{r.attendance_date}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-800">{formatTime(r.check_in)}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-800">{formatTime(r.check_out)}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 font-medium">
                      {calculateHours(r.check_in, r.check_out)}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 font-mono text-[10px] text-slate-600">
                        {r.source || 'OFFICE_QR'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={r.status} size="sm" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
