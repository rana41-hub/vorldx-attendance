import React from 'react';
import { ExternalLink, Clock, Server, Palette } from 'lucide-react';
import type { SystemHealth } from '../../types';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

interface SettingsPageProps {
  health: SystemHealth;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ health }) => {
  const apiUrl =
    (import.meta.env.VITE_API_BASE_URL as string) || 'http://127.0.0.1:8000';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#EAF2FF]">
          System Configuration & Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-0.5">
          Platform parameters, attendance policies, theme customization, and API telemetry
        </p>
      </div>

      {/* Interface Theme Customization Card */}
      <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#203653]">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-indigo-600 dark:text-[#22D3EE]" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAF2FF]">
                Interface Appearance
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

      {/* Backend & API Docs Card */}
      <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#203653]">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-indigo-600 dark:text-[#3B82F6]" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAF2FF]">
                Shared FastAPI Backend
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#7E93B5]">Service address and documentation</p>
            </div>
          </div>

          <a
            href={`${apiUrl}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-[#164E63]/30 text-indigo-700 dark:text-[#22D3EE] text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-[#164E63]/50 border border-indigo-200 dark:border-[#164E63] transition-colors"
          >
            <span>OpenAPI Docs</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] space-y-1">
            <span className="text-slate-500 dark:text-[#7E93B5]">API Base URL</span>
            <div className="font-mono text-slate-900 dark:text-[#EAF2FF] font-medium">{apiUrl}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] space-y-1">
            <span className="text-slate-500 dark:text-[#7E93B5]">Database Driver</span>
            <div className="font-mono text-slate-900 dark:text-[#EAF2FF] font-medium">PostgreSQL 18 (Psycopg 3)</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] space-y-1">
            <span className="text-slate-500 dark:text-[#7E93B5]">Database Health</span>
            <div className={`font-semibold ${health.databaseConnected ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {health.databaseConnected ? 'Connected (Verified query)' : 'Disconnected'}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#081426] border border-slate-100 dark:border-[#203653] space-y-1">
            <span className="text-slate-500 dark:text-[#7E93B5]">Migrations Engine</span>
            <div className="font-mono text-slate-900 dark:text-[#EAF2FF] font-medium">Alembic 1.20 (dd512940ae96)</div>
          </div>
        </div>
      </div>

      {/* Policy Foundation */}
      <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-6 shadow-xs">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-[#203653]">
          <Clock className="w-5 h-5 text-indigo-600 dark:text-[#3B82F6]" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-[#EAF2FF]">
              Attendance Policy Parameters
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#7E93B5]">Configurable organizational policy defaults</p>
          </div>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-[#203653]">
            <div>
              <div className="font-medium text-slate-900 dark:text-[#EAF2FF]">Standard Work Day</div>
              <div className="text-[11px] text-slate-500 dark:text-[#7E93B5]">Default expected shift duration</div>
            </div>
            <span className="font-mono px-2.5 py-1 bg-slate-100 dark:bg-[#081426] rounded text-slate-800 dark:text-[#EAF2FF] border border-transparent dark:border-[#203653]">09:00 — 17:00 (8 Hours)</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-[#203653]">
            <div>
              <div className="font-medium text-slate-900 dark:text-[#EAF2FF]">Grace Period for Late Arrival</div>
              <div className="text-[11px] text-slate-500 dark:text-[#7E93B5]">Tolerance before marking check-in as LATE</div>
            </div>
            <span className="font-mono px-2.5 py-1 bg-slate-100 dark:bg-[#081426] rounded text-slate-800 dark:text-[#EAF2FF] border border-transparent dark:border-[#203653]">15 Minutes</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-[#203653]">
            <div>
              <div className="font-medium text-slate-900 dark:text-[#EAF2FF]">QR Challenge Expiration</div>
              <div className="text-[11px] text-slate-500 dark:text-[#7E93B5]">Dynamic office display QR token lifetime</div>
            </div>
            <span className="font-mono px-2.5 py-1 bg-slate-100 dark:bg-[#081426] rounded text-slate-800 dark:text-[#EAF2FF] border border-transparent dark:border-[#203653]">18 Seconds</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium text-slate-900 dark:text-[#EAF2FF]">Same-Day Duplicate Prevention</div>
              <div className="text-[11px] text-slate-500 dark:text-[#7E93B5]">Unique constraint on (employee_id, attendance_date)</div>
            </div>
            <span className="font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50">
              Enforced at DB Level
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
