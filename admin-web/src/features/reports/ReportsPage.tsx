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
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Attendance Reports & Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time daily compliance figures, lateness audits, WFH analytics, and secure timesheet export
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReports}
            disabled={isLoading}
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Refresh reports"
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer border border-slate-200"
            title="Download raw CSV timesheet"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingCSV ? 'Exporting CSV...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="font-bold text-rose-600 hover:text-rose-900"
          >
            ×
          </button>
        </div>
      )}

      {exportSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportSuccess}</span>
          </div>
          <button
            onClick={() => setExportSuccess(null)}
            className="font-bold text-emerald-600"
          >
            ×
          </button>
        </div>
      )}

      {/* SECTION 1: FILTER CONTROLS */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800">Reporting Intervals & Scope</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDefinitions(!showDefinitions)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              <span>{showDefinitions ? 'Hide Metric Definitions' : 'View Metric Definitions'}</span>
            </button>
            <button
              onClick={handleClearFilters}
              className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              Reset Defaults
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Daily Date Selector */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 flex items-center gap-1">
              <span>Daily Report Date</span>
              <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1 rounded">Single Day</span>
            </label>
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Range Start */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600">Interval Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Range End */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600">Interval End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Presets & Apply */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600">Quick Intervals</label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleApplyPreset(0)}
                className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] text-center"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(6)}
                className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] text-center"
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(29)}
                className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] text-center"
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={fetchReports}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] shadow-xs"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Definitions Reference */}
        {showDefinitions && dailyReport?.definitions && (
          <div className="mt-3 p-3.5 rounded-lg bg-indigo-50/60 border border-indigo-100 text-slate-700 text-xs space-y-2">
            <div className="font-bold text-indigo-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Documented Calculation Formulas & Business Rules</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
              <div>
                <span className="font-semibold text-slate-900">Attendance Percentage: </span>
                <span className="text-slate-600">{dailyReport.definitions.attendance_percentage}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-900">Eligible Employees: </span>
                <span className="text-slate-600">{dailyReport.definitions.eligible_employees}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-900">Incomplete Attendance: </span>
                <span className="text-slate-600">{dailyReport.definitions.incomplete_count}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-900">Absent Classification: </span>
                <span className="text-slate-600">{dailyReport.definitions.absent_count}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-900">Headcount Reconciliation: </span>
                <span className="text-slate-600">{dailyReport.definitions.reconciliation || 'Total Active = Attended + Leave + Remote WFH + Absent'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: DAILY ATTENDANCE SUMMARY & PERCENTAGE (RECONCILED) */}
      {dailyReport && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Daily Attendance Reconciliation — {formatDisplayDate(dailyReport.report_date)}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Headcount: {dailyReport.total_active_employees} active staff ({dailyReport.eligible_employees} eligible)
              </p>
            </div>

            {/* Attendance Percentage Badge with exact math formula */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Attendance Compliance
                </div>
                <div className="text-lg font-extrabold text-indigo-600">
                  {dailyReport.attendance_percentage}%
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {dailyReport.attended_eligible_count ?? dailyReport.total_attended} / {dailyReport.eligible_employees} eligible
                </div>
              </div>
              <div className="w-24 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
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
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Active Headcount
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {dailyReport.total_active_employees}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Eligible: {dailyReport.eligible_employees}
              </div>
            </div>

            {/* Office Attended (Numerator of compliance) */}
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-emerald-600" />
                  <span>Office Attended</span>
                </span>
                <span className="text-[10px] bg-emerald-200/60 text-emerald-800 px-1 rounded font-bold">
                  {dailyReport.total_attended}
                </span>
              </div>
              <div className="text-xl font-bold text-emerald-900 mt-1">
                {dailyReport.total_attended}
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5">
                {dailyReport.present_count} on-time · {dailyReport.late_count} late · {dailyReport.half_day_count} half-day
              </div>
            </div>

            {/* Approved Leave */}
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-600" />
                <span>Approved Leave</span>
              </div>
              <div className="text-xl font-bold text-amber-900 mt-1">
                {dailyReport.on_leave_count}
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5">Excused absence</div>
            </div>

            {/* Remote WFH (Only those who didn't attend office) */}
            <div className="p-3.5 rounded-lg bg-sky-50 border border-sky-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1">
                <Home className="w-3 h-3 text-sky-600" />
                <span>Remote WFH</span>
              </div>
              <div className="text-xl font-bold text-sky-900 mt-1">
                {dailyReport.wfh_remote_count ?? (dailyReport.wfh_count - (dailyReport.attended_wfh_count ?? 0))}
              </div>
              <div className="text-[10px] text-sky-700 mt-0.5">
                {dailyReport.wfh_count} approved ({dailyReport.attended_wfh_count ?? 0} at office)
              </div>
            </div>

            {/* Absent */}
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1">
                <UserX className="w-3 h-3 text-rose-600" />
                <span>Unaccounted Absent</span>
              </div>
              <div className="text-xl font-bold text-rose-900 mt-1">
                {dailyReport.absent_count}
              </div>
              <div className="text-[10px] text-rose-700 mt-0.5">No record, leave, or WFH</div>
            </div>
          </div>

          {/* Reconciliation Audit Equation Bar */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold text-slate-900">Headcount Balance:</span>
              <span>
                Attended (<strong>{dailyReport.total_attended}</strong>) + Leave (<strong>{dailyReport.on_leave_count}</strong>) + Remote WFH (<strong>{dailyReport.wfh_remote_count ?? (dailyReport.wfh_count - (dailyReport.attended_wfh_count ?? 0))}</strong>) + Absent (<strong>{dailyReport.absent_count}</strong>) = <strong className="text-indigo-600">{dailyReport.total_active_employees} Active Staff</strong>
              </span>
            </div>
            <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
              100% Reconciled
            </div>
          </div>

          {/* Operational Alert for Incomplete Shifts */}
          {dailyReport.incomplete_count > 0 && (
            <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Operational Notice:</strong> {dailyReport.incomplete_count} of the {dailyReport.total_attended} attendance session(s) today are in-progress / unclosed (missing recorded check-out).
                </span>
              </div>
              <span className="text-[10px] font-bold bg-amber-200/70 px-2 py-0.5 rounded text-amber-900">
                {dailyReport.incomplete_count} Open Sessions
              </span>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: INTERVAL AUDIT SUMMARY */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-indigo-500" />
              <span>Interval Attendance Rate</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {summary.attendance_rate_percentage}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {summary.total_attendance_records} attendances across {summary.total_days} days
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <BarChart2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Average Daily Attendance</span>
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {summary.average_daily_attendance}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Eligible active: {summary.total_active_employees} staff
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span>Approved Leave Days</span>
            </div>
            <div className="text-2xl font-bold text-amber-600">
              {summary.approved_leave_days}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Authorized absence employee-days
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Laptop className="w-3.5 h-3.5 text-sky-500" />
              <span>Approved WFH Days</span>
            </div>
            <div className="text-2xl font-bold text-sky-600">
              {summary.approved_wfh_days}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Remote authorization employee-days
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: LATE ATTENDANCE AUDIT */}
      {lateReport && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Late Attendance Summary & Details</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configured Shift: {lateReport.shift_start_time} | Grace: {lateReport.late_grace_minutes}m | Late Rate: {lateReport.late_percentage}% ({lateReport.total_late_records} of {lateReport.total_attendance_records} records)
              </p>
            </div>

            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
              {lateReport.total_late_records} Late Incidents
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
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
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {lateReport.records.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">
                      No late attendance records found for the selected interval ({startDate} to {endDate}).
                    </td>
                  </tr>
                ) : (
                  lateReport.records.map((r) => (
                    <tr key={r.record_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                        {r.attendance_date}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{r.employee_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.employee_code}</div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                        {r.department}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-mono text-slate-800">
                        {formatDisplayTime(r.check_in)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-mono text-slate-500">
                        {r.check_out ? (
                          formatDisplayTime(r.check_out)
                        ) : (
                          <span className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold">
                            Open/Missing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                          +{r.minutes_late ?? '—'} min
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {r.is_corrected ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                            Admin Corrected
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">{r.source || 'OFFICE_QR'}</span>
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
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Home className="w-4 h-4 text-sky-600" />
                <span>Work-From-Home (WFH) Statistics</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Request pipeline volume, approval decisions, and target remote days
              </p>
            </div>

            {/* Filter Toggle: Target WFH Date vs Submission Date */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setWfhFilterBy('target_date')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  wfhFilterBy === 'target_date'
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                By WFH Date
              </button>
              <button
                type="button"
                onClick={() => setWfhFilterBy('submission_date')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  wfhFilterBy === 'submission_date'
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                By Submitted Date
              </button>
            </div>
          </div>

          {/* WFH Status Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Requests
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">{wfhReport.total_requests}</div>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Pending</div>
              <div className="text-xl font-bold text-amber-900 mt-1">{wfhReport.pending_requests}</div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Approved</div>
              <div className="text-xl font-bold text-emerald-900 mt-1">{wfhReport.approved_requests}</div>
            </div>
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Rejected</div>
              <div className="text-xl font-bold text-rose-900 mt-1">{wfhReport.rejected_requests}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cancelled</div>
              <div className="text-xl font-bold text-slate-700 mt-1">{wfhReport.cancelled_requests}</div>
            </div>
            <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-800">Approved Days</div>
              <div className="text-xl font-bold text-sky-900 mt-1">{wfhReport.total_approved_wfh_days}</div>
            </div>
          </div>

          {/* WFH Requests Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
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
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {wfhReport.requests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">
                      No WFH requests recorded for this interval.
                    </td>
                  </tr>
                ) : (
                  wfhReport.requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{req.employee_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{req.employee_code}</div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                        {req.department}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-900 font-medium">
                        {req.start_date} to {req.end_date}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-bold text-sky-700">
                        {req.days_count} d
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : req.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {formatDisplayDate(req.submitted_at)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-[11px] text-slate-600">
                        {req.reviewer_name ? (
                          <div>
                            <span className="font-semibold text-slate-800">{req.reviewer_name}</span>
                            {req.reviewed_at && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                {formatDisplayDate(req.reviewed_at)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Pending review</span>
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
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Export Attendance Records (Excel & CSV)</h4>
              <p className="text-xs text-slate-500 mt-0.5">
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
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer border border-slate-200"
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
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Start Date (Inclusive)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              End Date (Inclusive)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Department Scope
            </label>
            <select
              value={exportDept}
              onChange={(e) => setExportDept(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800"
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
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Status Filter
            </label>
            <select
              value={exportStatus}
              onChange={(e) => setExportStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800"
            >
              <option value="ALL">All Attendance Statuses</option>
              <option value="PRESENT">PRESENT</option>
              <option value="LATE">LATE</option>
              <option value="HALF_DAY">HALF_DAY</option>
            </select>
          </div>
        </div>

        {/* Excel & CSV Format Guidance */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs text-slate-600">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="leading-relaxed space-y-1.5">
              <span className="font-semibold text-slate-800">Export Format Guidance:</span>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li>
                  <strong className="text-slate-800">Native Excel (.xlsx) [Recommended]:</strong> Opens directly in Microsoft Excel with generous pre-configured column widths (22 chars for timestamps), completely eliminating <code className="bg-slate-200/70 text-slate-800 px-1 py-0.5 rounded font-mono text-[11px]">########</code>. Headers are frozen and auto-filters are pre-applied.
                </li>
                <li>
                  <strong className="text-slate-800">Standard CSV (.csv):</strong> RFC 4180 streaming text format for ETL pipelines, scripts, and database imports. Standard CSV does not store column widths. If opening in Excel, press <kbd className="bg-white border border-slate-300 rounded px-1 text-[10px] font-sans">Ctrl+A</kbd> then <kbd className="bg-white border border-slate-300 rounded px-1 text-[10px] font-sans">Alt+H+O+I</kbd> (or double-click column boundaries) to AutoFit.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
