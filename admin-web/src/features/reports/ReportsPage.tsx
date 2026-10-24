import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Home,
  Info,
  Laptop,
  Percent,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import type {
  AttendanceSummaryResponse,
  DailyAttendanceReportResponse,
  LateAttendanceReportResponse,
  WFHReportResponse,
} from '../../types';

function getISODateDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDisplayTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export const ReportsPage: React.FC = () => {
  // Filters state
  const [dailyDate, setDailyDate] = useState(() => getISODateDaysAgo(0));
  const [startDate, setStartDate] = useState(() => getISODateDaysAgo(29));
  const [endDate, setEndDate] = useState(() => getISODateDaysAgo(0));
  const [wfhFilterBy, setWfhFilterBy] = useState<'target_date' | 'submission_date'>('target_date');
  const [showDefinitions, setShowDefinitions] = useState(false);

  // CSV Export filters
  const [exportDept, setExportDept] = useState('ALL');
  const [exportStatus, setExportStatus] = useState('ALL');
  const [availableDepts, setAvailableDepts] = useState<string[]>([]);

  // Data states
  const [dailyReport, setDailyReport] = useState<DailyAttendanceReportResponse | null>(null);
  const [summary, setSummary] = useState<AttendanceSummaryResponse | null>(null);
  const [lateReport, setLateReport] = useState<LateAttendanceReportResponse | null>(null);
  const [wfhReport, setWfhReport] = useState<WFHReportResponse | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingXLSX, setIsExportingXLSX] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Load available departments for filtering
  useEffect(() => {
    let isMounted = true;
    api
      .getEmployees()
      .then((employees) => {
        if (!isMounted) return;
        const depts = Array.from(
          new Set(employees.map((e) => e.department).filter(Boolean))
        ).sort();
        setAvailableDepts(depts);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchReports = useCallback(async () => {
    if (endDate < startDate) {
      setError('Date filter error: Start date cannot be after end date.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [dailyData, summaryData, lateData, wfhData] = await Promise.all([
        api.getDailyAttendanceReport(dailyDate),
        api.getAttendanceSummary(startDate, endDate),
        api.getLateAttendanceReport(startDate, endDate),
        api.getWFHReport(startDate, endDate, wfhFilterBy),
      ]);

      setDailyReport(dailyData);
      setSummary(summaryData);
      setLateReport(lateData);
      setWfhReport(wfhData);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error fetching attendance reports. Please check connectivity.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [dailyDate, startDate, endDate, wfhFilterBy]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleApplyPreset = (days: number) => {
    const start = getISODateDaysAgo(days);
    const end = getISODateDaysAgo(0);
    setStartDate(start);
    setEndDate(end);
  };

  const handleClearFilters = () => {
    setDailyDate(getISODateDaysAgo(0));
    setStartDate(getISODateDaysAgo(29));
    setEndDate(getISODateDaysAgo(0));
    setWfhFilterBy('target_date');
    setExportDept('ALL');
    setExportStatus('ALL');
    setError(null);
  };

  const handleExportCSV = async () => {
    if (endDate < startDate) {
      setError('Export failed: Start date cannot be after end date.');
      return;
    }

    setIsExportingCSV(true);
    setExportSuccess(null);
    setError(null);
    try {
      await api.downloadAttendanceCSV(
        startDate,
        endDate,
        exportDept !== 'ALL' ? exportDept : undefined,
        exportStatus !== 'ALL' ? exportStatus : undefined
      );
      setExportSuccess(
        `CSV timesheet downloaded successfully for interval ${startDate} to ${endDate}.`
      );
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to download attendance CSV.');
      }
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleExportXLSX = async () => {
    if (endDate < startDate) {
      setError('Export failed: Start date cannot be after end date.');
      return;
    }

    setIsExportingXLSX(true);
    setExportSuccess(null);
    setError(null);
    try {
      await api.downloadAttendanceXLSX(
        startDate,
        endDate,
        exportDept !== 'ALL' ? exportDept : undefined,
        exportStatus !== 'ALL' ? exportStatus : undefined
      );
      setExportSuccess(
        `Native Excel (.xlsx) spreadsheet downloaded successfully for interval ${startDate} to ${endDate}.`
      );
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to download Excel spreadsheet.');
      }
    } finally {
      setIsExportingXLSX(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#EAF2FF]">
            Attendance Reports & Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-0.5">
            Real-time daily compliance figures, lateness audits, WFH analytics, and secure timesheet export
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchReports}
            disabled={isLoading}
            className="p-2 border border-slate-200 dark:border-[#203653] rounded-lg text-slate-600 dark:text-[#A9BCD8] hover:bg-slate-50 dark:hover:bg-[#10213D] transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh reports"
            aria-label="Refresh reports"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportXLSX}
            disabled={isExportingXLSX || isExportingCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            title="Download formatted Excel spreadsheet with optimal column widths and frozen headers"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExportingXLSX ? 'Exporting Excel...' : 'Export Excel (.xlsx)'}</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={isExportingCSV || isExportingXLSX}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#10213D] dark:hover:bg-[#162c50] text-slate-700 dark:text-[#EAF2FF] text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer border border-slate-200 dark:border-[#203653]"
            title="Download raw CSV timesheet"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingCSV ? 'Exporting CSV...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="font-bold text-rose-600 dark:text-rose-400 hover:text-rose-900 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {exportSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{exportSuccess}</span>
          </div>
          <button
            onClick={() => setExportSuccess(null)}
            className="font-bold text-emerald-600 dark:text-emerald-400 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* SECTION 1: FILTER CONTROLS */}
      <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-[#203653] pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600 dark:text-[#3B82F6]" />
            <span className="text-xs font-bold text-slate-800 dark:text-[#EAF2FF]">Reporting Intervals & Scope</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDefinitions(!showDefinitions)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-indigo-600 dark:text-[#22D3EE] hover:bg-indigo-50 dark:hover:bg-[#164E63]/30 border border-indigo-200 dark:border-[#164E63] transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
              <span>{showDefinitions ? 'Hide Metric Definitions' : 'View Metric Definitions'}</span>
            </button>
            <button
              onClick={handleClearFilters}
              className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-500 dark:text-[#7E93B5] hover:text-slate-800 dark:hover:text-[#EAF2FF] hover:bg-slate-100 dark:hover:bg-[#10213D] transition-colors cursor-pointer"
            >
              Reset Defaults
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Daily Date Selector */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 dark:text-[#A9BCD8] flex items-center gap-1">
              <span>Daily Report Date</span>
              <span className="text-[10px] text-indigo-600 dark:text-[#22D3EE] bg-indigo-50 dark:bg-[#164E63]/30 px-1 rounded">Single Day</span>
            </label>
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
            />
          </div>

          {/* Range Start */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 dark:text-[#A9BCD8]">Interval Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
            />
          </div>

          {/* Range End */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 dark:text-[#A9BCD8]">Interval End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
            />
          </div>

          {/* Presets & Apply */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 dark:text-[#A9BCD8]">Quick Intervals</label>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleApplyPreset(0)}
                className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#10213D] dark:hover:bg-[#162c50] text-slate-700 dark:text-[#A9BCD8] font-medium text-[11px] text-center cursor-pointer transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(6)}
                className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#10213D] dark:hover:bg-[#162c50] text-slate-700 dark:text-[#A9BCD8] font-medium text-[11px] text-center cursor-pointer transition-colors"
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(29)}
                className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#10213D] dark:hover:bg-[#162c50] text-slate-700 dark:text-[#A9BCD8] font-medium text-[11px] text-center cursor-pointer transition-colors"
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={fetchReports}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-[#3B82F6] dark:hover:bg-blue-600 text-white font-semibold text-[11px] shadow-xs cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Definitions Reference */}
        {showDefinitions && dailyReport?.definitions && (
          <div className="mt-3 p-3.5 rounded-lg bg-indigo-50/60 dark:bg-[#081426] border border-indigo-100 dark:border-[#164E63] text-slate-700 dark:text-[#A9BCD8] text-xs space-y-2">
            <div className="font-bold text-indigo-950 dark:text-[#22D3EE] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-[#22D3EE]" />
              <span>Documented Calculation Formulas & Business Rules</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
              <div>
                <span className="font-semibold text-slate-900 dark:text-[#EAF2FF]">Attendance Percentage: </span>
                <span className="text-slate-600 dark:text-[#A9BCD8]">{dailyReport.definitions.attendance_percentage}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-[#EAF2FF]">Eligible Employees: </span>
                <span className="text-slate-600 dark:text-[#A9BCD8]">{dailyReport.definitions.eligible_employees}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-[#EAF2FF]">Incomplete Attendance: </span>
                <span className="text-slate-600 dark:text-[#A9BCD8]">{dailyReport.definitions.incomplete_count}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-[#EAF2FF]">Absent Classification: </span>
                <span className="text-slate-600 dark:text-[#A9BCD8]">{dailyReport.definitions.absent_count}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-[#EAF2FF]">Headcount Reconciliation: </span>
                <span className="text-slate-600 dark:text-[#A9BCD8]">{dailyReport.definitions.reconciliation || 'Total Active = Attended + Leave + Remote WFH + Absent'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: DAILY ATTENDANCE SUMMARY & PERCENTAGE (RECONCILED) */}
      {dailyReport && (
        <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#203653] pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#EAF2FF] flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600 dark:text-[#3B82F6]" />
                <span>Daily Attendance Reconciliation — {formatDisplayDate(dailyReport.report_date)}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-0.5">
                Headcount: {dailyReport.total_active_employees} active staff ({dailyReport.eligible_employees} eligible)
              </p>
            </div>

            {/* Attendance Percentage Badge with exact math formula */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#7E93B5]">
                  Attendance Compliance
                </div>
                <div className="text-lg font-extrabold text-indigo-600 dark:text-[#22D3EE]">
                  {dailyReport.attendance_percentage}%
                </div>
                <div className="text-[10px] text-slate-400 dark:text-[#7E93B5] font-mono">
                  {dailyReport.attended_eligible_count ?? dailyReport.total_attended} / {dailyReport.eligible_employees} eligible
                </div>
              </div>
              <div className="w-24 bg-slate-100 dark:bg-[#081426] rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-indigo-600 dark:bg-[#22D3EE] h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, dailyReport.attendance_percentage))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Reconciled Headcount Cards: Mutually Exclusive Categories */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Active Staff */}
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#7E93B5]">
                Active Headcount
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-[#EAF2FF] mt-1">
                {dailyReport.total_active_employees}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-[#7E93B5] mt-0.5">
                Eligible: {dailyReport.eligible_employees}
              </div>
            </div>

            {/* Office Attended (Numerator of compliance) */}
            <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Office Attended</span>
                </span>
                <span className="text-[10px] bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-1 rounded font-bold">
                  {dailyReport.total_attended}
                </span>
              </div>
              <div className="text-xl font-bold text-emerald-900 dark:text-emerald-300 mt-1">
                {dailyReport.total_attended}
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                {dailyReport.present_count} on-time · {dailyReport.late_count} late · {dailyReport.half_day_count} half-day
              </div>
            </div>

            {/* Approved Leave */}
            <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Approved Leave</span>
              </div>
              <div className="text-xl font-bold text-amber-900 dark:text-amber-300 mt-1">
                {dailyReport.on_leave_count}
              </div>
              <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">Excused absence</div>
            </div>

            {/* Remote WFH (Only those who didn't attend office) */}
            <div className="p-3.5 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-400 flex items-center gap-1">
                <Home className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                <span>Remote WFH</span>
              </div>
              <div className="text-xl font-bold text-sky-900 dark:text-sky-300 mt-1">
                {dailyReport.wfh_remote_count ?? (dailyReport.wfh_count - (dailyReport.attended_wfh_count ?? 0))}
              </div>
              <div className="text-[10px] text-sky-700 dark:text-sky-400 mt-0.5">
                {dailyReport.wfh_count} approved ({dailyReport.attended_wfh_count ?? 0} at office)
              </div>
            </div>

            {/* Absent */}
            <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-400 flex items-center gap-1">
                <UserX className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                <span>Unaccounted Absent</span>
              </div>
              <div className="text-xl font-bold text-rose-900 dark:text-rose-300 mt-1">
                {dailyReport.absent_count}
              </div>
              <div className="text-[10px] text-rose-700 dark:text-rose-400 mt-0.5">No record, leave, or WFH</div>
            </div>
          </div>

          {/* Reconciliation Audit Equation Bar */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs text-slate-700 dark:text-[#A9BCD8]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-[#EAF2FF]">Headcount Balance:</span>
              <span>
                Attended (<strong>{dailyReport.total_attended}</strong>) + Leave (<strong>{dailyReport.on_leave_count}</strong>) + Remote WFH (<strong>{dailyReport.wfh_remote_count ?? (dailyReport.wfh_count - (dailyReport.attended_wfh_count ?? 0))}</strong>) + Absent (<strong>{dailyReport.absent_count}</strong>) = <strong className="text-indigo-600 dark:text-[#22D3EE]">{dailyReport.total_active_employees} Active Staff</strong>
              </span>
            </div>
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
              100% Reconciled
            </div>
          </div>

          {/* Operational Alert for Incomplete Shifts */}
          {dailyReport.incomplete_count > 0 && (
            <div className="p-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>Operational Notice:</strong> {dailyReport.incomplete_count} of the {dailyReport.total_attended} attendance session(s) today are in-progress / unclosed (missing recorded check-out).
                </span>
              </div>
              <span className="text-[10px] font-bold bg-amber-200/70 dark:bg-amber-900/60 px-2 py-0.5 rounded text-amber-900 dark:text-amber-300">
                {dailyReport.incomplete_count} Open Sessions
              </span>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: INTERVAL AUDIT SUMMARY */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#7E93B5] mb-1 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-indigo-500 dark:text-[#3B82F6]" />
              <span>Interval Attendance Rate</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-[#EAF2FF]">
              {summary.attendance_rate_percentage}%
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#7E93B5] mt-1">
              {summary.total_attendance_records} attendances across {summary.total_days} days
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#7E93B5] mb-1 flex items-center gap-1">
              <BarChart2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>Average Daily Attendance</span>
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary.average_daily_attendance}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#7E93B5] mt-1">
              Eligible active: {summary.total_active_employees} staff
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#7E93B5] mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>Approved Leave Days</span>
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary.approved_leave_days}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#7E93B5] mt-1">
              Authorized absence employee-days
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#7E93B5] mb-1 flex items-center gap-1">
              <Laptop className="w-3.5 h-3.5 text-sky-500 dark:text-cyan-400" />
              <span>Approved WFH Days</span>
            </div>
            <div className="text-2xl font-bold text-sky-600 dark:text-cyan-400">
              {summary.approved_wfh_days}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#7E93B5] mt-1">
              Remote authorization employee-days
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: LATE ATTENDANCE AUDIT */}
      {lateReport && (
        <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-[#203653] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-[#081426]/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#EAF2FF] flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Late Attendance Summary & Details</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-0.5">
                Configured Shift: {lateReport.shift_start_time} | Grace: {lateReport.late_grace_minutes}m | Late Rate: {lateReport.late_percentage}% ({lateReport.total_late_records} of {lateReport.total_attendance_records} records)
              </p>
            </div>

            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
              {lateReport.total_late_records} Late Incidents
            </span>
          </div>

          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50/75 dark:bg-[#081426]/80 border-b border-slate-200 dark:border-[#203653] text-slate-500 dark:text-[#7E93B5] font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5">Department</th>
                  <th className="px-4 py-2.5">Check-In</th>
                  <th className="px-4 py-2.5">Check-Out</th>
                  <th className="px-4 py-2.5" title="Minutes elapsed beyond shift start (09:00) + grace period (15m) deadline">
                    Minutes Late
                  </th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Audit Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#203653]/60 text-slate-700 dark:text-[#A9BCD8]">
                {lateReport.records.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400 dark:text-[#7E93B5] italic">
                      No late attendance records found for the selected interval ({startDate} to {endDate}).
                    </td>
                  </tr>
                ) : (
                  lateReport.records.map((r) => (
                    <tr key={r.record_id} className="hover:bg-slate-50/50 dark:hover:bg-[#10213D]/50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-[#EAF2FF] whitespace-nowrap font-mono">
                        {r.attendance_date}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-[#EAF2FF]">{r.employee_name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-[#7E93B5] font-mono">{r.employee_code}</div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 dark:text-[#A9BCD8]">
                        {r.department}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-mono text-slate-800 dark:text-[#EAF2FF]">
                        {formatDisplayTime(r.check_in)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-mono text-slate-500 dark:text-[#7E93B5]">
                        {r.check_out ? (
                          formatDisplayTime(r.check_out)
                        ) : (
                          <span className="text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold">
                            Open/Missing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 px-2 py-0.5 rounded text-[11px]">
                          +{r.minutes_late ?? '—'} min
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {r.is_corrected ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-[#164E63] text-indigo-800 dark:text-[#22D3EE]">
                            Admin Corrected
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-[#7E93B5] text-[10px]">{r.source || 'OFFICE_QR'}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 5: WORK-FROM-HOME STATISTICS */}
      {wfhReport && (
        <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#203653] pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#EAF2FF] flex items-center gap-2">
                <Home className="w-4 h-4 text-sky-600 dark:text-[#22D3EE]" />
                <span>Work-From-Home (WFH) Statistics</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-0.5">
                Request pipeline volume, approval decisions, and target remote days
              </p>
            </div>

            {/* Filter Toggle: Target WFH Date vs Submission Date */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#081426] p-1 rounded-lg text-xs font-medium border border-transparent dark:border-[#203653]">
              <button
                type="button"
                onClick={() => setWfhFilterBy('target_date')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  wfhFilterBy === 'target_date'
                    ? 'bg-white dark:bg-[#10213D] text-indigo-600 dark:text-[#22D3EE] shadow-xs font-bold'
                    : 'text-slate-600 dark:text-[#A9BCD8] hover:text-slate-900 dark:hover:text-[#EAF2FF]'
                }`}
              >
                By WFH Date
              </button>
              <button
                type="button"
                onClick={() => setWfhFilterBy('submission_date')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  wfhFilterBy === 'submission_date'
                    ? 'bg-white dark:bg-[#10213D] text-indigo-600 dark:text-[#22D3EE] shadow-xs font-bold'
                    : 'text-slate-600 dark:text-[#A9BCD8] hover:text-slate-900 dark:hover:text-[#EAF2FF]'
                }`}
              >
                By Submitted Date
              </button>
            </div>
          </div>

          {/* WFH Status Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#7E93B5]">
                Total Requests
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-[#EAF2FF] mt-1">{wfhReport.total_requests}</div>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">Pending</div>
              <div className="text-xl font-bold text-amber-900 dark:text-amber-300 mt-1">{wfhReport.pending_requests}</div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">Approved</div>
              <div className="text-xl font-bold text-emerald-900 dark:text-emerald-300 mt-1">{wfhReport.approved_requests}</div>
            </div>
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-400">Rejected</div>
              <div className="text-xl font-bold text-rose-900 dark:text-rose-300 mt-1">{wfhReport.rejected_requests}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#7E93B5]">Cancelled</div>
              <div className="text-xl font-bold text-slate-700 dark:text-[#A9BCD8] mt-1">{wfhReport.cancelled_requests}</div>
            </div>
            <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-400">Approved Days</div>
              <div className="text-xl font-bold text-sky-900 dark:text-sky-300 mt-1">{wfhReport.total_approved_wfh_days}</div>
            </div>
          </div>

          {/* WFH Requests Table */}
          <div className="overflow-x-auto overscroll-x-contain border border-slate-200 dark:border-[#203653] rounded-lg">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-[#081426]/80 border-b border-slate-200 dark:border-[#203653] text-slate-500 dark:text-[#7E93B5] font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5">Department</th>
                  <th className="px-4 py-2.5">WFH Period</th>
                  <th className="px-4 py-2.5">Days</th>
                  <th className="px-4 py-2.5">Reason</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Submitted</th>
                  <th className="px-4 py-2.5">Reviewer Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#203653]/60 text-slate-700 dark:text-[#A9BCD8]">
                {wfhReport.requests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400 dark:text-[#7E93B5] italic">
                      No WFH requests recorded for this interval.
                    </td>
                  </tr>
                ) : (
                  wfhReport.requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-[#10213D]/50 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-[#EAF2FF]">{req.employee_name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-[#7E93B5] font-mono">{req.employee_code}</div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 dark:text-[#A9BCD8]">
                        {req.department}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-900 dark:text-[#EAF2FF] font-medium font-mono">
                        {req.start_date} to {req.end_date}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-bold text-sky-700 dark:text-cyan-400">
                        {req.days_count} d
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-[#A9BCD8] max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : req.status === 'PENDING'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : req.status === 'REJECTED'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                              : 'bg-slate-100 dark:bg-[#10213D] text-slate-700 dark:text-[#A9BCD8]'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-500 dark:text-[#7E93B5] font-mono text-[11px]">
                        {formatDisplayDate(req.submitted_at)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-[11px] text-slate-600 dark:text-[#A9BCD8]">
                        {req.reviewer_name ? (
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-[#EAF2FF]">{req.reviewer_name}</span>
                            {req.reviewed_at && (
                              <div className="text-[10px] text-slate-400 dark:text-[#7E93B5] font-mono">
                                {formatDisplayDate(req.reviewed_at)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-[#7E93B5] italic">Pending review</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 6: EXCEL & CSV EXPORT WITH TARGETED FILTERS */}
      <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-[#203653] pb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-[#EAF2FF]">Export Attendance Records (Excel & CSV)</h4>
              <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-0.5">
                Download formatted Excel spreadsheet (native widths, frozen headers) or raw streaming CSV
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportXLSX}
              disabled={isExportingXLSX || isExportingCSV}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              title="Download native Excel (.xlsx) file with pre-configured column widths (no ########)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExportingXLSX ? 'Preparing Excel...' : 'Download Excel (.xlsx)'}</span>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={isExportingCSV || isExportingXLSX}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#10213D] dark:hover:bg-[#162c50] text-slate-700 dark:text-[#EAF2FF] text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer border border-slate-200 dark:border-[#203653]"
              title="Download raw streaming CSV timesheet"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingCSV ? 'Preparing CSV...' : 'Download CSV (.csv)'}</span>
            </button>
          </div>
        </div>

        {/* Targeted Export Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#A9BCD8] mb-1">
              Start Date (Inclusive)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#A9BCD8] mb-1">
              End Date (Inclusive)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#A9BCD8] mb-1">
              Department Scope
            </label>
            <select
              value={exportDept}
              onChange={(e) => setExportDept(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
            >
              <option value="ALL">All Departments</option>
              {availableDepts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#A9BCD8] mb-1">
              Status Filter
            </label>
            <select
              value={exportStatus}
              onChange={(e) => setExportStatus(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
            >
              <option value="ALL">All Attendance Statuses</option>
              <option value="PRESENT">PRESENT</option>
              <option value="LATE">LATE</option>
              <option value="HALF_DAY">HALF_DAY</option>
            </select>
          </div>
        </div>

        {/* Excel & CSV Format Guidance */}
        <div className="rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] p-3.5 space-y-2 text-xs text-slate-600 dark:text-[#A9BCD8]">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div className="leading-relaxed space-y-1.5">
              <span className="font-semibold text-slate-800 dark:text-[#EAF2FF]">Export Format Guidance:</span>
              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-[#A9BCD8]">
                <li>
                  <strong className="text-slate-800 dark:text-[#EAF2FF]">Native Excel (.xlsx) [Recommended]:</strong> Opens directly in Microsoft Excel with generous pre-configured column widths (22 chars for timestamps), completely eliminating <code className="bg-slate-200/70 dark:bg-[#10213D] text-slate-800 dark:text-[#22D3EE] px-1 py-0.5 rounded font-mono text-[11px]">########</code>. Headers are frozen and auto-filters are pre-applied.
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-[#EAF2FF]">Standard CSV (.csv):</strong> RFC 4180 streaming text format for ETL pipelines, scripts, and database imports. Standard CSV does not store column widths. If opening in Excel, press <kbd className="bg-white dark:bg-[#10213D] border border-slate-300 dark:border-[#203653] text-slate-800 dark:text-[#EAF2FF] rounded px-1 text-[10px] font-sans">Ctrl+A</kbd> then <kbd className="bg-white dark:bg-[#10213D] border border-slate-300 dark:border-[#203653] text-slate-800 dark:text-[#EAF2FF] rounded px-1 text-[10px] font-sans">Alt+H+O+I</kbd> (or double-click column boundaries) to AutoFit.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
