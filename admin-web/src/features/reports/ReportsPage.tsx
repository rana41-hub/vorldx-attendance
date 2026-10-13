import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart2,
  Download,
  Calendar,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import type { AttendanceSummaryResponse } from '../../types';

function getISODateDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

export const ReportsPage: React.FC = () => {
  const [startDate, setStartDate] = useState(() => getISODateDaysAgo(29));
  const [endDate, setEndDate] = useState(() => getISODateDaysAgo(0));
  const [summary, setSummary] = useState<AttendanceSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getAttendanceSummary(startDate, endDate);
      setSummary(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error fetching attendance report summary.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const records = await api.getAttendance();
      const employees = await api.getEmployees();
      const empMap = new Map(employees.map((e) => [e.id, e]));

      const filtered = records.filter(
        (r) => r.attendance_date >= startDate && r.attendance_date <= endDate
      );

      const headers = [
        'Record ID',
        'Date',
        'Employee Code',
        'Employee Name',
        'Department',
        'Check-In',
        'Check-Out',
        'Status',
        'Source',
      ];

      const rows = filtered.map((r) => {
        const emp = empMap.get(r.employee_id);
        return [
          r.id,
          r.attendance_date,
          emp ? emp.employee_code : `VX-${r.employee_id}`,
          emp ? `"${emp.full_name}"` : `"Employee #${r.employee_id}"`,
          emp ? `"${emp.department}"` : '"General"',
          r.check_in,
          r.check_out || '',
          r.status,
          r.source || 'OFFICE_QR',
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `VorldX_Attendance_${startDate}_to_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setError('Failed to export CSV report.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Attendance Reports & Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit periods, compliance summaries, and payroll timesheet export
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSummary}
            disabled={isLoading}
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Refresh summary"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Exporting...' : 'Export Timesheet CSV'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Date Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">Audit Interval:</span>
        </div>

        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
        <span className="text-xs text-slate-400">to</span>
        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 ml-auto text-xs">
          <button
            onClick={() => {
              setStartDate(getISODateDaysAgo(6));
              setEndDate(getISODateDaysAgo(0));
            }}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px]"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => {
              setStartDate(getISODateDaysAgo(29));
              setEndDate(getISODateDaysAgo(0));
            }}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px]"
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Attendance Rate
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {summary.attendance_rate_percentage}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {summary.total_attendance_records} records across {summary.total_days} days
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Average Daily Attendance
            </div>
            <div className="text-2xl font-bold text-indigo-600">
              {summary.average_daily_attendance}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Employees attending daily
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Approved Leave Days
            </div>
            <div className="text-2xl font-bold text-amber-600">
              {summary.approved_leave_days}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Authorized absence employee-days
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Approved WFH Days
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

      {/* Status Breakdown Card */}
      {summary && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-600" />
            <span>Attendance Status Breakdown in Selected Interval</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="text-xs font-semibold text-emerald-800">PRESENT (On-Time)</div>
              <div className="text-2xl font-bold text-emerald-900 mt-1">
                {summary.present_count}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1">Standard office check-ins</div>
            </div>

            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
              <div className="text-xs font-semibold text-amber-800">LATE Arrivals</div>
              <div className="text-2xl font-bold text-amber-900 mt-1">
                {summary.late_count}
              </div>
              <div className="text-[11px] text-amber-700 mt-1">Arrived past policy grace window</div>
            </div>

            <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
              <div className="text-xs font-semibold text-indigo-800">HALF_DAY Records</div>
              <div className="text-2xl font-bold text-indigo-900 mt-1">
                {summary.half_day_count}
              </div>
              <div className="text-[11px] text-indigo-700 mt-1">Worked under duration threshold</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
