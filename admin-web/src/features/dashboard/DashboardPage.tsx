import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Laptop,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { SummaryCard } from '../../components/dashboard/SummaryCard';
import { AttendanceChart } from '../../components/dashboard/AttendanceChart';
import { RecentAttendanceTable } from '../../components/dashboard/RecentAttendanceTable';
import type {
  AttendanceRecord,
  DailyTrendItem,
  DashboardMetricsResponse,
  SystemHealth,
} from '../../types';
import { api, ApiError } from '../../services/api';
import { Link } from 'react-router-dom';

interface DashboardPageProps {
  health: SystemHealth;
}

export const DashboardPage: React.FC<DashboardPageProps> = () => {
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [trends, setTrends] = useState<DailyTrendItem[]>([]);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [targetDate, setTargetDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef(false);

  const fetchDashboardData = useCallback(
    async (dateStr?: string, isSilent = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (!isSilent) {
        setIsLoading(true);
      } else {
        setIsSyncing(true);
      }
      setError(null);

      try {
        const activeDate = dateStr || targetDate;
        const [dashData, trendsData, attendanceLogs, employees] = await Promise.all([
          api.getDashboardMetrics(activeDate),
          api.getAttendanceTrends(),
          api.getAttendance(activeDate),
          api.getEmployees(),
        ]);

        setMetrics(dashData);
        setTrends(trendsData.trends || []);

        const employeeMap = new Map(employees.map((e) => [e.id, e]));
        const enrichedRecords = (attendanceLogs || []).map((r) => {
          const emp = employeeMap.get(r.employee_id);
          return {
            ...r,
            employee_name: emp ? emp.full_name : `Employee #${r.employee_id}`,
            employee_code: emp ? emp.employee_code : `VX-${r.employee_id}`,
            department: emp ? emp.department : 'General',
          };
        });

        setRecentRecords(enrichedRecords);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to retrieve dashboard metrics.');
        }
      } finally {
        isFetchingRef.current = false;
        setIsLoading(false);
        setIsSyncing(false);
      }
    },
    [targetDate]
  );

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Periodic polling (30s) when viewing today's date, with clean unmount
  useEffect(() => {
    if (!autoRefresh) return;
    const todayStr = new Date().toISOString().split('T')[0];
    if (targetDate !== todayStr) return;

    const intervalId = setInterval(() => {
      fetchDashboardData(targetDate, true);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, targetDate, fetchDashboardData]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-[#EAF2FF]">
            Administrator Dashboard
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-0.5">
            Organization-wide presence telemetry, active requests, and compliance metrics
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Auto-sync indicator & toggle */}
          {targetDate === new Date().toISOString().split('T')[0] && (
            <button
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                autoRefresh
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-[#34D399] border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                  : 'bg-slate-50 dark:bg-[#081426] text-slate-600 dark:text-[#7E93B5] border-slate-200 dark:border-[#203653] hover:bg-slate-100 dark:hover:bg-[#10213D]'
              }`}
              title={autoRefresh ? 'Auto-refresh every 30s enabled. Click to pause.' : 'Auto-refresh paused. Click to enable.'}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  autoRefresh ? (isSyncing ? 'bg-emerald-400 dark:bg-[#34D399] animate-ping' : 'bg-emerald-500 dark:bg-[#34D399]') : 'bg-slate-400 dark:bg-[#7E93B5]'
                }`}
              />
              <span>{autoRefresh ? (isSyncing ? 'Syncing...' : 'Auto-sync') : 'Paused'}</span>
            </button>
          )}

          {lastUpdated && (
            <span className="text-[11px] font-mono text-slate-400 dark:text-[#7E93B5] hidden md:inline">
              {lastUpdated}
            </span>
          )}

          <div className="flex items-center gap-1.5">
            <label htmlFor="dashboard-date" className="text-xs font-semibold text-slate-600 dark:text-[#A9BCD8]">
              Date:
            </label>
            <input
              id="dashboard-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="bg-white dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
            />
          </div>
          <button
            onClick={() => fetchDashboardData()}
            disabled={isLoading || isSyncing}
            className="p-1.5 border border-slate-200 dark:border-[#203653] rounded-xl text-slate-600 dark:text-[#A9BCD8] hover:bg-slate-50 dark:hover:bg-[#10213D] transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh dashboard"
            aria-label="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading || isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-[#FB7185] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-[#FB7185] shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={() => fetchDashboardData()}
            className="px-2.5 py-1 rounded-lg bg-rose-600 dark:bg-[#FB7185] text-white dark:text-slate-950 font-bold hover:bg-rose-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <SummaryCard
          title="Active Headcount"
          value={metrics ? metrics.total_active_employees.toLocaleString() : '—'}
          subtitle="Registered active personnel in roster"
          icon={<Users className="w-5 h-5" />}
          iconBgColor="bg-indigo-50 dark:bg-[#10213D] text-indigo-600 dark:text-[#60A5FA] border border-indigo-100 dark:border-[#203653]"
          glow="blue"
        />
        <SummaryCard
          title="Present in Office"
          value={metrics ? metrics.present_today : '—'}
          badge={metrics ? `${metrics.attendance_percentage ?? 0}% rate` : undefined}
          subtitle={`${metrics ? metrics.late_today : 0} late • ${metrics ? metrics.half_day_today : 0} half-day`}
          icon={<UserCheck className="w-5 h-5" />}
          iconBgColor="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-[#34D399] border border-emerald-100 dark:border-emerald-500/20"
          glow="cyan"
        />
        <SummaryCard
          title="Working From Home"
          value={metrics ? metrics.wfh_today : '—'}
          subtitle="Approved remote work roster"
          icon={<Laptop className="w-5 h-5" />}
          iconBgColor="bg-sky-50 dark:bg-cyan-500/10 text-sky-600 dark:text-[#22D3EE] border border-sky-100 dark:border-cyan-500/20"
          glow="cyan"
        />
        <SummaryCard
          title="Absent / Unaccounted"
          value={metrics ? metrics.absent_today.toLocaleString() : '—'}
          subtitle={`${metrics ? metrics.on_leave_today.toLocaleString() : 0} on approved leave • ${metrics ? metrics.absent_today.toLocaleString() : 0} unaccounted`}
          icon={<UserX className="w-5 h-5" />}
          iconBgColor="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-[#FB7185] border border-rose-100 dark:border-rose-500/20"
          glow="none"
        />
      </div>

      {/* Actionable Pipeline Notifications Banner */}
      {metrics && (metrics.pending_leave_requests > 0 || metrics.pending_wfh_requests > 0) && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 dark:bg-[#10213D] border border-amber-300/80 dark:border-[#FBBF24]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-amber-950 dark:text-[#EAF2FF] shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-[#FBBF24]/20 text-amber-700 dark:text-[#FBBF24] shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-amber-900 dark:text-[#FBBF24]">
                  Action Center: Pending Approvals
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-[#FBBF24]/20 text-amber-900 dark:text-[#FBBF24] border border-amber-300 dark:border-[#FBBF24]/30">
                  {metrics.pending_leave_requests + metrics.pending_wfh_requests} Total
                </span>
              </div>
              <div className="text-xs text-slate-600 dark:text-[#A9BCD8] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                {metrics.pending_leave_requests > 0 && (
                  <span>
                    <strong className="text-slate-900 dark:text-[#EAF2FF]">{metrics.pending_leave_requests}</strong> leave application(s) awaiting approval
                  </span>
                )}
                {metrics.pending_leave_requests > 0 && metrics.pending_wfh_requests > 0 && (
                  <span className="text-slate-400 dark:text-[#7E93B5]">•</span>
                )}
                {metrics.pending_wfh_requests > 0 && (
                  <span>
                    <strong className="text-slate-900 dark:text-[#EAF2FF]">{metrics.pending_wfh_requests}</strong> WFH request(s) awaiting manager review
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
            {metrics.pending_leave_requests > 0 && (
              <Link
                to="/leave"
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 dark:bg-[#FBBF24] dark:hover:bg-amber-400 text-white dark:text-slate-950 font-bold transition-all shadow-xs focus-visible:ring-2 focus-visible:ring-amber-400 focus:outline-none text-xs"
              >
                <span>Review Leaves ({metrics.pending_leave_requests})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {metrics.pending_wfh_requests > 0 && (
              <Link
                to="/wfh"
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-[#3B82F6] dark:hover:bg-blue-500 text-white font-bold transition-all shadow-xs focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus:outline-none text-xs"
              >
                <span>Review WFH ({metrics.pending_wfh_requests})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Chart Section */}
      <AttendanceChart trends={trends} isLoading={isLoading} />

      {/* Recent Activity Table */}
      <RecentAttendanceTable
        records={recentRecords}
        onRefresh={() => fetchDashboardData()}
        isLoading={isLoading}
      />
    </div>
  );
};
