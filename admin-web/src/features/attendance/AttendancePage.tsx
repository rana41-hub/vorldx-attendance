import { useEffect, useState, useMemo } from 'react';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
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

  const hasActiveFilters = useMemo(() => {
    return !!(filterDate || filterStartDate || filterEndDate || filterEmployeeId || filterStatus !== 'ALL');
  }, [filterDate, filterStartDate, filterEndDate, filterEmployeeId, filterStatus]);

  // Open Correction Modal
  const handleOpenCorrection = (record: AttendanceRecord) => {
    setCorrectingRecord(record);
    setCorrError(null);
    setCorrConfirmed(false);
    setCorrReason('');
    setCorrStatus(
      ['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT'].includes(record.status)
        ? (record.status as 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT')
        : 'PRESENT'
    );

    // Convert ISO to datetime-local input format (YYYY-MM-DDTHH:mm)
    const toInputVal = (isoStr?: string | null) => {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setCorrCheckIn(toInputVal(record.check_in));
    setCorrCheckOut(toInputVal(record.check_out));
  };

  // Submit Correction with 2-step confirmation
  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord) return;

    if (corrReason.trim().length < 3) {
      setCorrError('Mandatory reason for administrative correction must be at least 3 characters.');
      return;
    }

    if (corrCheckIn && corrCheckOut && new Date(corrCheckIn) > new Date(corrCheckOut)) {
      setCorrError('Check-in time cannot be after check-out time.');
      return;
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
        reason: corrReason.trim(),
      });

      setSuccess(`Attendance record #${correctingRecord.id} successfully corrected and audited in database.`);
      setCorrectingRecord(null);
      loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        setCorrError(err.message);
      } else if (err instanceof Error) {
        setCorrError(err.message);
      } else {
        setCorrError('Correction failed due to server error.');
      }
    } finally {
      setCorrSubmitting(false);
    }
  };

  // Open Audit Trail Modal
  const handleOpenAuditModal = async (record?: AttendanceRecord) => {
    setAuditTargetRecord(record || null);
    setAuditModalOpen(true);
    setAuditLoading(true);

    try {
      const logs = await api.getAttendanceAuditLogs({
        actionType: 'ATTENDANCE_CORRECTION',
        attendanceRecordId: record ? record.id : undefined,
      });
      setAuditLogs(logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve audit trail.');
    } finally {
      setAuditLoading(false);
    }
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return iso;
    }
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return iso;
    }
  };

  const formatDuration = (hours?: number | null) => {
    if (hours === undefined || hours === null) return '—';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#EAF2FF]">
            Attendance Telemetry & Daily Records
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-0.5">
            Verified check-in/out logs, authorized manual corrections, and immutable audit trails
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAuditModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] rounded-xl text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] hover:bg-slate-50 dark:hover:bg-[#10213D] shadow-xs transition-colors"
          >
            <History className="w-3.5 h-3.5 text-indigo-600 dark:text-[#22D3EE]" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] rounded-xl text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] hover:bg-slate-50 dark:hover:bg-[#10213D] disabled:opacity-50 shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-[#34D399] text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#34D399] shrink-0" />
            <span className="font-medium">{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="font-bold hover:opacity-75 text-base">×</button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-[#FB7185] text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-[#FB7185] shrink-0" />
            <span className="leading-relaxed font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold hover:opacity-75 text-base">×</button>
        </div>
      )}

      {/* Multi-Dimensional Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-4 shadow-xs dark:shadow-[0_4px_20px_-2px_rgba(5,11,24,0.7)] space-y-3 transition-colors duration-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 dark:text-[#22D3EE]" />
            <span className="text-xs font-bold text-slate-800 dark:text-[#EAF2FF]">Database Attendance Filters:</span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 dark:text-[#22D3EE] dark:hover:text-cyan-300 font-semibold"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear All Filters</span>
            </button>
          )}
        </div>

        {filterError && (
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-[#FB7185] text-[11px] flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium">{filterError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {/* Specific Date */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#7E93B5] mb-1">
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
              className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
            />
          </div>

          {/* Date Range Start & End */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#7E93B5] mb-1">
                From Date
              </label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => {
                  setFilterStartDate(e.target.value);
                  if (e.target.value) setFilterDate('');
                }}
                className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-2 py-1.5 text-xs text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#7E93B5] mb-1">
                To Date
              </label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => {
                  setFilterEndDate(e.target.value);
                  if (e.target.value) setFilterDate('');
                }}
                className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-2 py-1.5 text-xs text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
              />
            </div>
          </div>

          {/* Employee Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#7E93B5] mb-1">
              Personnel
            </label>
            <select
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
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
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#7E93B5] mb-1">
              Attendance Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
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
      <div className="rounded-2xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] shadow-xs dark:shadow-[0_4px_20px_-2px_rgba(5,11,24,0.7)] overflow-hidden transition-all duration-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-[#A9BCD8]">
            <thead className="bg-slate-50/75 dark:bg-[#081426] text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#7E93B5] border-b border-slate-100 dark:border-[#203653]">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Check-In</th>
                <th className="px-5 py-3.5">Check-Out</th>
                <th className="px-5 py-3.5">Duration</th>
                <th className="px-5 py-3.5">Source</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#203653]/60">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500 dark:text-[#7E93B5]">
                    <Clock className="w-8 h-8 text-slate-300 dark:text-[#203653] mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-[#EAF2FF]">No attendance records found</p>
                    <p className="text-xs text-slate-400 dark:text-[#7E93B5] mt-1">
                      Try clearing or adjusting filters, or check in an employee via the kiosk.
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-[#10213D]/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-[#EAF2FF]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{r.employee_name}</span>
                          {r.is_corrected && (
                            <span
                              title={`Admin corrected on ${formatDateTime(r.corrected_at)}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-[#FBBF24] border border-amber-200 dark:border-amber-500/30"
                            >
                              <Shield className="w-2.5 h-2.5 text-amber-600 dark:text-[#FBBF24]" />
                              <span>Corrected</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 dark:text-[#7E93B5]">
                          <span>{r.employee_code}</span>
                          <span>•</span>
                          <span className="font-sans text-slate-500 dark:text-[#A9BCD8]">{r.department}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-600 dark:text-[#A9BCD8]">
                      {r.attendance_date}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold text-slate-700 dark:text-[#EAF2FF]">
                      {formatTime(r.check_in)}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-slate-500 dark:text-[#7E93B5]">
                      {formatTime(r.check_out)}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono font-medium text-slate-600 dark:text-[#A9BCD8]">
                      {formatDuration(r.hours_worked)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#10213D] text-[11px] font-mono font-semibold text-slate-600 dark:text-[#22D3EE] border border-slate-200/60 dark:border-[#164E63]">
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
                    <td className="px-5 py-3.5 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenCorrection(r)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-[#7E93B5] dark:hover:text-[#22D3EE] dark:hover:bg-[#10213D] rounded-lg transition-colors"
                        title="Authorized administrative correction"
                        aria-label="Correct attendance record"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenAuditModal(r)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:text-[#7E93B5] dark:hover:text-[#3B82F6] dark:hover:bg-[#10213D] rounded-lg transition-colors"
                        title="View record audit logs"
                        aria-label="View record audit logs"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Authorized Correction Modal */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-[#050B18]/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0C1930] rounded-2xl border border-slate-200 dark:border-[#203653] shadow-2xl max-w-lg w-full p-6 transition-all duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#203653]/70 mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600 dark:text-[#22D3EE]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-[#EAF2FF]">
                  Authorized Administrative Correction
                </h3>
              </div>
              <button
                onClick={() => setCorrectingRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-[#EAF2FF] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-[#A9BCD8] mb-4">
              Correcting attendance for <strong className="text-slate-800 dark:text-[#EAF2FF]">{correctingRecord.employee_name}</strong> on{' '}
              <span className="font-mono font-semibold text-indigo-600 dark:text-[#22D3EE]">{correctingRecord.attendance_date}</span>.
            </p>

            {corrError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-[#FB7185] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">{corrError}</span>
              </div>
            )}

            <form onSubmit={handleCorrectionSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                    Check-In Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={corrCheckIn}
                    onChange={(e) => {
                      setCorrCheckIn(e.target.value);
                      setCorrConfirmed(false);
                    }}
                    required
                    className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                    Check-Out Time
                  </label>
                  <input
                    type="datetime-local"
                    value={corrCheckOut}
                    onChange={(e) => {
                      setCorrCheckOut(e.target.value);
                      setCorrConfirmed(false);
                    }}
                    className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                  Corrected Attendance Status
                </label>
                <select
                  value={corrStatus}
                  onChange={(e) => {
                    setCorrStatus(e.target.value as 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT');
                    setCorrConfirmed(false);
                  }}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
                >
                  <option value="PRESENT">PRESENT (Full Day Attendance)</option>
                  <option value="LATE">LATE (Punctuality Grace Exceeded)</option>
                  <option value="HALF_DAY">HALF_DAY (Partial Attendance)</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#A9BCD8]">
                    Mandatory Reason for Correction <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 dark:text-[#7E93B5]">Min 3 characters</span>
                </div>
                <textarea
                  rows={3}
                  value={corrReason}
                  onChange={(e) => {
                    setCorrReason(e.target.value);
                    setCorrConfirmed(false);
                  }}
                  placeholder="Explain why this administrative correction is warranted (e.g., biometric hardware failure, verified manager slip)..."
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl p-2.5 text-xs text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
                  required
                />
              </div>

              {corrConfirmed && (
                <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-[#FBBF24] text-xs">
                  <p className="font-bold flex items-center gap-1.5 mb-1">
                    <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-[#FBBF24]" />
                    Confirm Administrative Correction
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-[#FBBF24]/90 leading-relaxed">
                    This modification will be permanently logged in PostgreSQL under your Admin identity with previous and updated state snapshots. Click submit again to proceed.
                  </p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-[#203653]/70">
                <button
                  type="button"
                  onClick={() => setCorrectingRecord(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-[#203653] rounded-xl text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] hover:bg-slate-50 dark:hover:bg-[#10213D] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={corrSubmitting}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all ${
                    corrConfirmed
                      ? 'bg-amber-600 hover:bg-amber-700 dark:bg-[#FBBF24] dark:hover:bg-amber-400 dark:text-slate-950'
                      : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-[#3B82F6] dark:hover:bg-blue-500 dark:shadow-[0_0_15px_-3px_rgba(59,130,246,0.4)]'
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-[#050B18]/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0C1930] rounded-2xl border border-slate-200 dark:border-[#203653] shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden transition-all duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-[#203653]/70 flex items-center justify-between bg-slate-50/50 dark:bg-[#081426]">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600 dark:text-[#22D3EE]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#EAF2FF]">
                  {auditTargetRecord
                    ? `Audit History for Record #${auditTargetRecord.id} (${auditTargetRecord.employee_name})`
                    : 'System Administrative Audit Logs'}
                </h3>
              </div>
              <button
                onClick={() => setAuditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-[#EAF2FF] p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {auditLoading ? (
                <div className="py-12 text-center text-slate-500 dark:text-[#7E93B5]">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 dark:text-[#3B82F6] mb-2" />
                  <p className="text-xs font-medium">Loading audit trail...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 dark:text-[#7E93B5]">
                  <FileText className="w-8 h-8 text-slate-300 dark:text-[#203653] mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-[#EAF2FF]">No audit events logged</p>
                  <p className="text-xs text-slate-400 dark:text-[#7E93B5] mt-1">
                    Corrections and policy updates will produce persistent audit records here.
                  </p>
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-[#203653] bg-slate-50/50 dark:bg-[#10213D] space-y-2.5 text-xs shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-[#203653]/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-[#22D3EE] border border-indigo-200 dark:border-[#22D3EE]/30">
                          {log.action_type}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-[#EAF2FF]">
                          by {log.admin_name || `Admin #${log.admin_id}`}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-[#7E93B5] font-mono">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-[#A9BCD8]">Reason:</div>
                      <p className="text-xs text-slate-800 dark:text-[#EAF2FF] italic bg-white dark:bg-[#081426] p-2.5 rounded-xl border border-slate-100 dark:border-[#203653]">
                        "{log.reason}"
                      </p>
                    </div>

                    {log.previous_values && log.updated_values && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20">
                          <div className="text-[10px] font-bold uppercase text-rose-700 dark:text-[#FB7185] mb-1">
                            Previous Values
                          </div>
                          <pre className="text-[10px] text-slate-600 dark:text-[#A9BCD8] font-mono overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(log.previous_values, null, 2)}
                          </pre>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                          <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-[#34D399] mb-1">
                            Updated Values
                          </div>
                          <pre className="text-[10px] text-slate-600 dark:text-[#A9BCD8] font-mono overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(log.updated_values, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 dark:border-[#203653]/70 bg-slate-50/50 dark:bg-[#081426] flex justify-end">
              <button
                onClick={() => setAuditModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-[#203653] rounded-xl text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] hover:bg-slate-100 dark:hover:bg-[#10213D] transition-colors"
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
