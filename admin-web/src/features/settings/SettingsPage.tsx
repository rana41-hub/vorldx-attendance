import React from 'react';
import { ExternalLink, Clock, Server } from 'lucide-react';
import type { SystemHealth } from '../../types';

interface SettingsPageProps {
  health: SystemHealth;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ health }) => {
  const apiUrl =
    (import.meta.env.VITE_API_BASE_URL as string) || 'http://127.0.0.1:8000';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          System Configuration & Settings
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Platform parameters, attendance policies, and API telemetry
        </p>
      </div>

      {/* Backend & API Docs Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Shared FastAPI Backend
              </h3>
              <p className="text-xs text-slate-500">Service address and documentation</p>
            </div>
          </div>

          <a
            href={`${apiUrl}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 border border-indigo-200 transition-colors"
          >
            <span>OpenAPI Docs</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-500">API Base URL</span>
            <div className="font-mono text-slate-900 font-medium">{apiUrl}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-500">Database Driver</span>
            <div className="font-mono text-slate-900 font-medium">PostgreSQL 18 (Psycopg 3)</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-500">Database Health</span>
            <div className={`font-semibold ${health.databaseConnected ? 'text-emerald-700' : 'text-rose-600'}`}>
              {health.databaseConnected ? 'Connected (Verified query)' : 'Disconnected'}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-500">Migrations Engine</span>
            <div className="font-mono text-slate-900 font-medium">Alembic 1.20 (dd512940ae96)</div>
          </div>
        </div>
      </div>

      {/* Policy Foundation */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
          <Clock className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Attendance Policy Parameters
            </h3>
            <p className="text-xs text-slate-500">Configurable policy defaults (Day 1 schema)</p>
          </div>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <div className="font-medium text-slate-900">Standard Work Day</div>
              <div className="text-[11px] text-slate-500">Default expected shift duration</div>
            </div>
            <span className="font-mono px-2.5 py-1 bg-slate-100 rounded text-slate-800">09:00 — 17:00 (8 Hours)</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <div className="font-medium text-slate-900">Grace Period for Late Arrival</div>
              <div className="text-[11px] text-slate-500">Tolerance before marking check-in as LATE</div>
            </div>
            <span className="font-mono px-2.5 py-1 bg-slate-100 rounded text-slate-800">15 Minutes</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <div className="font-medium text-slate-900">QR Challenge Expiration</div>
              <div className="text-[11px] text-slate-500">Dynamic office display QR token lifetime</div>
            </div>
            <span className="font-mono px-2.5 py-1 bg-slate-100 rounded text-slate-800">30 Seconds</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium text-slate-900">Same-Day Duplicate Prevention</div>
              <div className="text-[11px] text-slate-500">Unique constraint on (employee_id, attendance_date)</div>
            </div>
            <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Enforced at DB Level
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
