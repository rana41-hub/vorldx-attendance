import { StatusBadge } from '../ui/StatusBadge';
import type { AttendanceRecord } from '../../types';
import { Users, Clock } from 'lucide-react';

interface RecentAttendanceTableProps {
  records: AttendanceRecord[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const RecentAttendanceTable: React.FC<RecentAttendanceTableProps> = ({
  records,
  onRefresh,
  isLoading = false,
}) => {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] shadow-xs dark:shadow-[0_4px_20px_-2px_rgba(5,11,24,0.7)] overflow-hidden transition-all duration-200">
      {/* Table Header */}
      <div className="p-5 border-b border-slate-100 dark:border-[#203653]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-[#EAF2FF]">
              Recent Attendance Activity
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-0.5">
            Real-time office check-in and check-out telemetry logs
          </p>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#203653] text-xs font-semibold text-slate-600 dark:text-[#A9BCD8] hover:bg-slate-50 dark:hover:bg-[#10213D] transition-colors self-start sm:self-auto disabled:opacity-50"
          >
            <Clock className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Updating...' : 'Refresh Logs'}</span>
          </button>
        )}
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 dark:text-[#A9BCD8]">
          <thead className="bg-slate-50/75 dark:bg-[#081426] text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#7E93B5] border-b border-slate-100 dark:border-[#203653]">
            <tr>
              <th scope="col" className="px-5 py-3.5">Employee</th>
              <th scope="col" className="px-5 py-3.5">Employee ID</th>
              <th scope="col" className="px-5 py-3.5">Department</th>
              <th scope="col" className="px-5 py-3.5">Check-In</th>
              <th scope="col" className="px-5 py-3.5">Check-Out</th>
              <th scope="col" className="px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#203653]/60">
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-500 dark:text-[#7E93B5]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="w-8 h-8 text-slate-300 dark:text-[#203653]" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-[#EAF2FF]">No attendance records logged</p>
                    <p className="text-xs text-slate-400 dark:text-[#7E93B5]">
                      Attendance records will appear here as employees scan and check in.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((record) => {
                const name = record.employee_name || `Employee #${record.employee_id}`;
                const initials = name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                const formatTime = (ts?: string | null) => {
                  if (!ts) return '—';
                  try {
                    const date = new Date(ts);
                    return date.toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Asia/Kolkata',
                    });
                  } catch {
                    return ts;
                  }
                };

                return (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#10213D]/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-[#10213D] text-xs font-bold text-slate-700 dark:text-[#22D3EE] border border-slate-200 dark:border-[#164E63]">
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-[#EAF2FF]">{name}</div>
                          <div className="text-[11px] font-mono text-slate-400 dark:text-[#7E93B5]">{record.source || 'OFFICE_QR'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-600 dark:text-[#A9BCD8]">
                      {record.employee_code || `EMP-${record.employee_id.toString().padStart(3, '0')}`}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-[#A9BCD8]">
                      <span className="inline-flex px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#10213D] text-slate-700 dark:text-[#A9BCD8] font-semibold text-[11px] border border-transparent dark:border-[#203653]/80">
                        {record.department || 'General'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold text-slate-700 dark:text-[#EAF2FF]">
                      {formatTime(record.check_in)}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-slate-500 dark:text-[#7E93B5]">
                      {formatTime(record.check_out)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge
                        status={
                          record.session_state === 'INCOMPLETE' || (record.check_out && record.status === 'HALF_DAY')
                            ? 'INCOMPLETE'
                            : !record.check_out || record.session_state === 'IN_PROGRESS'
                            ? 'IN_PROGRESS'
                            : record.status
                        }
                        size="sm"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
