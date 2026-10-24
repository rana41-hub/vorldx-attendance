import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import {
  Building2,
  Lock,
  Shield,
  UserCheck,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';
import { ApiError } from '../../services/api';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

export const LoginPage: React.FC = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If already logged in, redirect
  const fromLocation =
    (location.state as { from?: { pathname?: string } })?.from?.pathname || '/';

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(fromLocation, { replace: true });
    }
  }, [isAuthenticated, navigate, fromLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedId = loginId.trim();
    if (!trimmedId) {
      setError('Please provide your assigned Administrator ID.');
      return;
    }

    if (trimmedId.includes('@')) {
      setError(
        'Email addresses are not accepted for administrator access. Please enter your unique Admin ID (e.g., ADM-001).'
      );
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(trimmedId, password);
      navigate(fromLocation, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Authentication failed. Please verify credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050B18] text-slate-900 dark:text-[#EAF2FF] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-200">
      {/* Background Ambient Glow Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-indigo-500/10 dark:bg-[#3B82F6]/10 blur-[130px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-10 w-[400px] h-[300px] bg-sky-500/10 dark:bg-[#22D3EE]/10 blur-[120px] pointer-events-none rounded-full" />

      {/* Top Bar with Theme Toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <ThemeToggle variant="compact" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 dark:from-[#3B82F6] dark:to-[#22D3EE] flex items-center justify-center text-white shadow-xl shadow-indigo-600/20 dark:shadow-[0_0_25px_rgba(59,130,246,0.35)] mb-3 border border-indigo-400/30 dark:border-[#22D3EE]/40">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-[#EAF2FF]">
            VorldX Attendance Control
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#7E93B5] mt-1 font-medium">
            Enterprise Administrator Portal & Security Console
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-[#0C1930] border border-slate-200 dark:border-[#203653] rounded-2xl shadow-xl dark:shadow-[0_8px_32px_rgba(5,11,24,0.7)] backdrop-blur-md p-5 sm:p-8 transition-colors duration-200">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100 dark:border-[#203653]/70">
            <Shield className="w-4 h-4 text-indigo-600 dark:text-[#22D3EE]" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-[#EAF2FF]">
              Administrator Authentication
            </h2>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-[#FB7185] text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 dark:text-[#FB7185] shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login_id"
                className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1.5"
              >
                Administrator ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-[#7E93B5]">
                  <UserCheck className="w-4 h-4" />
                </div>
                <input
                  id="login_id"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="e.g., ADM-001"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-[#EAF2FF] placeholder-slate-400 dark:placeholder-[#7E93B5] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-[#22D3EE]/30 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-all font-mono tracking-wide"
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-[#7E93B5] mt-1 font-medium">
                Enter your unique Admin ID. Email addresses are restricted.
              </p>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 dark:text-[#A9BCD8] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-[#7E93B5]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter administrator password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 dark:text-[#EAF2FF] placeholder-slate-400 dark:placeholder-[#7E93B5] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-[#22D3EE]/30 focus:border-indigo-500 dark:focus:border-[#22D3EE] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 dark:text-[#7E93B5] hover:text-slate-600 dark:hover:text-[#EAF2FF] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-[#3B82F6] dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 dark:shadow-[0_0_20px_-3px_rgba(59,130,246,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-[#203653]/60 text-center">
            <p className="text-[11px] text-slate-400 dark:text-[#7E93B5]">
              Protected Organization Resource &bull; VorldX Security Architecture
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
