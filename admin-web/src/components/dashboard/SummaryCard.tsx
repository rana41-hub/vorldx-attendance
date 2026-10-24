import React from 'react';

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = 'bg-slate-100 text-slate-700',
}) => {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {title}
            </span>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </div>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${iconBgColor}`}>
          {icon}
        </div>
      </div>
      {subtitle && (
        <div className="mt-3 flex items-center text-xs text-slate-500">
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  );
};
