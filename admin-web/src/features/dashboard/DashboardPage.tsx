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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Administrator Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Organization-wide presence telemetry, active requests, and compliance metrics
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Auto-sync indicator & toggle */}
          {targetDate === new Date().toISOString().split('T')[0] && (
            <button
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                autoRefresh
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title={autoRefresh ? 'Auto-refresh every 30s enabled. Click to pause.' : 'Auto-refresh paused. Click to enable.'}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  autoRefresh ? (isSyncing ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500') : 'bg-slate-400'
                }`}
              />
              <span>{autoRefresh ? (isSyncing ? 'Syncing...' : 'Auto-sync') : 'Paused'}</span>
            </button>
          )}

          {lastUpdated && (
            <span className="text-[11px] text-slate-400 hidden md:inline">
              {lastUpdated}
            </span>
          )}

          <label htmlFor="dashboard-date" className="text-xs font-medium text-slate-600">
            Target Date:
          </label>
          <input
            id="dashboard-date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          <button
            onClick={() => fetchDashboardData()}
            disabled={isLoading || isSyncing}
            className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Refresh dashboard"
            aria-label="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading || isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchDashboardData()}
            className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Active Headcount"
          value={metrics ? metrics.total_active_employees : '—'}
          subtitle="Registered active personnel"
          icon={<Users className="w-5 h-5" />}
          iconBgColor="bg-indigo-50 text-indigo-600"
        />
        <SummaryCard
          title="Present in Office"
          value={metrics ? metrics.present_today : '—'}
          subtitle={`${metrics ? metrics.late_today : 0} late arrivals recorded`}
          icon={<UserCheck className="w-5 h-5" />}
          iconBgColor="bg-emerald-50 text-emerald-600"
        />
        <SummaryCard
          title="Working From Home"
          value={metrics ? metrics.wfh_today : '—'}
          subtitle="Approved WFH requests"
          icon={<Laptop className="w-5 h-5" />}
          iconBgColor="bg-sky-50 text-sky-600"
        />
        <SummaryCard
          title="Absent / Unaccounted"
          value={metrics ? metrics.absent_today : '—'}
          subtitle={`${metrics ? metrics.on_leave_today : 0} on approved leave`}
          icon={<UserX className="w-5 h-5" />}
          iconBgColor="bg-rose-50 text-rose-600"
        />
      </div>

      {/* Actionable Pipeline Notifications Banner */}
      {metrics && (metrics.pending_leave_requests > 0 || metrics.pending_wfh_requests > 0) && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Pending Administrative Actions: </span>
              {metrics.pending_leave_requests > 0 && (
                <span className="mr-3">
                  <strong>{metrics.pending_leave_requests}</strong> pending leave request(s)
                </span>
              )}
              {metrics.pending_wfh_requests > 0 && (
                <span>
                  <strong>{metrics.pending_wfh_requests}</strong> pending WFH request(s)
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {metrics.pending_leave_requests > 0 && (
              <Link
                to="/leave"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors shadow-xs"
              >
                <span>Review Leaves</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {metrics.pending_wfh_requests > 0 && (
              <Link
                to="/wfh"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors shadow-xs"
              >
                <span>Review WFH</span>
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
