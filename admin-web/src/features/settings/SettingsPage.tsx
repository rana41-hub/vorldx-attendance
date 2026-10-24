import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  Clock,
  Server,
  Palette,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Database,
  Cpu,
  Sparkles,
  Sliders,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import type { SystemHealth, AttendancePolicy } from '../../types';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { api } from '../../services/api';

interface SettingsPageProps {
  health: SystemHealth;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ health }) => {
  const navigate = useNavigate();
  const apiUrl =
    (import.meta.env.VITE_API_BASE_URL as string) || 'http://127.0.0.1:8000';

  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [isPolicyLoading, setIsPolicyLoading] = useState(false);
  const [showAdvancedDiagnostics, setShowAdvancedDiagnostics] = useState(false);

  const fetchPolicy = async () => {
    setIsPolicyLoading(true);
    try {
      const data = await api.getPolicy();
      setPolicy(data);
    } catch {
      // Fallback or offline
    } finally {
      setIsPolicyLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  const calculateShiftHours = (start?: string, end?: string): string => {
    if (!start || !end) return '8.0 Hours';
    try {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60;
      return `${(diff / 60).toFixed(1)} Hours`;
    } catch {
      return '8.0 Hours';
    }
  };

  const getHealthBadge = () => {
    switch (health.state) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-[#34D399] border border-emerald-200 dark:border-emerald-800/50">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Online & Operational</span>
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Degraded Connectivity</span>
          </span>
        );
      case 'disconnected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Service Offline</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-[#10213D] text-slate-700 dark:text-[#A9BCD8] border border-slate-200 dark:border-[#203653]">
            <span className="w-2 h-2 rounded-full bg-slate-400 animate-ping"></span>
            <span>Checking Health...</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#EAF2FF]">
          System Configuration & Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-0.5">
          Organizational attendance policies, system operational health, interface theme, and diagnostic telemetry
        </p>
      </div>

      {/* SECTION 1: ATTENDANCE POLICIES (Primary Functional Section for HR Admins) */}
      <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-4 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#203653]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-[#10213D] text-indigo-600 dark:text-[#22D3EE] border border-indigo-100 dark:border-[#203653]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#EAF2FF] flex items-center gap-2">
                <span>Active Attendance Policies</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 dark:bg-[#22D3EE]/20 text-indigo-700 dark:text-[#22D3EE] border border-indigo-200/50 dark:border-[#22D3EE]/30">
                  HR Rule Engine
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#7E93B5]">
                Core punctuality rules, workday schedule expectations, and automated violation triggers
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/policy?tab=simulator')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-[#164E63]/30 text-indigo-700 dark:text-[#22D3EE] text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-[#164E63]/50 border border-indigo-200 dark:border-[#164E63] transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Policy Simulator</span>
            </button>
            <button
              onClick={() => navigate('/policy')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-[#3B82F6] dark:hover:bg-blue-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Edit Parameters</span>
            </button>
            <button
              onClick={fetchPolicy}
              disabled={isPolicyLoading}
              className="p-1.5 border border-slate-200 dark:border-[#203653] rounded-lg text-slate-500 dark:text-[#A9BCD8] hover:bg-slate-50 dark:hover:bg-[#10213D] transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh active policy parameters"
              aria-label="Refresh policy parameters"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPolicyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dynamic Policy Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          {/* Workday Schedule */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-semibold text-slate-900 dark:text-[#EAF2FF]">Standard Workday Schedule</div>
              <p className="text-[11px] text-slate-500 dark:text-[#7E93B5]">
                Expected daily shift hours between check-in and check-out
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono px-2 py-1 bg-white dark:bg-[#0C1930] rounded text-slate-900 dark:text-[#EAF2FF] font-medium border border-slate-200 dark:border-[#203653] text-[11px]">
                {policy ? `${policy.work_start_time.slice(0, 5)} — ${policy.work_end_time.slice(0, 5)}` : '09:30 — 18:30'}
              </span>
              <div className="text-[10px] text-indigo-600 dark:text-[#22D3EE] font-semibold mt-1">
                {calculateShiftHours(policy?.work_start_time, policy?.work_end_time)}
              </div>
            </div>
          </div>

          {/* Late Grace Period */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-semibold text-slate-900 dark:text-[#EAF2FF]">Late Arrival Grace Period</div>
              <p className="text-[11px] text-slate-500 dark:text-[#7E93B5]">
                Arrival tolerance window before check-in is classified as LATE
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono px-2 py-1 bg-white dark:bg-[#0C1930] rounded text-slate-900 dark:text-[#EAF2FF] font-medium border border-slate-200 dark:border-[#203653] text-[11px]">
                {policy ? `${policy.late_grace_minutes} Minutes` : '15 Minutes'}
              </span>
              <div className="text-[10px] text-slate-400 dark:text-[#7E93B5] mt-1">
                {policy?.auto_detect_late_arrival ? 'Auto-detection ON' : 'Manual review'}
              </div>
            </div>
          </div>

          {/* Half-Day Duration Threshold */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-semibold text-slate-900 dark:text-[#EAF2FF]">Half-Day Threshold</div>
              <p className="text-[11px] text-slate-500 dark:text-[#7E93B5]">
                Minimum hours worked required to avoid HALF_DAY classification
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono px-2 py-1 bg-white dark:bg-[#0C1930] rounded text-slate-900 dark:text-[#EAF2FF] font-medium border border-slate-200 dark:border-[#203653] text-[11px]">
                {policy ? `${policy.half_day_hours_threshold} Hours` : '4.0 Hours'}
              </span>
              <div className="text-[10px] text-slate-400 dark:text-[#7E93B5] mt-1">
                Benchmark: {policy?.full_day_hours_threshold || 8.0}h Full Day
              </div>
            </div>
          </div>

          {/* Early Departure Grace Period */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-semibold text-slate-900 dark:text-[#EAF2FF]">Early Departure Grace</div>
              <p className="text-[11px] text-slate-500 dark:text-[#7E93B5]">
                Buffer time allowed prior to shift end before check-out is flagged
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono px-2 py-1 bg-white dark:bg-[#0C1930] rounded text-slate-900 dark:text-[#EAF2FF] font-medium border border-slate-200 dark:border-[#203653] text-[11px]">
                {policy ? `${policy.early_departure_grace_minutes} Minutes` : '15 Minutes'}
              </span>
              <div className="text-[10px] text-slate-400 dark:text-[#7E93B5] mt-1">
                {policy?.auto_detect_early_departure ? 'Auto-penalty ON' : 'Manual review'}
              </div>
            </div>
          </div>

          {/* Dynamic QR Challenge Expiration (Read-only security invariant) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-semibold text-slate-900 dark:text-[#EAF2FF] flex items-center gap-1.5">
                <span>QR Challenge Expiration</span>
                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-[#10213D] text-slate-600 dark:text-[#A9BCD8]">
                  Security Rule
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#7E93B5]">
                Dynamic office kiosk rotation window to prevent replay or screenshot sharing
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono px-2 py-1 bg-white dark:bg-[#0C1930] rounded text-slate-900 dark:text-[#EAF2FF] font-medium border border-slate-200 dark:border-[#203653] text-[11px]">
                18 Seconds
              </span>
              <div className="text-[10px] text-emerald-600 dark:text-[#34D399] font-medium mt-1">
                Active & Rotating
              </div>
            </div>
          </div>

          {/* Same-Day Duplicate Attendance Prevention (Read-only DB invariant) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-semibold text-slate-900 dark:text-[#EAF2FF] flex items-center gap-1.5">
                <span>Duplicate Check-In Prevention</span>
                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-[#10213D] text-slate-600 dark:text-[#A9BCD8]">
                  DB Invariant
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#7E93B5]">
                Guarantees exactly one primary attendance lifecycle per employee per day
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800/50">
                <ShieldCheck className="w-3 h-3" />
                <span>DB Constraint</span>
              </span>
              <div className="text-[10px] font-mono text-slate-400 dark:text-[#7E93B5] mt-1">
                UNIQUE(emp, date)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: SYSTEM OPERATIONAL HEALTH (Compact Readable Operational Section) */}
      <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#203653]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-[#10213D] text-emerald-600 dark:text-[#34D399] border border-emerald-100 dark:border-[#203653]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#EAF2FF]">
                System Operational Health
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#7E93B5]">
                Real-time service availability, database connectivity, and backend telemetry
              </p>
            </div>
          </div>

          <div>{getHealthBadge()}</div>
        </div>

        {/* Operational Overview Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] space-y-1">
            <span className="text-slate-500 dark:text-[#7E93B5] text-[11px] font-medium">Backend API Service</span>
            <div className="font-semibold text-slate-900 dark:text-[#EAF2FF] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>FastAPI REST Service</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 dark:text-[#7E93B5]">
              {health.backendMessage || 'Online'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] space-y-1">
            <span className="text-slate-500 dark:text-[#7E93B5] text-[11px] font-medium">Primary Database</span>
            <div className="font-semibold text-slate-900 dark:text-[#EAF2FF] flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-500 dark:text-[#22D3EE]" />
              <span>PostgreSQL Cluster</span>
            </div>
            <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {health.databaseConnected ? 'Connected & Verified (SELECT 1)' : 'Connection Degraded'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] space-y-1">
            <span className="text-slate-500 dark:text-[#7E93B5] text-[11px] font-medium">Telemetry & Latency</span>
            <div className="font-mono text-sm font-bold text-slate-900 dark:text-[#EAF2FF]">
              {health.latencyMs !== undefined ? `${health.latencyMs} ms` : 'Active'}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-[#7E93B5]">
              Last checked: {health.lastChecked || 'Just now'}
            </div>
          </div>
        </div>

        {/* Advanced Diagnostics Collapsible Trigger */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAdvancedDiagnostics((prev) => !prev)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] hover:bg-slate-100/60 dark:hover:bg-[#10213D]/60 transition-colors cursor-pointer text-xs font-semibold text-slate-800 dark:text-[#EAF2FF]"
          >
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-600 dark:text-[#22D3EE]" />
              <span>Advanced Diagnostics & Developer Infrastructure</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-[#7E93B5]">
              <span>{showAdvancedDiagnostics ? 'Hide details' : 'Show details'}</span>
              {showAdvancedDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {/* SECTION 3: ADVANCED SYSTEM DIAGNOSTICS (Moved out of primary view) */}
          {showAdvancedDiagnostics && (
            <div className="mt-3 p-4 rounded-xl bg-slate-900/5 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-[#EAF2FF]">
                    Technical Infrastructure Details
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-[#7E93B5]">
                    Driver versions, migration revisions, and endpoint routing (zero credentials exposed)
                  </p>
                </div>
                <a
                  href={`${apiUrl}/docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 dark:bg-[#164E63]/30 text-indigo-700 dark:text-[#22D3EE] text-[11px] font-semibold hover:bg-indigo-100 dark:hover:bg-[#164E63]/50 border border-indigo-200 dark:border-[#164E63] transition-colors"
                >
                  <span>OpenAPI Swagger Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-white dark:bg-[#0C1930] border border-slate-200 dark:border-[#203653] space-y-1">
                  <span className="text-slate-400 dark:text-[#7E93B5] text-[10px] uppercase font-bold tracking-wider">
                    API Base Endpoint
                  </span>
                  <div className="font-mono text-xs text-slate-900 dark:text-[#EAF2FF] font-medium truncate">
                    {apiUrl}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-[#0C1930] border border-slate-200 dark:border-[#203653] space-y-1">
                  <span className="text-slate-400 dark:text-[#7E93B5] text-[10px] uppercase font-bold tracking-wider">
                    Database Driver
                  </span>
                  <div className="font-mono text-xs text-slate-900 dark:text-[#EAF2FF] font-medium">
                    PostgreSQL 18 (Psycopg 3)
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-[#0C1930] border border-slate-200 dark:border-[#203653] space-y-1">
                  <span className="text-slate-400 dark:text-[#7E93B5] text-[10px] uppercase font-bold tracking-wider">
                    Migration Engine & Head
                  </span>
                  <div className="font-mono text-xs text-slate-900 dark:text-[#EAF2FF] font-medium">
                    Alembic 1.20 (dd512940ae96)
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-[#0C1930] border border-slate-200 dark:border-[#203653] space-y-1">
                  <span className="text-slate-400 dark:text-[#7E93B5] text-[10px] uppercase font-bold tracking-wider">
                    Duplicate Invariant
                  </span>
                  <div className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    uq_emp_date (Enforced)
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-[#0C1930] border border-slate-200 dark:border-[#203653] space-y-1">
                  <span className="text-slate-400 dark:text-[#7E93B5] text-[10px] uppercase font-bold tracking-wider">
                    Health Check Polling
                  </span>
                  <div className="font-mono text-xs text-slate-900 dark:text-[#EAF2FF] font-medium">
                    30s Interval (Heartbeat)
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-[#0C1930] border border-slate-200 dark:border-[#203653] space-y-1">
                  <span className="text-slate-400 dark:text-[#7E93B5] text-[10px] uppercase font-bold tracking-wider">
                    Auth Token Protocol
                  </span>
                  <div className="font-mono text-xs text-slate-900 dark:text-[#EAF2FF] font-medium">
                    JWT (HS256 Standard)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: INTERFACE THEME CUSTOMIZATION CARD */}
      <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#203653]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-[#10213D] text-indigo-600 dark:text-[#22D3EE] border border-indigo-100 dark:border-[#203653]">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAF2FF]">
                Interface Appearance & Theme
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#7E93B5]">
                Switch between Enterprise Clean Light and Deep-Blue Cyberpunk Dark Mode
              </p>
            </div>
          </div>

          <ThemeToggle variant="segmented" />
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] space-y-1">
            <div className="font-semibold text-slate-800 dark:text-[#EAF2FF] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              <span>Enterprise Light Theme</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#7E93B5]">
              Deep navy navigation, crisp white surfaces, tailored HSL color tokens for high-density administrative workflows.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] space-y-1">
            <div className="font-semibold text-slate-800 dark:text-[#EAF2FF] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#22D3EE]"></span>
              <span>Deep-Blue Cyberpunk Theme</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#7E93B5]">
              Midnight navy backgrounds (#050B18), dark elevated surfaces (#0C1930), electric cyan and blue neon highlights.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
