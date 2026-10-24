import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Users,
  Search,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Edit2,
  Trash2,
  KeyRound,
  ShieldAlert,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import type { Employee } from '../../types';

export const EmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  // Add / Edit Employee Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    employee_code: '',
    first_name: '',
    last_name: '',
    department: 'Engineering',
    designation: '',
    phone: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Account Provisioning Modal State
  const [accountModalEmp, setAccountModalEmp] = useState<Employee | null>(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [isAccountSubmitting, setIsAccountSubmitting] = useState(false);

  // Delete Confirmation State
  const [deletingEmp, setDeletingEmp] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getEmployees(selectedDept || undefined);
      setEmployees(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDept]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setFormData({
      employee_code: '',
      first_name: '',
      last_name: '',
      department: 'Engineering',
      designation: '',
      phone: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      employee_code: emp.employee_code,
      first_name: emp.first_name,
      last_name: emp.last_name,
      department: emp.department,
      designation: emp.designation,
      phone: emp.phone || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (editingEmployee) {
        await api.updateEmployee(editingEmployee.id, {
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          employee_code: formData.employee_code.trim(),
          department: formData.department.trim(),
          designation: formData.designation.trim(),
          phone: formData.phone.trim() || undefined,
        });
        setSuccessMessage(`Updated employee ${formData.first_name} ${formData.last_name} successfully.`);
      } else {
        await api.createEmployee({
          employee_code: formData.employee_code.trim(),
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          department: formData.department.trim(),
          designation: formData.designation.trim(),
          phone: formData.phone.trim() || undefined,
        });
        setSuccessMessage(`Created employee ${formData.first_name} ${formData.last_name} (${formData.employee_code}).`);
      }
      setIsModalOpen(false);
      loadEmployees();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Operation failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingEmp) return;
    setIsDeleting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await api.deleteEmployee(deletingEmp.id);
      setSuccessMessage(res.message);
      setDeletingEmp(null);
      loadEmployees();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to delete employee.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenAccountModal = (emp: Employee) => {
    setAccountModalEmp(emp);
    setAccountEmail(`emp_${emp.employee_code.toLowerCase()}@vorldx.com`);
    setAccountPassword('');
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountModalEmp) return;

    setIsAccountSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await api.createEmployeeAccount(accountModalEmp.id, {
        email: accountEmail.trim(),
        password: accountPassword,
      });
      setSuccessMessage(`Credentials provisioned for ${accountModalEmp.full_name} (${accountModalEmp.employee_code}).`);
      setAccountModalEmp(null);
      loadEmployees();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to provision account credentials.');
      }
    } finally {
      setIsAccountSubmitting(false);
    }
  };

  const handleToggleStatus = async (emp: Employee, activate: boolean) => {
    setError(null);
    setSuccessMessage(null);
    try {
      await api.updateEmployeeStatus(emp.id, activate);
      setSuccessMessage(`Account for ${emp.full_name} ${activate ? 'activated' : 'deactivated'}.`);
      loadEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = search.toLowerCase();
    return (
      emp.full_name.toLowerCase().includes(q) ||
      emp.employee_code.toLowerCase().includes(q) ||
      emp.designation.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#EAF2FF]">
            Employee Directory & Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-0.5">
            Manage organization personnel, login credentials, and department assignments
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadEmployees()}
            disabled={isLoading}
            className="p-2 border border-slate-200 dark:border-[#203653] rounded-xl text-slate-600 dark:text-[#A9BCD8] hover:bg-slate-50 dark:hover:bg-[#10213D] transition-colors disabled:opacity-50"
            title="Refresh employees"
            aria-label="Refresh employees"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-[#3B82F6] dark:hover:bg-blue-500 text-white text-xs font-bold shadow-xs dark:shadow-[0_0_15px_-3px_rgba(59,130,246,0.4)] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-[#34D399] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-[#34D399] shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 dark:text-[#34D399] hover:opacity-75 font-bold ml-2 text-base"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-[#FB7185] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-[#FB7185] shrink-0" />
            <span className="leading-relaxed font-medium">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-700 dark:text-[#FB7185] hover:opacity-75 font-bold ml-2 text-base"
          >
            ×
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] p-4 shadow-xs dark:shadow-[0_4px_20px_-2px_rgba(5,11,24,0.7)] flex flex-col sm:flex-row gap-3 transition-colors duration-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#7E93B5]" />
          <input
            type="text"
            placeholder="Search by name, employee code, designation, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-[#EAF2FF] placeholder-slate-400 dark:placeholder-[#7E93B5] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
          />
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
        >
          <option value="">All Departments</option>
          <option value="Engineering">Engineering</option>
          <option value="Product">Product</option>
          <option value="Security">Security</option>
          <option value="Operations">Operations</option>
          <option value="Research">Research</option>
          <option value="Analytics">Analytics</option>
          <option value="HR">HR</option>
        </select>
      </div>

      {/* Employees Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#203653] bg-white dark:bg-[#0C1930] shadow-xs dark:shadow-[0_4px_20px_-2px_rgba(5,11,24,0.7)] overflow-hidden transition-all duration-200">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full text-left text-sm text-slate-600 dark:text-[#A9BCD8] min-w-[640px]">
            <thead className="bg-slate-50/75 dark:bg-[#081426] text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#7E93B5] border-b border-slate-100 dark:border-[#203653]">
              <tr>
                <th scope="col" className="px-4 sm:px-5 py-3 sm:py-3.5">Employee</th>
                <th scope="col" className="px-4 sm:px-5 py-3 sm:py-3.5">Code</th>
                <th scope="col" className="px-4 sm:px-5 py-3 sm:py-3.5">Department</th>
                <th scope="col" className="px-4 sm:px-5 py-3 sm:py-3.5">Designation</th>
                <th scope="col" className="px-4 sm:px-5 py-3 sm:py-3.5">Account Status</th>
                <th scope="col" className="px-4 sm:px-5 py-3 sm:py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#203653]/60">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500 dark:text-[#7E93B5]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-slate-300 dark:text-[#203653]" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-[#EAF2FF]">No employees found</p>
                      <p className="text-xs text-slate-400 dark:text-[#7E93B5]">
                        {employees.length === 0
                          ? 'Add your first employee to start recording attendance.'
                          : 'No employees match the active search filter.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#10213D]/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-[#EAF2FF]">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-[#10213D] border border-indigo-100 dark:border-[#164E63] text-indigo-700 dark:text-[#22D3EE] font-bold text-xs flex items-center justify-center">
                          {emp.first_name[0]}
                          {emp.last_name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-[#EAF2FF]">{emp.full_name}</div>
                          {emp.phone && (
                            <div className="text-[11px] text-slate-400 dark:text-[#7E93B5] font-normal">
                              {emp.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-600 dark:text-[#A9BCD8]">
                      {emp.employee_code}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-[#A9BCD8]">
                      <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#10213D] text-slate-700 dark:text-[#A9BCD8] font-semibold text-[11px] border border-transparent dark:border-[#203653]">
                        {emp.department}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-[#EAF2FF]">
                      {emp.designation}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {emp.user_id ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-[#34D399] font-semibold text-[11px] border border-emerald-200 dark:border-emerald-500/30">
                          <UserCheck className="w-3.5 h-3.5" /> Activated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-[#FBBF24] font-semibold text-[11px] border border-amber-200 dark:border-amber-500/30">
                          <UserX className="w-3.5 h-3.5" /> Unactivated
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenAccountModal(emp)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-[#7E93B5] dark:hover:text-[#22D3EE] dark:hover:bg-[#10213D] rounded-lg transition-colors"
                        title="Manage credentials"
                        aria-label="Manage credentials"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      {emp.user_id && (
                        <button
                          onClick={() => handleToggleStatus(emp, false)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:text-[#7E93B5] dark:hover:text-[#FBBF24] dark:hover:bg-[#10213D] rounded-lg transition-colors"
                          title="Deactivate account"
                          aria-label="Deactivate account"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEdit(emp)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-[#7E93B5] dark:hover:text-[#3B82F6] dark:hover:bg-[#10213D] rounded-lg transition-colors"
                        title="Edit employee"
                        aria-label="Edit employee"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingEmp(emp)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-[#7E93B5] dark:hover:text-[#FB7185] dark:hover:bg-[#10213D] rounded-lg transition-colors"
                        title="Delete employee"
                        aria-label="Delete employee"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-[#050B18]/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0C1930] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#203653] max-w-lg w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto transition-all duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#203653]/70 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-[#EAF2FF]">
                {editingEmployee ? 'Edit Employee Details' : 'Add New Organization Employee'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-[#EAF2FF] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                  Employee Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., VX-0105"
                  value={formData.employee_code}
                  onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                    Department *
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Product">Product</option>
                    <option value="Security">Security</option>
                    <option value="Operations">Operations</option>
                    <option value="Research">Research</option>
                    <option value="Analytics">Analytics</option>
                    <option value="HR">HR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                    Designation *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Staff Engineer"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="text"
                  placeholder="+1-555-0100"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-[#203653]/70">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#A9BCD8] hover:bg-slate-100 dark:hover:bg-[#10213D] rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-[#3B82F6] dark:hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs dark:shadow-[0_0_15px_-3px_rgba(59,130,246,0.4)] disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? 'Saving...' : editingEmployee ? 'Update Employee' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Provisioning Modal */}
      {accountModalEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-[#050B18]/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0C1930] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#203653] max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto transition-all duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#203653]/70 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-[#EAF2FF]">
                Provision Credentials
              </h3>
              <button
                onClick={() => setAccountModalEmp(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-[#EAF2FF] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-[#A9BCD8] mb-4 leading-relaxed">
              Set up or reset mobile portal credentials for{' '}
              <strong className="text-slate-800 dark:text-[#EAF2FF]">{accountModalEmp.full_name}</strong> (Code: <code className="font-mono text-indigo-600 dark:text-[#22D3EE] font-bold">{accountModalEmp.employee_code}</code>).
            </p>

            <form onSubmit={handleAccountSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1">
                  Initial Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-[#EAF2FF] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-[#203653]/70">
                <button
                  type="button"
                  onClick={() => setAccountModalEmp(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#A9BCD8] hover:bg-slate-100 dark:hover:bg-[#10213D] rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAccountSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-[#3B82F6] dark:hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs dark:shadow-[0_0_15px_-3px_rgba(59,130,246,0.4)] disabled:opacity-50 transition-all"
                >
                  {isAccountSubmitting ? 'Provisioning...' : 'Provision Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-[#050B18]/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0C1930] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#203653] max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto transition-all duration-200">
            <div className="flex items-center gap-3 text-rose-600 dark:text-[#FB7185] mb-3">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-[#EAF2FF]">Confirm Deletion</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-[#A9BCD8] leading-relaxed mb-4">
              Are you sure you want to delete employee{' '}
              <strong className="text-slate-800 dark:text-[#EAF2FF]">{deletingEmp.full_name}</strong> ({deletingEmp.employee_code})?
              <br />
              <span className="text-rose-600 dark:text-[#FB7185] font-semibold mt-1 inline-block">
                Note: Deletion is blocked if attendance records or active requests exist.
              </span>
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-[#203653]/70">
              <button
                type="button"
                onClick={() => setDeletingEmp(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#A9BCD8] hover:bg-slate-100 dark:hover:bg-[#10213D] rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Delete Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
