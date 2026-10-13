import React from 'react';
import type { DailyTrendItem } from '../../types';

interface AttendanceChartProps {
  trends: DailyTrendItem[];
  isLoading?: boolean;
}

export const AttendanceChart: React.FC<AttendanceChartProps> = ({ trends, isLoading }) => {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col items-center justify-center min-h-[260px]">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-xs text-slate-500 font-medium">Loading attendance trends...</p>
      </div>
    );
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col items-center justify-center min-h-[260px] text-center">
        <p className="text-sm font-semibold text-slate-700">No trend data available</p>
        <p className="text-xs text-slate-400 mt-1">Recorded daily check-ins will populate this timeline.</p>
      </div>
    );
  }

  // Calculate stats
  const totalDays = trends.length;
  const totalPresentCount = trends.reduce((acc, t) => acc + t.present, 0);
  const totalLateCount = trends.reduce((acc, t) => acc + t.late, 0);
  const totalActiveHeadcount = trends[0]?.total_active || 1;
  const maxPossible = totalActiveHeadcount * totalDays;
  const avgAttendanceRate = maxPossible > 0 ? ((totalPresentCount / maxPossible) * 100).toFixed(1) : '0.0';
  const onTimePercentage = totalPresentCount > 0 ? (((totalPresentCount - totalLateCount) / totalPresentCount) * 100).toFixed(1) : '100.0';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Attendance Trends & Punctuality
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Day-by-day attendance trends from PostgreSQL records ({totalDays} days)
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600" />
            <span>Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-400" />
            <span>Late</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
            <span>WFH</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-sky-400" />
            <span>Leave</span>
          </div>
        </div>
      </div>

      {/* Visual Dynamic Chart Bars */}
      <div className="mt-6 flex items-end justify-between gap-2 sm:gap-3 pt-4 overflow-x-auto min-h-[170px] pb-2">
        {trends.map((item) => {
          const maxBase = Math.max(item.total_active, 1);
          const presentHeight = Math.min(100, Math.round((item.present / maxBase) * 100));
          const wfhHeight = Math.min(100, Math.round((item.wfh / maxBase) * 100));
          const dateStr = new Date(item.date).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'numeric',
            day: 'numeric',
          });

          return (
            <div key={item.date} className="flex-1 min-w-[44px] flex flex-col items-center gap-2 group">
              <div className="text-[10px] font-semibold text-slate-600 opacity-80 group-hover:opacity-100 transition-opacity">
                {item.present}
              </div>
              <div className="w-full max-w-[42px] h-32 bg-slate-100 rounded-t-md relative flex flex-col justify-end overflow-hidden">
                {item.absent > 0 && (
                  <div
                    className="w-full bg-slate-200/60"
                    style={{ height: `${Math.round((item.absent / maxBase) * 100)}%` }}
                    title={`Absent: ${item.absent}`}
                  />
                )}
                {item.wfh > 0 && (
                  <div
                    className="w-full bg-emerald-500 transition-all duration-300"
                    style={{ height: `${wfhHeight}%` }}
                    title={`WFH: ${item.wfh}`}
                  />
                )}
                <div
                  className="w-full bg-indigo-600 transition-all duration-300 rounded-t-xs"
                  style={{ height: `${presentHeight}%` }}
                  title={`Present: ${item.present} (Late: ${item.late})`}
                />
              </div>
              <div className="text-[10px] font-medium text-slate-500 whitespace-nowrap">
                {dateStr}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span>Active Headcount: <strong className="text-slate-800">{totalActiveHeadcount}</strong></span>
        <span>Average Attendance Rate: <strong className="text-slate-800">{avgAttendanceRate}%</strong></span>
        <span>On-Time Punctuality: <strong className="text-slate-800">{onTimePercentage}%</strong></span>
      </div>
    </div>
  );
};
