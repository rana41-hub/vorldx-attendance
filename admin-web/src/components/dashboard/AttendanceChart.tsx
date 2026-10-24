import React, { useState } from 'react';
import type { DailyTrendItem } from '../../types';

interface AttendanceChartProps {
  trends: DailyTrendItem[];
  isLoading?: boolean;
}

type ScaleMode = 'activity' | 'roster';

export const AttendanceChart: React.FC<AttendanceChartProps> = ({ trends, isLoading }) => {
  const [scaleMode, setScaleMode] = useState<ScaleMode>('activity');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-6 shadow-xs dark:shadow-[0_4px_20px_-2px_rgba(5,11,24,0.7)] flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-2 border-indigo-600 dark:border-[#3B82F6] border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-xs text-slate-500 dark:text-[#7E93B5] font-medium">Loading verified attendance trends...</p>
      </div>
    );
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-8 shadow-xs dark:shadow-[0_4px_20px_-2px_rgba(5,11,24,0.7)] flex flex-col items-center justify-center min-h-[300px] text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-[#10213D] flex items-center justify-center text-slate-400 dark:text-[#7E93B5] mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h4 className="text-sm font-bold text-slate-700 dark:text-[#EAF2FF]">No Trend Data Available</h4>
        <p className="text-xs text-slate-400 dark:text-[#7E93B5] mt-1 max-w-sm">
          Attendance records will automatically build daily historical trends when employees check in via kiosk or submit leave/WFH requests.
        </p>
      </div>
    );
  }

  // Calculate statistics from actual API data
  const totalDays = trends.length;
  const totalPresentCount = trends.reduce((acc, t) => acc + t.present, 0);
  const totalLateCount = trends.reduce((acc, t) => acc + t.late, 0);
  const totalWfhCount = trends.reduce((acc, t) => acc + t.wfh, 0);
  const totalLeaveCount = trends.reduce((acc, t) => acc + (t.on_leave || 0), 0);
  const totalActiveHeadcount = trends[0]?.total_active || 1;

  // Average attendance rate across the period
  const totalEligible = trends.reduce((acc, t) => acc + Math.max(1, t.total_active - (t.on_leave || 0)), 0);
  const avgAttendanceRate = totalEligible > 0 ? ((totalPresentCount / totalEligible) * 100).toFixed(1) : '0.0';
  const onTimePercentage =
    totalPresentCount > 0 ? (((totalPresentCount - totalLateCount) / totalPresentCount) * 100).toFixed(1) : '100.0';

  // Date range formatted
  const firstDateStr = new Date(trends[0].date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const lastDateStr = new Date(trends[trends.length - 1].date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Calculate dynamic scale ceilings
  const maxDailyActivity = Math.max(
    ...trends.map((t) => t.present + t.wfh + (t.on_leave || 0)),
    20
  );
  // Round up to nice round number for Y-axis (e.g. 50, 100, 150, 200, 250)
  const activityCeiling = Math.ceil(maxDailyActivity / 25) * 25 || 50;
  const rosterCeiling = Math.max(totalActiveHeadcount, 100);

  const activeCeiling = scaleMode === 'activity' ? activityCeiling : rosterCeiling;

  // 4 Y-axis ticks
  const yTicks = [
    activeCeiling,
    Math.round(activeCeiling * 0.75),
    Math.round(activeCeiling * 0.5),
    Math.round(activeCeiling * 0.25),
    0,
  ];

  const hoveredItem = hoveredIndex !== null ? trends[hoveredIndex] : null;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-5 sm:p-6 shadow-xs dark:shadow-[0_4px_20px_-2px_rgba(5,11,24,0.7)] transition-all duration-200">
      {/* Header with Title, Period, and Scale Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-[#203653]/70">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-900 dark:text-[#EAF2FF]">
              Attendance Trends & Telemetry
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-[#3B82F6]/10 text-indigo-600 dark:text-[#60A5FA] border border-indigo-200 dark:border-[#3B82F6]/30">
              {totalDays} Days ({firstDateStr} – {lastDateStr})
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-0.5">
            Verified presence, remote work, and approved leave records from PostgreSQL database
          </p>
        </div>

        {/* Scale Mode Switcher & Legend */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Scale mode toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-[#081426] p-0.5 rounded-xl border border-slate-200 dark:border-[#203653]">
            <button
              onClick={() => setScaleMode('activity')}
              className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg transition-all ${
                scaleMode === 'activity'
                  ? 'bg-white dark:bg-[#10213D] text-indigo-600 dark:text-[#22D3EE] shadow-xs'
                  : 'text-slate-600 dark:text-[#7E93B5] hover:text-slate-900 dark:hover:text-[#EAF2FF]'
              }`}
              title="Scale optimized to daily active participants so small values remain clearly visible"
            >
              <span className="sm:hidden">Activity</span>
              <span className="hidden sm:inline">Activity Scale (Max {activityCeiling})</span>
            </button>
            <button
              onClick={() => setScaleMode('roster')}
              className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg transition-all ${
                scaleMode === 'roster'
                  ? 'bg-white dark:bg-[#10213D] text-indigo-600 dark:text-[#22D3EE] shadow-xs'
                  : 'text-slate-600 dark:text-[#7E93B5] hover:text-slate-900 dark:hover:text-[#EAF2FF]'
              }`}
              title="Scale against total registered workforce with guaranteed minimum bar visibility"
            >
              <span className="sm:hidden">Roster ({totalActiveHeadcount})</span>
              <span className="hidden sm:inline">Roster Scale ({totalActiveHeadcount})</span>
            </button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600 dark:text-[#A9BCD8]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 dark:bg-[#3B82F6] dark:shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
              <span>Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 dark:bg-[#FBBF24]" />
              <span>Late</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 dark:bg-[#34D399]" />
              <span>WFH</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-cyan-400 dark:bg-[#22D3EE]" />
              <span>Leave</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Tooltip Callout (Fixed when hovering a bar) */}
      <div className="min-h-[46px] my-3">
        {hoveredItem ? (
          <div className="p-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-[#081426] border border-indigo-200 dark:border-[#22D3EE]/30 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-[#EAF2FF]">
                {new Date(hoveredItem.date).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-[#7E93B5]">•</span>
              <span className="text-indigo-600 dark:text-[#60A5FA] font-semibold">
                Present: <strong>{hoveredItem.present}</strong>
                {hoveredItem.late > 0 && <span className="text-amber-500 dark:text-[#FBBF24] ml-1">({hoveredItem.late} late)</span>}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-[#7E93B5]">•</span>
              <span className="text-emerald-600 dark:text-[#34D399] font-semibold">
                WFH: <strong>{hoveredItem.wfh}</strong>
              </span>
              <span className="text-[11px] text-slate-400 dark:text-[#7E93B5]">•</span>
              <span className="text-cyan-600 dark:text-[#22D3EE] font-semibold">
                Leave: <strong>{hoveredItem.on_leave || 0}</strong>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500 dark:text-[#7E93B5]">
                Absent/Unaccounted: <strong className="text-slate-700 dark:text-[#EAF2FF]">{hoveredItem.absent}</strong>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-[#3B82F6]/20 text-indigo-700 dark:text-[#38BDF8]">
                {Math.max(1, hoveredItem.total_active - (hoveredItem.on_leave || 0)) > 0
                  ? ((hoveredItem.present / Math.max(1, hoveredItem.total_active - (hoveredItem.on_leave || 0))) * 100).toFixed(1)
                  : 0}% Rate
              </span>
            </div>
          </div>
        ) : (
          <div className="p-2.5 px-3.5 rounded-xl bg-slate-50/60 dark:bg-[#081426]/50 border border-slate-100 dark:border-[#203653]/40 flex items-center justify-between text-xs text-slate-400 dark:text-[#7E93B5]">
            <span>Hover over any daily column to inspect exact presence, punctuality, and category breakdown.</span>
            <span className="font-mono text-[11px] hidden sm:inline">Baseline Headcount: {totalActiveHeadcount}</span>
          </div>
        )}
      </div>

      {/* Main Chart Area with Y-axis & Reference Grid */}
      <div className="relative flex pt-2 pb-2">
        {/* Y-Axis scale labels */}
        <div className="w-10 sm:w-14 shrink-0 flex flex-col justify-between text-right pr-1.5 sm:pr-2 text-[9px] sm:text-[10px] font-mono font-medium text-slate-400 dark:text-[#7E93B5] select-none h-44 pb-7">
          {yTicks.map((tick, idx) => (
            <span key={idx} className="leading-none">
              {scaleMode === 'roster' && tick > 999 ? `${(tick / 1000).toFixed(1)}k` : tick}
            </span>
          ))}
        </div>

        {/* Chart Canvas & Bars Container */}
        <div className="relative flex-1 h-44 pb-7 overflow-hidden">
          {/* Background horizontal grid lines */}
          <div className="absolute inset-x-0 top-0 bottom-7 flex flex-col justify-between pointer-events-none">
            <div className="w-full border-b border-dashed border-slate-200 dark:border-[#203653]/50" />
            <div className="w-full border-b border-dashed border-slate-100 dark:border-[#203653]/30" />
            <div className="w-full border-b border-dashed border-slate-100 dark:border-[#203653]/30" />
            <div className="w-full border-b border-dashed border-slate-100 dark:border-[#203653]/30" />
            <div className="w-full border-b border-slate-200 dark:border-[#203653]" />
          </div>

          {/* Columns */}
          <div className="relative h-full flex items-end justify-between gap-1 sm:gap-4 px-0.5 sm:px-2 z-10">
            {trends.map((item, index) => {
              // Exact proportions relative to active ceiling
              const ceiling = activeCeiling;
              const dateObj = new Date(item.date);
              const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
              const dayNum = dateObj.getDate();
              const isHovered = hoveredIndex === index;

              // Ensure low values (e.g. 1, 24) have visible minimum height (4px) in any scale mode
              const calcBarHeightPx = (val: number) => {
                if (val <= 0) return 0;
                const ratio = val / ceiling;
                const px = ratio * 140; // 140px is chart body height
                // Guarantee minimum 4px for non-zero values so 1 or 24 is never invisible
                return Math.max(4, Math.min(140, Math.round(px)));
              };

              const presentPx = calcBarHeightPx(item.present);
              const latePx = calcBarHeightPx(item.late);
              const wfhPx = calcBarHeightPx(item.wfh);
              const leavePx = calcBarHeightPx(item.on_leave || 0);

              return (
                <div
                  key={item.date}
                  className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer min-w-0"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => setHoveredIndex(index)}
                >
                  {/* Top value badge */}
                  <div
                    className={`text-[9px] sm:text-[10px] font-bold font-mono transition-all duration-150 mb-1 ${
                      isHovered
                        ? 'text-indigo-600 dark:text-[#22D3EE] scale-110 font-extrabold'
                        : 'text-slate-500 dark:text-[#7E93B5] group-hover:text-slate-800 dark:group-hover:text-[#EAF2FF]'
                    }`}
                  >
                    {item.present}
                  </div>

                  {/* Segmented Stacked Bar Container */}
                  <div
                    className={`w-full max-w-[26px] xs:max-w-[34px] sm:max-w-[46px] bg-slate-100 dark:bg-[#081426] border rounded-t-lg relative flex flex-col justify-end overflow-hidden transition-all duration-200 ${
                      isHovered
                        ? 'border-indigo-400 dark:border-[#22D3EE] shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                        : 'border-slate-200 dark:border-[#203653]/70 group-hover:border-slate-300 dark:group-hover:border-[#38BDF8]/40'
                    }`}
                    style={{ height: '140px' }}
                  >
                    {/* Approved Leave segment (top layer) */}
                    {leavePx > 0 && (
                      <div
                        className="w-full bg-cyan-400 dark:bg-[#22D3EE] transition-all duration-300"
                        style={{ height: `${leavePx}px` }}
                        title={`Leave: ${item.on_leave || 0}`}
                      />
                    )}

                    {/* WFH segment */}
                    {wfhPx > 0 && (
                      <div
                        className="w-full bg-emerald-500 dark:bg-[#34D399] transition-all duration-300"
                        style={{ height: `${wfhPx}px` }}
                        title={`WFH: ${item.wfh}`}
                      />
                    )}

                    {/* Late segment (if any) */}
                    {latePx > 0 && (
                      <div
                        className="w-full bg-amber-400 dark:bg-[#FBBF24] transition-all duration-300"
                        style={{ height: `${latePx}px` }}
                        title={`Late: ${item.late}`}
                      />
                    )}

                    {/* On-Time Present segment (base) */}
                    {presentPx > 0 && (
                      <div
                        className="w-full bg-indigo-600 dark:bg-[#3B82F6] dark:shadow-[0_0_8px_rgba(59,130,246,0.4)] transition-all duration-300 rounded-t-xs"
                        style={{ height: `${Math.max(2, presentPx - latePx)}px` }}
                        title={`Present On-Time: ${item.present - item.late}`}
                      />
                    )}
                  </div>

                  {/* X-Axis Date Label */}
                  <div
                    className={`mt-2 text-[10px] font-semibold whitespace-nowrap transition-colors ${
                      isHovered
                        ? 'text-indigo-600 dark:text-[#22D3EE] font-bold'
                        : 'text-slate-500 dark:text-[#7E93B5] group-hover:text-slate-800 dark:group-hover:text-[#EAF2FF]'
                    }`}
                  >
                    <span>{dayName} </span>
                    <span className="font-mono">{dayNum}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary Footer Bar with Exact Baseline Ratios */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-[#203653]/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-[#7E93B5]">
        <div className="flex flex-wrap items-center gap-4">
          <span>
            Active Headcount: <strong className="text-slate-800 dark:text-[#EAF2FF] font-mono">{totalActiveHeadcount}</strong>
          </span>
          <span>
            7-Day Present Total: <strong className="text-slate-800 dark:text-[#EAF2FF] font-mono">{totalPresentCount}</strong>
          </span>
          <span>
            7-Day WFH Total: <strong className="text-slate-800 dark:text-[#EAF2FF] font-mono">{totalWfhCount}</strong>
          </span>
          <span>
            7-Day Approved Leave: <strong className="text-slate-800 dark:text-[#EAF2FF] font-mono">{totalLeaveCount}</strong>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            Avg Attendance Rate: <strong className="text-slate-800 dark:text-[#EAF2FF] font-mono">{avgAttendanceRate}%</strong>
          </span>
          <span>
            On-Time Punctuality: <strong className="text-slate-800 dark:text-[#EAF2FF] font-mono">{onTimePercentage}%</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

