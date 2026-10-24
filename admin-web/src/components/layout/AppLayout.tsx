import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarX2,
  Laptop,
  Sliders,
  BarChart2,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  Shield,
  Building2,
  LogOut,
  QrCode,
} from 'lucide-react';
import { HealthIndicator } from '../ui/HealthIndicator';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuth } from '../../context/useAuth';
import type { SystemHealth } from '../../types';

interface AppLayoutProps {
  health: SystemHealth;
  onRefreshHealth: () => void;
  isHealthLoading: boolean;
}

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Office QR Kiosk', path: '/kiosk', icon: QrCode },
  { name: 'Employees', path: '/employees', icon: Users },
  { name: 'Attendance', path: '/attendance', icon: CalendarCheck },
  { name: 'Leave Requests', path: '/leave', icon: CalendarX2 },
  { name: 'WFH Requests', path: '/wfh', icon: Laptop },
  { name: 'Attendance Policy', path: '/policy', icon: Sliders },
  { name: 'Reports & Analytics', path: '/reports', icon: BarChart2 },
  { name: 'System Settings', path: '/settings', icon: Settings },
];

export const AppLayout: React.FC<AppLayoutProps> = ({
  health,
  onRefreshHealth,
  isHealthLoading,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const currentNav = navItems.find((item) =>
    item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path)
  ) || { name: 'Overview' };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050B18] text-slate-900 dark:text-[#EAF2FF] flex transition-colors duration-200">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 dark:bg-[#050B18]/80 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-[100dvh] bg-slate-900 dark:bg-[#071020] text-white flex flex-col border-r border-slate-800 dark:border-[#203653] transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:self-start lg:translate-x-0 overscroll-contain ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 dark:border-[#203653] shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 dark:bg-[#3B82F6] flex items-center justify-center font-bold text-white shadow-xs dark:shadow-[0_0_15px_-2px_rgba(59,130,246,0.5)]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-wide text-white dark:text-[#EAF2FF] flex items-center gap-1.5">
                VorldX
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 dark:bg-[#22D3EE]/20 dark:text-[#22D3EE] font-semibold border border-indigo-500/30 dark:border-[#22D3EE]/30">
                  PRO
                </span>
              </div>
              <div className="text-[11px] font-medium text-slate-400 dark:text-[#7E93B5]">Attendance Hub</div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-bold tracking-wider uppercase text-slate-400 dark:text-[#7E93B5]">
            Navigation Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs dark:bg-[#3B82F6] dark:text-white dark:shadow-[0_0_15px_-3px_rgba(59,130,246,0.4)]'
                      : 'text-slate-300 dark:text-[#A9BCD8] hover:bg-slate-800 dark:hover:bg-[#10213D] hover:text-white dark:hover:text-[#EAF2FF]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Logout in Sidebar */}
        <div className="p-3 border-t border-slate-800 dark:border-[#203653] bg-slate-950/60 dark:bg-[#050B18]/70 shrink-0">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 dark:bg-[#0C1930] border border-slate-800/80 dark:border-[#203653]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-indigo-600/30 dark:bg-[#3B82F6]/30 border border-indigo-500/30 dark:border-[#3B82F6]/40 text-indigo-300 dark:text-[#60A5FA] font-bold text-xs flex items-center justify-center shrink-0">
                {user?.admin_id ? user.admin_id.substring(0, 3) : 'ADM'}
              </div>
              <div className="min-w-0 truncate">
                <div className="text-xs font-semibold text-slate-200 dark:text-[#EAF2FF] truncate">
                  {user?.admin_id || 'Administrator'}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-[#7E93B5] truncate">
                  {user?.email || 'admin@vorldx.com'}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 dark:hover:bg-[#10213D] rounded-md transition-colors shrink-0"
              title="Logout from administrator session"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2 px-2 flex items-center justify-between text-[10px] text-slate-500 dark:text-[#7E93B5]">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-indigo-400 dark:text-[#22D3EE]" />
              Role: {user?.role || 'ADMIN'}
            </span>
            <span className="text-[10px] font-mono text-slate-500 dark:text-[#7E93B5]">v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white dark:bg-[#071020] border-b border-slate-200 dark:border-[#203653] px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4 transition-colors duration-200">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 dark:text-[#A9BCD8] hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#10213D] shrink-0"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-[#EAF2FF] truncate max-w-[120px] min-[400px]:max-w-[180px] sm:max-w-none">
                {currentNav.name}
              </h1>
              <div className="hidden sm:flex items-center text-[11px] text-slate-400 dark:text-[#7E93B5] gap-1.5">
                <span>VorldX Admin</span>
                <span>/</span>
                <span className="text-slate-600 dark:text-[#A9BCD8] font-medium">{currentNav.name}</span>
              </div>
            </div>
          </div>

          {/* Controls: Search, ThemeToggle, Health, Notifications, User */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="relative hidden md:block w-44 lg:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#7E93B5] pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-lg pl-8.5 pr-3 py-1.5 text-xs text-slate-900 dark:text-[#EAF2FF] placeholder-slate-400 dark:placeholder-[#7E93B5] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-[#22D3EE]/20 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-colors"
              />
            </div>

            {/* Visual Theme Mode Selector */}
            <ThemeToggle variant="compact" />

            <HealthIndicator
              health={health}
              onRefresh={onRefreshHealth}
              isLoading={isHealthLoading}
            />

            <button
              className="relative p-1.5 sm:p-2 text-slate-500 dark:text-[#A9BCD8] hover:text-slate-700 dark:hover:text-[#EAF2FF] hover:bg-slate-100 dark:hover:bg-[#10213D] rounded-lg transition-colors"
              title="Notifications"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-600 dark:bg-[#22D3EE] ring-2 ring-white dark:ring-[#071020]" />
            </button>

            {/* Header User Profile & Logout */}
            <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-[#203653]">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-indigo-100 dark:bg-[#10213D] border border-indigo-200 dark:border-[#164E63] text-indigo-700 dark:text-[#22D3EE] font-bold text-xs flex items-center justify-center shrink-0">
                {user?.admin_id ? user.admin_id.substring(0, 3) : 'AD'}
              </div>
              <div className="hidden xl:block text-left">
                <div className="text-xs font-semibold text-slate-800 dark:text-[#EAF2FF] leading-tight">
                  {user?.admin_id || 'Admin'}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-[#7E93B5]">Administrator</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 rounded-lg transition-colors ml-0.5 sm:ml-1"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl 2xl:max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
