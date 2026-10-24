import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sliders,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  Sparkles,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import type { AttendancePolicy } from '../../types';
import { PolicySimulator } from './PolicySimulator';

export const PolicyPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'simulator' ? 'simulator' : 'parameters';

  const setTab = (tab: 'parameters' | 'simulator') => {
    if (tab === 'simulator') {
      setSearchParams({ tab: 'simulator' });
    } else {
      setSearchParams({});
    }
  };

  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [formData, setFormData] = useState({
    policy_name: '',
    work_start_time: '09:30:00',
    work_end_time: '18:30:00',
    late_grace_minutes: 15,
    early_departure_grace_minutes: 15,
    half_day_hours_threshold: 4.0,
    full_day_hours_threshold: 8.0,
    auto_detect_late_arrival: false,
    auto_detect_early_departure: false,
  });

  const [updateReason, setUpdateReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPolicy = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getPolicy();
      setPolicy(data);
      setFormData({
        policy_name: data.policy_name,
        work_start_time: data.work_start_time,
        work_end_time: data.work_end_time,
        late_grace_minutes: data.late_grace_minutes,
        early_departure_grace_minutes: data.early_departure_grace_minutes,
        half_day_hours_threshold: data.half_day_hours_threshold,
        full_day_hours_threshold: data.full_day_hours_threshold,
        auto_detect_late_arrival: data.auto_detect_late_arrival,
        auto_detect_early_departure: data.auto_detect_early_departure,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve attendance policy.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await api.updatePolicy({
        ...formData,
        late_grace_minutes: Number(formData.late_grace_minutes),
        early_departure_grace_minutes: Number(formData.early_departure_grace_minutes),
        half_day_hours_threshold: Number(formData.half_day_hours_threshold),
        full_day_hours_threshold: Number(formData.full_day_hours_threshold),
        reason: updateReason.trim() || undefined,
      });
      setPolicy(updated);
      setSuccess('Attendance policy parameters updated and persistent audit log created.');
      setUpdateReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error updating attendance policy.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#EAF2FF]">
            Attendance Policy Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-0.5">
            Configure expected work shifts, punctuality grace thresholds, and calculation rules
          </p>
        </div>

        <button
          onClick={loadPolicy}
          disabled={isLoading}
          className="p-2 border border-slate-200 dark:border-[#203653] rounded-lg text-slate-600 dark:text-[#A9BCD8] hover:bg-slate-50 dark:hover:bg-[#10213D] transition-colors disabled:opacity-50 self-start sm:self-auto cursor-pointer"
          title="Reload policy"
          aria-label="Reload policy"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Segmented Experience Switcher Tabs */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#0C1930] border border-slate-200 dark:border-[#203653] w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setTab('parameters')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'parameters'
              ? 'bg-white dark:bg-[#10213D] text-indigo-600 dark:text-[#22D3EE] shadow-xs border border-slate-200/80 dark:border-[#203653]'
              : 'text-slate-600 dark:text-[#A9BCD8] hover:text-slate-900 dark:hover:text-[#EAF2FF]'
          }`}
          aria-selected={activeTab === 'parameters'}
          role="tab"
        >
          <Sliders className="w-4 h-4" />
          <span>Policy Configuration</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('simulator')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'simulator'
              ? 'bg-white dark:bg-[#10213D] text-indigo-600 dark:text-[#22D3EE] shadow-xs border border-slate-200/80 dark:border-[#203653]'
              : 'text-slate-600 dark:text-[#A9BCD8] hover:text-slate-900 dark:hover:text-[#EAF2FF]'
          }`}
          aria-selected={activeTab === 'simulator'}
          role="tab"
        >
          <PlayCircle className="w-4 h-4" />
          <span>Policy Simulator</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 dark:bg-[#22D3EE]/20 text-indigo-600 dark:text-[#22D3EE] font-bold">
            Sandbox
          </span>
        </button>
      </div>

      {/* Tab 1: Policy Parameters Form */}
      {activeTab === 'parameters' && (
        <div className="space-y-6">
          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{success}</span>
              </div>
              <button onClick={() => setSuccess(null)} className="font-bold cursor-pointer">×</button>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="leading-relaxed">{error}</span>
              </div>
              <button onClick={() => setError(null)} className="font-bold cursor-pointer">×</button>
            </div>
          )}

          <form onSubmit={handleSavePolicy} className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-[#203653]">
              <Sliders className="w-5 h-5 text-indigo-600 dark:text-[#3B82F6]" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#EAF2FF]">
                Active Organizational Rules
              </h3>
              {policy && (
                <span className="ml-auto text-[11px] text-slate-400 dark:text-[#7E93B5] font-mono">
                  Last updated: {new Date(policy.updated_at).toLocaleString()}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                  Policy Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.policy_name}
                  onChange={(e) => setFormData({ ...formData, policy_name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
                />
              </div>

              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                    Work Start Time
                  </label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={formData.work_start_time}
                    onChange={(e) => setFormData({ ...formData, work_start_time: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                    Work End Time
                  </label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={formData.work_end_time}
                    onChange={(e) => setFormData({ ...formData, work_end_time: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                  Late Grace (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  required
                  value={formData.late_grace_minutes}
                  onChange={(e) => setFormData({ ...formData, late_grace_minutes: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
                />
                <p className="text-[10px] text-slate-400 dark:text-[#7E93B5] mt-1">Arrivals within grace stay PRESENT.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                  Early Departure Grace (Min)
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  required
                  value={formData.early_departure_grace_minutes}
                  onChange={(e) => setFormData({ ...formData, early_departure_grace_minutes: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
                />
                <p className="text-[10px] text-slate-400 dark:text-[#7E93B5] mt-1">Leaving before cutoff is early departure.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                  Half-Day Min (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  step="0.5"
                  required
                  value={formData.half_day_hours_threshold}
                  onChange={(e) => setFormData({ ...formData, half_day_hours_threshold: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
                />
                <p className="text-[10px] text-slate-400 dark:text-[#7E93B5] mt-1">Less duration marks as HALF_DAY.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                  Full-Day Min (Hours)
                </label>
                <input
                  type="number"
                  min="4"
                  max="16"
                  step="0.5"
                  required
                  value={formData.full_day_hours_threshold}
                  onChange={(e) => setFormData({ ...formData, full_day_hours_threshold: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
                />
                <p className="text-[10px] text-slate-400 dark:text-[#7E93B5] mt-1">Full working day benchmark.</p>
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-[#203653]">
              <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-[#10213D]/60 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.auto_detect_late_arrival}
                  onChange={(e) => setFormData({ ...formData, auto_detect_late_arrival: e.target.checked })}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-[#EAF2FF]">
                    Automatic Late Arrival Detection
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#7E93B5]">
                    Automatically mark check-ins as LATE if past work start time plus grace period.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-[#10213D]/60 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.auto_detect_early_departure}
                  onChange={(e) => setFormData({ ...formData, auto_detect_early_departure: e.target.checked })}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-[#EAF2FF]">
                    Automatic Early Departure Calculation
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#7E93B5]">
                    Calculate total shift hours on check-out and flag half-day duration violations.
                  </p>
                </div>
              </label>
            </div>

            {/* Reason for Policy Update */}
            <div className="pt-2 border-t border-slate-100 dark:border-[#203653]">
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                Reason for Policy Change (Recorded in Persistent Audit Log)
              </label>
              <input
                type="text"
                value={updateReason}
                onChange={(e) => setUpdateReason(e.target.value)}
                placeholder="e.g., Seasonal grace period adjustment, company-wide working hours alignment..."
                className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#EAF2FF] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-[#203653]">
              <button
                type="button"
                onClick={() => setTab('simulator')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-[#22D3EE] hover:underline cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Simulate rules in Policy Simulator →</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-[#3B82F6] dark:hover:bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving Changes...' : 'Save Policy Parameters'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Dedicated Policy Simulator Sandbox */}
      {activeTab === 'simulator' && (
        <PolicySimulator policy={policy} />
      )}
    </div>
  );
};
