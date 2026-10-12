import React from 'react';
import { BarChart2, Download, FileSpreadsheet, Shield } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Attendance Reports & Analytics
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Generate monthly summaries, department audits, and compliance exports
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center max-w-2xl mx-auto shadow-xs">
        <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
          <BarChart2 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          Reporting & Audit Pipeline
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
          Day 1 establishes core attendance collection in PostgreSQL. In Day 2, automated scheduled reporting, monthly payroll summaries, and Excel/PDF export pipelines will be integrated.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-6">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 font-medium text-xs text-slate-800 mb-1">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Monthly Timesheets
            </div>
            <p className="text-[11px] text-slate-500">
              Aggregated daily hours, overtime, and leave deductions for payroll.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 font-medium text-xs text-slate-800 mb-1">
              <Shield className="w-4 h-4 text-indigo-600" />
              Security Audit Logs
            </div>
            <p className="text-[11px] text-slate-500">
              Cryptographic verification logs of QR scan challenges and anomalies.
            </p>
          </div>
        </div>

        <button
          disabled
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed border border-slate-200"
        >
          <Download className="w-3.5 h-3.5" />
          Export Reports (Scheduled for Day 2)
        </button>
      </div>
    </div>
  );
};
