import { useEffect, useState, useMemo } from 'react';
import {
  CalendarCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  UserCheck,
  LogOut,
  Edit3,
  History,
  Shield,
  X,
  FileText,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import type { AttendanceRecord, Employee, AuditLog } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';

export const AttendancePage: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');
  const [filterError, setFilterError] = useState<string | null>(null);

  // Simulation Console
  const [simEmployeeId, setSimEmployeeId] = useState<number | ''>('');
  const [simSource, setSimSource] = useState<string>('OFFICE_QR');
  const [simLoading, setSimLoading] = useState(false);

  // Correction Modal State
  const [correctingRecord, setCorrectingRecord] = useState<AttendanceRecord | null>(null);
  const [corrCheckIn, setCorrCheckIn] = useState<string>('');
  const [corrCheckOut, setCorrCheckOut] = useState<string>('');
  const [corrStatus, setCorrStatus] = useState<'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT'>('PRESENT');
  const [corrReason, setCorrReason] = useState<string>('');
  const [corrSubmitting, setCorrSubmitting] = useState(false);
  const [corrError, setCorrError] = useState<string | null>(null);
  const [corrConfirmed, setCorrConfirmed] = useState(false);

  // Audit Logs Modal State
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditTargetRecord, setAuditTargetRecord] = useState<AttendanceRecord | null>(null);

  const loadData = async () => {
    // Validate date range
    if (filterStartDate && filterEndDate && filterStartDate > filterEndDate) {
      setFilterError('Start date cannot be after end date.');
      return;
    }
    setFilterError(null);
    setIsLoading(true);
    setError(null);

    try {
      const [attData, empData] = await Promise.all([
        api.getAttendance({
          date: filterDate || undefined,
          startDate: filterStartDate || undefined,
          endDate: filterEndDate || undefined,
          employeeId: filterEmployeeId ? Number(filterEmployeeId) : undefined,
          status: filterStatus !== 'ALL' ? filterStatus : undefined,
        }),
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
  }, [filterDate, filterStartDate, filterEndDate, filterEmployeeId, filterStatus]);

  const handleResetFilters = () => {
    setFilterDate('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterStatus('ALL');
    setFilterEmployeeId('');
    setFilterError(null);
  };

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
      return new Date(isoString).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return isoString;
    }
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
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

  // Convert ISO string to "YYYY-MM-DDTHH:mm" for datetime-local input
  const toLocalInput = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      // Offset to local input format
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const openCorrectionModal = (record: AttendanceRecord) => {
    setCorrectingRecord(record);
    setCorrCheckIn(toLocalInput(record.check_in));
    setCorrCheckOut(toLocalInput(record.check_out));
    setCorrStatus(record.status);
    setCorrReason('');
    setCorrError(null);
    setCorrConfirmed(false);
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord) return;

    const trimmedReason = corrReason.trim();
    if (trimmedReason.length < 3) {
      setCorrError('Correction reason must contain at least 3 non-whitespace characters.');
      return;
    }

    if (corrCheckIn && corrCheckOut) {
      if (new Date(corrCheckOut).getTime() < new Date(corrCheckIn).getTime()) {
        setCorrError('Check-out time cannot be earlier than check-in time.');
        return;
      }
    }

    if (!corrConfirmed) {
      setCorrConfirmed(true);
      return;
    }

    setCorrSubmitting(true);
    setCorrError(null);

    try {
      await api.correctAttendance(correctingRecord.id, {
        check_in: corrCheckIn ? new Date(corrCheckIn).toISOString() : undefined,
        check_out: corrCheckOut ? new Date(corrCheckOut).toISOString() : undefined,
        status: corrStatus,
        reason: trimmedReason,
      });

      setSuccess(`Attendance record #${correctingRecord.id} successfully corrected and audit trail logged.`);
      setCorrectingRecord(null);
      loadData();
    } catch (err) {
      setCorrError(err instanceof ApiError ? err.message : 'Failed to apply attendance correction.');
      setCorrConfirmed(false);
    } finally {
      setCorrSubmitting(false);
    }
  };

  const openAuditModal = async (target?: AttendanceRecord) => {
    setAuditTargetRecord(target || null);
    setAuditModalOpen(true);
    setAuditLoading(true);
    try {
      const logs = await api.getAttendanceAuditLogs(
        target ? { attendanceRecordId: target.id } : { limit: 50 }
      );
      setAuditLogs(logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve audit trail.');
    } finally {
      setAuditLoading(false);
    }
  };

  const hasActiveFilters = useMemo(() => {
    return Boolean(filterDate || filterStartDate || filterEndDate || filterStatus !== 'ALL' || filterEmployeeId);
  }, [filterDate, filterStartDate, filterEndDate, filterStatus, filterEmployeeId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Attendance Records & Console
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit office check-ins, punctuality timestamps, shift durations, and administrative corrections
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => openAuditModal()}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="font-bold hover:text-emerald-950">×</button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold hover:text-rose-950">×</button>
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

      {/* Multi-Dimensional Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-800">Database Attendance Filters:</span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear All Filters</span>
            </button>
          )}
        </div>

        {filterError && (
          <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{filterError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {/* Specific Date */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Exact Date
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                if (e.target.value) {
                  setFilterStartDate('');
                  setFilterEndDate('');
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Date Range Start & End */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => {
                  setFilterStartDate(e.target.value);
                  if (e.target.value) setFilterDate('');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => {
                  setFilterEndDate(e.target.value);
                  if (e.target.value) setFilterDate('');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Employee Filter */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Personnel
            </label>
            <select
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">All Personnel</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name} ({e.employee_code})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Attendance Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">PRESENT</option>
              <option value="LATE">LATE</option>
              <option value="HALF_DAY">HALF_DAY</option>
              <option value="ABSENT">ABSENT</option>
            </select>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
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
                <th className="px-5 py-3.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-700">No attendance records found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try clearing or adjusting filters, or check in an employee using the console.
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      <div>
                        <div className="flex items-center gap-2">
                          <span>{r.employee_name}</span>
                          {r.is_corrected && (
                            <span
                              title={`Admin corrected on ${formatDateTime(r.corrected_at)}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                            >
                              <Shield className="w-2.5 h-2.5 text-amber-600" />
                              <span>Corrected</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                          <span>{r.employee_code}</span>
                          <span>•</span>
                          <span className="font-sans text-slate-500">{r.department}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700 font-medium">{r.attendance_date}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-800">{formatTime(r.check_in)}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-800">{formatTime(r.check_out)}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 font-medium">
                      {r.hours_worked !== undefined && r.hours_worked !== null
                        ? `${r.hours_worked.toFixed(1)} hrs`
                        : calculateHours(r.check_in, r.check_out)}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 font-mono text-[10px] text-slate-600">
                        {r.source || 'OFFICE_QR'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge
                        status={
                          r.session_state === 'INCOMPLETE' || (r.check_out && r.status === 'HALF_DAY')
                            ? 'INCOMPLETE'
                            : !r.check_out || r.session_state === 'IN_PROGRESS'
                            ? 'IN_PROGRESS'
                            : r.status
                        }
                        size="sm"
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openCorrectionModal(r)}
                          title="Correct attendance record"
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                        </button>
                        <button
                          onClick={() => openAuditModal(r)}
                          title="View record audit trail"
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                        >
                          <History className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Correction Modal */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Authorized Attendance Correction
                </h3>
              </div>
              <button
                onClick={() => setCorrectingRecord(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <div className="text-xs font-bold text-slate-800">
                  {correctingRecord.employee_name} ({correctingRecord.employee_code})
                </div>
                <div className="text-[11px] text-slate-500">
                  Date: <span className="font-semibold text-slate-700">{correctingRecord.attendance_date}</span> • Current Status:{' '}
                  <span className="font-semibold text-slate-700">{correctingRecord.status}</span>
                </div>
              </div>

              {corrError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{corrError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Check-In Time
                  </label>
                  <input
                    type="datetime-local"
                    value={corrCheckIn}
                    onChange={(e) => {
                      setCorrCheckIn(e.target.value);
                      setCorrConfirmed(false);
                    }}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Check-Out Time
                  </label>
                  <input
                    type="datetime-local"
                    value={corrCheckOut}
                    onChange={(e) => {
                      setCorrCheckOut(e.target.value);
                      setCorrConfirmed(false);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corrected Attendance Status
                </label>
                <select
                  value={corrStatus}
                  onChange={(e) => {
                    setCorrStatus(e.target.value as 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT');
                    setCorrConfirmed(false);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="PRESENT">PRESENT (Full Day Attendance)</option>
                  <option value="LATE">LATE (Punctuality Grace Exceeded)</option>
                  <option value="HALF_DAY">HALF_DAY (Partial Attendance)</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Mandatory Reason for Correction <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Min 3 characters</span>
                </div>
                <textarea
                  rows={3}
                  value={corrReason}
                  onChange={(e) => {
                    setCorrReason(e.target.value);
                    setCorrConfirmed(false);
                  }}
                  placeholder="Explain why this administrative correction is warranted (e.g., biometric hardware failure, verified manager slip)..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              {corrConfirmed && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs">
                  <p className="font-bold flex items-center gap-1.5 mb-1">
                    <Shield className="w-3.5 h-3.5 text-amber-600" />
                    Confirm Administrative Correction
                  </p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    This modification will be permanently logged in PostgreSQL under your Admin identity with previous and updated state snapshots. Click submit again to proceed.
                  </p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCorrectingRecord(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={corrSubmitting}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors ${
                    corrConfirmed
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  } disabled:opacity-50`}
                >
                  {corrSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{corrConfirmed ? 'Confirm & Persist Change' : 'Review & Submit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Logs Modal */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {auditTargetRecord
                    ? `Audit History for Record #${auditTargetRecord.id} (${auditTargetRecord.employee_name})`
                    : 'System Administrative Audit Logs'}
                </h3>
              </div>
              <button
                onClick={() => setAuditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {auditLoading ? (
                <div className="py-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                  <p className="text-xs">Loading audit trail...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">No audit events logged</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Corrections and policy updates will produce persistent audit records here.
                  </p>
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5 text-xs shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {log.action_type}
                        </span>
                        <span className="font-semibold text-slate-800">
                          by {log.admin_name || `Admin #${log.admin_id}`}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-600">Reason:</div>
                      <p className="text-xs text-slate-800 italic bg-white p-2 rounded-lg border border-slate-100">
                        "{log.reason}"
                      </p>
                    </div>

                    {log.previous_values && log.updated_values && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="p-2 rounded-lg bg-rose-50/50 border border-rose-100">
                          <div className="text-[10px] font-bold uppercase text-rose-700 mb-1">
                            Previous Values
                          </div>
                          <pre className="text-[10px] text-slate-600 font-mono overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(log.previous_values, null, 2)}
                          </pre>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50/50 border border-emerald-100">
                          <div className="text-[10px] font-bold uppercase text-emerald-700 mb-1">
                            Updated Values
                          </div>
                          <pre className="text-[10px] text-slate-600 font-mono overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(log.updated_values, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setAuditModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
