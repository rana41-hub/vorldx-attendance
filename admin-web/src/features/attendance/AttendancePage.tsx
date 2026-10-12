import { useEffect, useState } from 'react';
import { CalendarCheck, QrCode, RefreshCw, AlertCircle, CheckCircle2, UserCheck, LogOut } from 'lucide-react';
import { api, ApiError } from '../../services/api';
import type { AttendanceRecord, Employee } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';

export const AttendancePage: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Test Console
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [attData, empData] = await Promise.all([
        api.getAttendance(),
        api.getEmployees(),
      ]);
      setEmployees(empData);

      const empMap = new Map(empData.map((e) => [e.id, e]));
      const enriched = attData.map((r) => {
        const emp = empMap.get(r.employee_id);
        return {
          ...r,
          employee_name: emp ? emp.full_name : `Employee #${r.employee_id}`,
          employee_code: emp ? emp.employee_code : `EMP-${r.employee_id}`,
          department: emp ? emp.department : 'General',
        };
      });
      setRecords(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching attendance data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSimulateCheckIn = async () => {
    if (!selectedEmployeeId) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const rec = await api.recordCheckIn(Number(selectedEmployeeId), 'OFFICE_QR');
      setSuccess(`Check-in logged for Employee #${rec.employee_id} via OFFICE_QR.`);
      loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Check-in failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateCheckOut = async () => {
    if (!selectedEmployeeId) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const rec = await api.recordCheckOut(Number(selectedEmployeeId));
      setSuccess(`Check-out recorded for Employee #${rec.employee_id}.`);
      loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Check-out failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Attendance Console
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit office presence records, monitor QR check-ins, and inspect timestamps
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Records
        </button>
      </div>

      {/* Action Messages */}
      {success && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="font-bold">×</button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Simulator / Testing Panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <QrCode className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            QR Check-In Simulator (Day 1 Test Console)
          </h3>
        </div>
        <p className="text-xs text-slate-500 mt-2 mb-4">
          Test real-time check-in and check-out database persistence for registered employees.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value ? Number(e.target.value) : '')}
            className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="">Select Employee to Test...</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employee_code} — {emp.full_name} ({emp.department})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleSimulateCheckIn}
              disabled={!selectedEmployeeId || actionLoading}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Check In
            </button>
            <button
              onClick={handleSimulateCheckOut}
              disabled={!selectedEmployeeId || actionLoading}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 disabled:opacity-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Check Out
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Logs Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5 font-medium">Record ID</th>
                <th className="px-5 py-3.5 font-medium">Employee</th>
                <th className="px-5 py-3.5 font-medium">Date</th>
                <th className="px-5 py-3.5 font-medium">Check-In</th>
                <th className="px-5 py-3.5 font-medium">Check-Out</th>
                <th className="px-5 py-3.5 font-medium">Source</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-700">No attendance records in database</p>
                    <p className="text-xs text-slate-400">Use the test console above to log a check-in.</p>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">#{r.id}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900">{r.employee_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{r.employee_code}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700">{r.attendance_date}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-700 font-medium">
                      {new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {r.check_out
                        ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono text-slate-500">{r.source || 'OFFICE_QR'}</td>
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
