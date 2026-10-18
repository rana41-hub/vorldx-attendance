import { StatusBadge } from '../ui/StatusBadge';
import type { AttendanceRecord } from '../../types';
import { Users, Info, Clock, CheckCircle } from 'lucide-react';

interface RecentAttendanceTableProps {
  records: AttendanceRecord[];
  isDemoData: boolean;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const RecentAttendanceTable: React.FC<RecentAttendanceTableProps> = ({
  records,
  isDemoData,
  onRefresh,
  isLoading = false,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* Table Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              Recent Attendance Activity
            </h3>
            {isDemoData ? (
              <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-800 flex items-center gap-1">
                <Info className="w-3 h-3" /> SAMPLE DATA
              </span>
            ) : (
              <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-800 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> LIVE DATABASE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time office check-in and check-out logs
          </p>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors self-start sm:self-auto disabled:opacity-50"
          >
            <Clock className="w-3.5 h-3.5" />
            {isLoading ? 'Updating...' : 'Refresh Logs'}
          </button>
        )}
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50/75 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
            <tr>
              <th scope="col" className="px-5 py-3.5 font-medium">
                Employee
              </th>
              <th scope="col" className="px-5 py-3.5 font-medium">
                Employee ID
              </th>
              <th scope="col" className="px-5 py-3.5 font-medium">
                Department
              </th>
              <th scope="col" className="px-5 py-3.5 font-medium">
                Check-In
              </th>
              <th scope="col" className="px-5 py-3.5 font-medium">
                Check-Out
              </th>
              <th scope="col" className="px-5 py-3.5 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="w-8 h-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-700">No attendance records logged</p>
                    <p className="text-xs text-slate-400">
                      Attendance records will appear here as employees check in.
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
                  <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200">
                          {initials}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{name}</div>
                          <div className="text-xs text-slate-400">{record.source || 'OFFICE_QR'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600">
                      {record.employee_code || `EMP-${record.employee_id.toString().padStart(3, '0')}`}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                        {record.department || 'General'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-slate-700">
                      {formatTime(record.check_in)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
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
