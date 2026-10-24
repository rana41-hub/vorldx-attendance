import { useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Check,
  X as CloseIcon,
  Filter,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import type { Employee, LeaveRequest } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';

export const LeavePage: React.FC = () => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Submit Modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  // Review Modal State
  const [reviewingItem, setReviewingItem] = useState<{
    id: number;
    action: 'APPROVE' | 'REJECT';
    employeeName: string;
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [leaveData, empData] = await Promise.all([
        api.getLeaveRequests(statusFilter === 'ALL' ? undefined : statusFilter),
        api.getEmployees(),
      ]);
      setEmployees(empData);
      const empMap = new Map(empData.map((e) => [e.id, e]));
      const enriched = leaveData.map((r) => {
        const emp = empMap.get(r.employee_id);
        return {
          ...r,
          employee_name: emp ? emp.full_name : `Employee #${r.employee_id}`,
          employee_code: emp ? emp.employee_code : `VX-${r.employee_id}`,
          department: emp ? emp.department : 'General',
        };
      });
      setRequests(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching leave requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await api.createLeaveRequest({
        employee_id: Number(formData.employee_id),
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason,
      });
      setSuccess('Leave request submitted successfully.');
      setIsSubmitModalOpen(false);
      setFormData({ employee_id: '', start_date: '', end_date: '', reason: '' });
      loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error submitting request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenReview = (
    id: number,
    action: 'APPROVE' | 'REJECT',
    employeeName: string
  ) => {
    setReviewingItem({ id, action, employeeName });
    setReviewNotes('');
  };

  const handleExecuteReview = async () => {
    if (!reviewingItem) return;
    setIsReviewSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await api.reviewLeaveRequest(
        reviewingItem.id,
        reviewingItem.action,
        reviewNotes.trim() || undefined
      );
      setSuccess(
        `Leave request #${reviewingItem.id} for ${reviewingItem.employeeName} has been ${
          reviewingItem.action === 'APPROVE' ? 'approved' : 'rejected'
        }.`
      );
      setReviewingItem(null);
      loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to process leave review.');
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#EAF2FF]">
            Leave Requests Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-0.5">
            Review, approve, or reject employee leave and vacation requests
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 border border-slate-200 dark:border-[#203653] rounded-lg text-slate-600 dark:text-[#A9BCD8] hover:bg-slate-50 dark:hover:bg-[#10213D] transition-colors disabled:opacity-50"
            title="Refresh leave requests"
            aria-label="Refresh leave requests"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 dark:bg-[#3B82F6] text-white text-xs font-semibold hover:bg-indigo-700 dark:hover:bg-blue-600 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Submit Leave Request
          </button>
        </div>
      </div>

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="font-bold cursor-pointer">×</button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold cursor-pointer">×</button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-4 shadow-xs flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400 dark:text-[#7E93B5]" />
        <span className="text-xs font-semibold text-slate-700 dark:text-[#A9BCD8]">Filter Status:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
        >
          <option value="ALL">All Requests</option>
          <option value="PENDING">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] shadow-xs overflow-hidden">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full text-left text-sm text-slate-600 dark:text-[#A9BCD8] min-w-[650px]">
            <thead className="bg-slate-50/75 dark:bg-[#081426]/80 text-xs uppercase tracking-wider text-slate-500 dark:text-[#7E93B5] border-b border-slate-100 dark:border-[#203653]">
              <tr>
                <th className="px-5 py-3.5 font-medium">Request</th>
                <th className="px-5 py-3.5 font-medium">Employee</th>
                <th className="px-5 py-3.5 font-medium">Start Date</th>
                <th className="px-5 py-3.5 font-medium">End Date</th>
                <th className="px-5 py-3.5 font-medium">Reason</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
                <th className="px-5 py-3.5 font-medium text-right">Review Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#203653]/60">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500 dark:text-[#7E93B5]">
                    <Clock className="w-8 h-8 text-slate-300 dark:text-[#203653] mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-700 dark:text-[#EAF2FF]">No leave requests found</p>
                    <p className="text-xs text-slate-400 dark:text-[#7E93B5]">
                      Requests matching the selected filter will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-[#10213D]/60 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500 dark:text-[#7E93B5]">#{r.id}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-[#EAF2FF]">
                      <div>
                        <div>{r.employee_name}</div>
                        <div className="text-[11px] font-mono text-slate-400 dark:text-[#7E93B5]">{r.employee_code}</div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-[#A9BCD8] font-mono">{r.start_date}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-[#A9BCD8] font-mono">{r.end_date}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-[#A9BCD8] max-w-xs truncate" title={r.reason}>
                      {r.reason}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={r.status} size="sm" />
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      {r.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() =>
                              handleOpenReview(r.id, 'APPROVE', r.employee_name || `Employee #${r.employee_id}`)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600/90 dark:hover:bg-emerald-600 text-white rounded-md text-xs font-semibold shadow-2xs cursor-pointer"
                            title="Approve request"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() =>
                              handleOpenReview(r.id, 'REJECT', r.employee_name || `Employee #${r.employee_id}`)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 dark:bg-rose-600/90 dark:hover:bg-rose-600 text-white rounded-md text-xs font-semibold shadow-2xs cursor-pointer"
                            title="Reject request"
                          >
                            <CloseIcon className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-[#7E93B5] font-medium">
                          Reviewed
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {reviewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#0C1930] rounded-2xl shadow-xl border border-slate-200 dark:border-[#203653] max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-[#EAF2FF] mb-1">
              {reviewingItem.action === 'APPROVE' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#7E93B5] mb-4">
              Leave Request #{reviewingItem.id} for <strong className="text-slate-800 dark:text-[#EAF2FF]">{reviewingItem.employeeName}</strong>.
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                  Review Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    reviewingItem.action === 'APPROVE'
                      ? 'e.g., Approved by team lead.'
                      : 'e.g., Critical sprint milestone requires on-site presence.'
                  }
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg p-2.5 text-xs text-slate-900 dark:text-[#EAF2FF] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-[#203653]">
                <button
                  type="button"
                  onClick={() => setReviewingItem(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-[#A9BCD8] hover:bg-slate-100 dark:hover:bg-[#10213D] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteReview}
                  disabled={isReviewSubmitting}
                  className={`px-4 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer ${
                    reviewingItem.action === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isReviewSubmitting
                    ? 'Processing...'
                    : reviewingItem.action === 'APPROVE'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Leave Request Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#0C1930] rounded-2xl shadow-xl border border-slate-200 dark:border-[#203653] max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-[#EAF2FF] mb-1">
              Submit Leave Request
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#7E93B5] mb-4">
              Record a leave request in the PostgreSQL database.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                  Employee *
                </label>
                <select
                  required
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
                >
                  <option value="">Select Employee...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                  Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail absence justification..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg p-2.5 text-xs text-slate-900 dark:text-[#EAF2FF] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-cyan-500/20 focus:border-indigo-500 dark:focus:border-[#22D3EE]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-[#203653]">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-[#A9BCD8] hover:bg-slate-100 dark:hover:bg-[#10213D] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 dark:bg-[#3B82F6] text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 dark:hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
