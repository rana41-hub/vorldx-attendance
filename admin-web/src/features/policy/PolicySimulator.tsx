import React, { useState } from 'react';
import {
  PlayCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import type { AttendancePolicy, PolicyCalculationResponse } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';

interface PolicySimulatorProps {
  policy?: AttendancePolicy | null;
}

export const PolicySimulator: React.FC<PolicySimulatorProps> = ({ policy }) => {
  const getDefaultDateTime = (hours: number, minutes: number) => {
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    // Format to YYYY-MM-DDTHH:mm for datetime-local
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 16);
  };

  const [simCheckIn, setSimCheckIn] = useState<string>(() => getDefaultDateTime(9, 40));
  const [simCheckOut, setSimCheckOut] = useState<string>(() => getDefaultDateTime(18, 30));
  const [simResult, setSimResult] = useState<PolicyCalculationResponse | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!simCheckIn) {
      setValidationError('Sample check-in date and time is required.');
      return;
    }

    if (simCheckOut) {
      const inTime = new Date(simCheckIn).getTime();
      const outTime = new Date(simCheckOut).getTime();
      if (outTime <= inTime) {
        setValidationError('Check-out timestamp must be strictly later than check-in timestamp.');
        return;
      }
    }

    setIsSimulating(true);

    try {
      const inIso = new Date(simCheckIn).toISOString();
      const outIso = simCheckOut ? new Date(simCheckOut).toISOString() : undefined;
      const res = await api.calculatePolicy(inIso, outIso);
      setSimResult(res);
    } catch (err) {
      setValidationError(err instanceof ApiError ? err.message : 'Policy calculation simulation failed.');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sandbox Safety Notice Banner */}
      <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-[#10213D] border border-indigo-200/80 dark:border-[#203653] text-indigo-900 dark:text-[#EAF2FF] flex items-start gap-3 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-[#22D3EE] shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-indigo-950 dark:text-[#EAF2FF]">
            <span>Dedicated Policy Simulator Sandbox</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-200/70 dark:bg-[#22D3EE]/20 text-indigo-800 dark:text-[#22D3EE] border border-indigo-300 dark:border-[#22D3EE]/30">
              Zero Database Mutation
            </span>
          </div>
          <p className="text-slate-600 dark:text-[#A9BCD8] leading-relaxed">
            Test and preview punctuality classifications, work hour totals, half-day threshold checks, and early departure penalties against current organizational attendance policy. <strong>No employee records, database rows, or live sessions are created or modified by this tool.</strong>
          </p>
        </div>
      </div>

      {/* Simulator Input Card */}
      <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#203653]">
          <div className="flex items-center gap-2.5">
            <PlayCircle className="w-5 h-5 text-indigo-600 dark:text-[#22D3EE]" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#EAF2FF]">
                Simulation Timestamps & Parameters
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#7E93B5]">
                Enter hypothetical arrival and departure timestamps to evaluate backend policy rules
              </p>
            </div>
          </div>

          {policy && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-[#7E93B5]">
              <Clock className="w-3.5 h-3.5 text-indigo-500 dark:text-[#22D3EE]" />
              <span>Shift: <strong className="text-slate-700 dark:text-[#EAF2FF]">{policy.work_start_time.slice(0, 5)} — {policy.work_end_time.slice(0, 5)}</strong></span>
            </div>
          )}
        </div>

        {validationError && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleRunSimulation} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500 dark:text-[#22D3EE]" />
                <span>Sample Check-In Time (Required)</span>
              </label>
              <input
                type="datetime-local"
                required
                value={simCheckIn}
                onChange={(e) => {
                  setSimCheckIn(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
              />
              <p className="text-[11px] text-slate-400 dark:text-[#7E93B5] mt-1">
                Timestamp when the employee scans the entrance dynamic QR code.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500 dark:text-[#22D3EE]" />
                <span>Sample Check-Out Time (Optional)</span>
              </label>
              <input
                type="datetime-local"
                value={simCheckOut}
                onChange={(e) => {
                  setSimCheckOut(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
              />
              <p className="text-[11px] text-slate-400 dark:text-[#7E93B5] mt-1">
                Leave empty to simulate an in-progress shift with open check-in.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#203653]">
            <button
              type="button"
              onClick={() => {
                setSimCheckIn(getDefaultDateTime(9, 10)); // On-time
                setSimCheckOut(getDefaultDateTime(18, 30));
                setValidationError(null);
              }}
              className="text-xs text-indigo-600 dark:text-[#22D3EE] hover:underline cursor-pointer"
            >
              Preset: On-Time Full Day
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSimCheckIn(getDefaultDateTime(10, 15)); // Late
                  setSimCheckOut(getDefaultDateTime(13, 30)); // Half-day
                  setValidationError(null);
                }}
                className="text-xs text-slate-500 dark:text-[#7E93B5] hover:text-slate-800 dark:hover:text-[#EAF2FF] hover:underline cursor-pointer mr-2"
              >
                Preset: Late & Half-Day
              </button>

              <button
                type="submit"
                disabled={isSimulating}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-[#3B82F6] dark:hover:bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
              >
                <Sparkles className="w-4 h-4 text-cyan-300" />
                <span>{isSimulating ? 'Evaluating Policy...' : 'Evaluate Policy Rule'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Simulator Results Section */}
      {simResult && (
        <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#203653]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-[#34D399]" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#EAF2FF]">
                Policy Evaluation Results & Classification
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-[#7E93B5]">
              Real-time calculation response
            </span>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Status Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#7E93B5] uppercase tracking-wider">
                Attendance Status
              </span>
              <div className="pt-1 flex items-center gap-2">
                <StatusBadge status={simResult.status} />
              </div>
            </div>

            {/* Punctuality Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#7E93B5] uppercase tracking-wider">
                Punctuality
              </span>
              <div className="pt-1">
                {simResult.is_late ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                    Late Arrival
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                    On-Time Check-In
                  </span>
                )}
              </div>
            </div>

            {/* Hours Worked Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#7E93B5] uppercase tracking-wider">
                Worked Duration
              </span>
              <div className="pt-1 font-mono text-base font-bold text-slate-900 dark:text-[#EAF2FF]">
                {simResult.hours_worked !== null && simResult.hours_worked !== undefined
                  ? `${simResult.hours_worked} Hours`
                  : 'In-Progress (Open)'}
              </div>
            </div>

            {/* Early Departure Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#7E93B5] uppercase tracking-wider">
                Departure Status
              </span>
              <div className="pt-1">
                {simResult.is_early_departure ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                    Early Departure
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-[#10213D] text-slate-700 dark:text-[#A9BCD8] border border-slate-200 dark:border-[#203653]">
                    {simCheckOut ? 'Normal Checkout' : 'Not Finalized'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Technical Telemetry Details */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-500 dark:text-[#22D3EE]" />
              <span>Backend Policy Calculation Diagnostics</span>
            </span>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] font-mono text-xs text-slate-800 dark:text-[#EAF2FF] leading-relaxed">
              {simResult.details}
            </div>
          </div>

          {/* Policy Baseline Reference */}
          {policy && (
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] text-[11px] text-slate-500 dark:text-[#7E93B5] flex flex-wrap gap-x-6 gap-y-2">
              <div>
                Baseline Shift: <strong className="text-slate-800 dark:text-[#EAF2FF]">{policy.work_start_time.slice(0, 5)} — {policy.work_end_time.slice(0, 5)}</strong>
              </div>
              <div>
                Late Grace: <strong className="text-slate-800 dark:text-[#EAF2FF]">{policy.late_grace_minutes} min</strong>
              </div>
              <div>
                Early Departure Grace: <strong className="text-slate-800 dark:text-[#EAF2FF]">{policy.early_departure_grace_minutes} min</strong>
              </div>
              <div>
                Half-Day Min: <strong className="text-slate-800 dark:text-[#EAF2FF]">{policy.half_day_hours_threshold} hrs</strong>
              </div>
              <div>
                Full-Day Benchmark: <strong className="text-slate-800 dark:text-[#EAF2FF]">{policy.full_day_hours_threshold} hrs</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
