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
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
          dot: 'bg-emerald-500',
          border: 'border-emerald-200 bg-emerald-50/70',
          text: 'text-emerald-800',
          label: 'Backend & DB Online',
        };
      case 'degraded':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
          dot: 'bg-amber-500',
          border: 'border-amber-200 bg-amber-50/70',
          text: 'text-amber-800',
          label: 'Database Degraded',
        };
      case 'disconnected':
        return {
          icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
          dot: 'bg-rose-500',
          border: 'border-rose-200 bg-rose-50/70',
          text: 'text-rose-800',
          label: 'Backend Offline',
        };
      default:
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />,
          dot: 'bg-slate-400',
          border: 'border-slate-200 bg-slate-50',
          text: 'text-slate-700',
          label: 'Checking status...',
        };
    }
  };

  const current = getBadgeContent();

  return (
    <div className="flex items-center gap-2">
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${current.border} ${current.text}`}
        title={`Status: ${health.backendMessage || current.label}${health.latencyMs ? ` (${health.latencyMs}ms)` : ''}`}
      >
        <span className="relative flex h-2 w-2">
          {health.state === 'connected' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${current.dot}`} />
        </span>
        <span className="hidden sm:inline">{current.label}</span>
        {health.latencyMs !== undefined && health.state === 'connected' && (
          <span className="text-[10px] text-emerald-600/80 font-mono hidden md:inline">
            {health.latencyMs}ms
          </span>
        )}
      </div>

      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
          title="Re-check backend and database health"
          aria-label="Refresh connection health"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );
};
