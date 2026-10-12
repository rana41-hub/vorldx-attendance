import React from 'react';
import { Info } from 'lucide-react';

interface WeeklyStat {
  day: string;
  presentRate: number;
  totalPresent: number;
  totalLate: number;
}

const SAMPLE_WEEKLY_STATS: WeeklyStat[] = [
  { day: 'Mon', presentRate: 94, totalPresent: 45, totalLate: 2 },
  { day: 'Tue', presentRate: 98, totalPresent: 47, totalLate: 1 },
  { day: 'Wed', presentRate: 92, totalPresent: 44, totalLate: 3 },
  { day: 'Thu', presentRate: 96, totalPresent: 46, totalLate: 1 },
  { day: 'Fri', presentRate: 90, totalPresent: 43, totalLate: 4 },
];

export const AttendanceChart: React.FC = () => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              Weekly Attendance Trends
            </h3>
            <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-800 flex items-center gap-1">
              <Info className="w-3 h-3" /> DEMO DATA
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Overview of daily office presence and check-in punctuality
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600" />
            <span>On-time Presence</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-400" />
            <span>Late Check-in</span>
          </div>
        </div>
      </div>

      {/* Visual Chart Bars */}
      <div className="mt-6 grid grid-cols-5 gap-3 sm:gap-6 pt-4">
        {SAMPLE_WEEKLY_STATS.map((item) => (
          <div key={item.day} className="flex flex-col items-center gap-2">
            <div className="text-[11px] font-semibold text-slate-700">
              {item.presentRate}%
            </div>
            <div className="w-full max-w-[48px] h-36 bg-slate-100 rounded-t-md relative flex flex-col justify-end overflow-hidden">
              <div
                className="w-full bg-indigo-600 transition-all duration-500 rounded-t-sm"
                style={{ height: `${item.presentRate}%` }}
              />
              <div
                className="w-full bg-amber-400 transition-all duration-500"
                style={{ height: `${(item.totalLate / 50) * 100}%` }}
              />
            </div>
            <div className="text-xs font-medium text-slate-500">{item.day}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>Average Weekly Attendance: <strong className="text-slate-800">94.0%</strong></span>
        <span>Average Punctuality: <strong className="text-slate-800">95.6%</strong></span>
      </div>
    </div>
  );
};
