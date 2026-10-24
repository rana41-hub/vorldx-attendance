import React from 'react';

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor?: string;
  badge?: string;
  glow?: 'blue' | 'cyan' | 'none';
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = 'bg-slate-100 text-slate-700 dark:bg-[#10213D] dark:text-[#60A5FA]',
  badge,
  glow = 'none',
}) => {
  const glowClass =
    glow === 'cyan'
      ? 'dark:shadow-[0_0_20px_-3px_rgba(34,211,238,0.15)] dark:border-[#164E63]'
      : glow === 'blue'
      ? 'dark:shadow-[0_0_20px_-3px_rgba(59,130,246,0.2)] dark:border-[#203653]'
      : '';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-5 shadow-xs dark:shadow-[0_4px_20px_-2px_rgba(5,11,24,0.7)] transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-[#38BDF8]/40 min-h-[142px] flex flex-col justify-between ${glowClass}`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#7E93B5]">
                {title}
              </span>
              {badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 dark:bg-[#22D3EE]/15 dark:text-[#22D3EE] border border-indigo-200 dark:border-[#22D3EE]/30">
                  {badge}
                </span>
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-[#EAF2FF]">
              {value}
            </div>
          </div>
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors shadow-xs ${iconBgColor}`}
          >
            {icon}
          </div>
        </div>
      </div>
      {subtitle && (
        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-[#203653]/60 flex items-center text-xs font-medium text-slate-500 dark:text-[#A9BCD8]">
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  );
};

