import React from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { SystemHealth } from '../../types';

interface HealthIndicatorProps {
  health: SystemHealth;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const HealthIndicator: React.FC<HealthIndicatorProps> = ({
  health,
  onRefresh,
  isLoading = false,
}) => {
  const getBadgeContent = () => {
    switch (health.state) {
      case 'connected':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-[#34D399]" />,
          dot: 'bg-emerald-500 dark:bg-[#34D399]',
          border: 'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-[#34D399]',
          label: 'Backend & DB Online',
        };
      case 'degraded':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-[#FBBF24]" />,
          dot: 'bg-amber-500 dark:bg-[#FBBF24]',
          border: 'border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-[#FBBF24]',
          label: 'Database Degraded',
        };
      case 'disconnected':
        return {
          icon: <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-[#FB7185]" />,
          dot: 'bg-rose-500 dark:bg-[#FB7185]',
          border: 'border-rose-200 bg-rose-50/70 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-[#FB7185]',
          label: 'Backend Offline',
        };
      default:
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 text-slate-500 dark:text-[#7E93B5] animate-spin" />,
          dot: 'bg-slate-400 dark:bg-[#7E93B5]',
          border: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-[#203653] dark:bg-[#0C1930] dark:text-[#A9BCD8]',
          label: 'Checking status...',
        };
    }
  };

  const current = getBadgeContent();

  return (
    <div className="flex items-center gap-2">
      <div
        className={`inline-flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border text-xs font-semibold transition-colors ${current.border}`}
        title={`Status: ${health.backendMessage || current.label}${health.latencyMs ? ` (${health.latencyMs}ms)` : ''}`}
      >
        <span className="relative flex h-2 w-2">
          {health.state === 'connected' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 dark:bg-[#34D399] opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${current.dot}`} />
        </span>
        <span className="hidden sm:inline">{current.label}</span>
        {health.latencyMs !== undefined && health.state === 'connected' && (
          <span className="text-[10px] text-emerald-600/80 dark:text-[#34D399]/80 font-mono hidden md:inline">
            {health.latencyMs}ms
          </span>
        )}
      </div>

      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-[#7E93B5] dark:hover:text-[#EAF2FF] dark:hover:bg-[#10213D] rounded-md transition-colors disabled:opacity-50"
          title="Re-check backend and database health"
          aria-label="Refresh connection health"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );
};
