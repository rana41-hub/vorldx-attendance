import React from 'react';

export type BadgeStatus =
  | 'PRESENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'ABSENT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'INCOMPLETE'
  | 'ACTIVATED'
  | 'DEACTIVATED';

interface StatusBadgeProps {
  status: BadgeStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<
  BadgeStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  PRESENT: {
    label: 'Present',
    bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30',
    text: 'text-emerald-700 dark:text-[#34D399]',
    dot: 'bg-emerald-500 dark:bg-[#34D399]',
  },
  LATE: {
    label: 'Late Arrival',
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30',
    text: 'text-amber-700 dark:text-[#FBBF24]',
    dot: 'bg-amber-500 dark:bg-[#FBBF24]',
  },
  HALF_DAY: {
    label: 'Half Day',
    bg: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-500/30',
    text: 'text-cyan-700 dark:text-[#22D3EE]',
    dot: 'bg-cyan-500 dark:bg-[#22D3EE]',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-500/15 dark:border-blue-500/30',
    text: 'text-blue-700 dark:text-[#60A5FA]',
    dot: 'bg-blue-500 dark:bg-[#3B82F6]',
  },
  INCOMPLETE: {
    label: 'Incomplete',
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30',
    text: 'text-amber-700 dark:text-[#FBBF24]',
    dot: 'bg-amber-500 dark:bg-[#FBBF24]',
  },
  ABSENT: {
    label: 'Absent',
    bg: 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30',
    text: 'text-rose-700 dark:text-[#FB7185]',
    dot: 'bg-rose-500 dark:bg-[#FB7185]',
  },
  PENDING: {
    label: 'Pending',
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30',
    text: 'text-amber-700 dark:text-[#FBBF24]',
    dot: 'bg-amber-500 dark:bg-[#FBBF24]',
  },
  APPROVED: {
    label: 'Approved',
    bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30',
    text: 'text-emerald-700 dark:text-[#34D399]',
    dot: 'bg-emerald-500 dark:bg-[#34D399]',
  },
  REJECTED: {
    label: 'Rejected',
    bg: 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30',
    text: 'text-rose-700 dark:text-[#FB7185]',
    dot: 'bg-rose-500 dark:bg-[#FB7185]',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-slate-50 border-slate-200 dark:bg-[#081426] dark:border-[#203653]',
    text: 'text-slate-600 dark:text-[#7E93B5]',
    dot: 'bg-slate-400 dark:bg-[#7E93B5]',
  },
  ACTIVATED: {
    label: 'Activated',
    bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30',
    text: 'text-emerald-700 dark:text-[#34D399]',
    dot: 'bg-emerald-500 dark:bg-[#34D399]',
  },
  DEACTIVATED: {
    label: 'Deactivated',
    bg: 'bg-slate-50 border-slate-200 dark:bg-[#081426] dark:border-[#203653]',
    text: 'text-slate-500 dark:text-[#7E93B5]',
    dot: 'bg-slate-400 dark:bg-[#7E93B5]',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const config = statusConfig[status] || {
    label: status,
    bg: 'bg-slate-100 border-slate-200 dark:bg-[#081426] dark:border-[#203653]',
    text: 'text-slate-700 dark:text-[#A9BCD8]',
    dot: 'bg-slate-400 dark:bg-[#7E93B5]',
  };

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-[11px] font-semibold' : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${config.bg} ${config.text} ${sizeClasses} transition-colors`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};
