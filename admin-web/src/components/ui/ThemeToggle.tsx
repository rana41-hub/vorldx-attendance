import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, ChevronDown, Check } from 'lucide-react';
import { useTheme, type ThemeMode } from '../../context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'compact' | 'segmented';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'segmented') {
    const options: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
      { mode: 'light', label: 'Light', icon: Sun },
      { mode: 'dark', label: 'Cyber Dark', icon: Moon },
      { mode: 'system', label: 'System', icon: Laptop },
    ];

    return (
      <div
        className={`inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#081426] border border-slate-200 dark:border-[#203653] ${className}`}
        role="group"
        aria-label="Theme selection"
      >
        {options.map((opt) => {
          const Icon = opt.icon;
          const isActive = themeMode === opt.mode;
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setThemeMode(opt.mode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-white dark:bg-[#10213D] text-indigo-600 dark:text-[#22D3EE] shadow-xs border border-slate-200/80 dark:border-[#164E63]'
                  : 'text-slate-600 dark:text-[#7E93B5] hover:text-slate-900 dark:hover:text-[#EAF2FF]'
              }`}
              aria-pressed={isActive}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Compact variant: Button with dropdown
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="flex items-center gap-1.5 p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-[#A9BCD8] dark:hover:text-[#EAF2FF] dark:hover:bg-[#10213D] border border-transparent dark:border-[#203653]/60 transition-colors"
        title={`Theme: ${themeMode} (${resolvedTheme})`}
        aria-label="Toggle visual theme"
        aria-expanded={dropdownOpen}
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="w-4 h-4 text-[#22D3EE]" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500" />
        )}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-1.5 w-40 rounded-xl bg-white dark:bg-[#0C1930] border border-slate-200 dark:border-[#203653] shadow-lg dark:shadow-[0_8px_30px_rgba(5,11,24,0.8)] py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#7E93B5] border-b border-slate-100 dark:border-[#203653]/60">
            Appearance
          </div>
          <button
            type="button"
            onClick={() => {
              setThemeMode('light');
              setDropdownOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left transition-colors ${
              themeMode === 'light'
                ? 'text-indigo-600 dark:text-[#22D3EE] bg-indigo-50/50 dark:bg-[#10213D]'
                : 'text-slate-700 dark:text-[#EAF2FF] hover:bg-slate-50 dark:hover:bg-[#10213D]/60'
            }`}
          >
            <span className="flex items-center gap-2">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Light Mode</span>
            </span>
            {themeMode === 'light' && <Check className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setThemeMode('dark');
              setDropdownOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left transition-colors ${
              themeMode === 'dark'
                ? 'text-indigo-600 dark:text-[#22D3EE] bg-indigo-50/50 dark:bg-[#10213D]'
                : 'text-slate-700 dark:text-[#EAF2FF] hover:bg-slate-50 dark:hover:bg-[#10213D]/60'
            }`}
          >
            <span className="flex items-center gap-2">
              <Moon className="w-3.5 h-3.5 text-[#22D3EE]" />
              <span>Cyber Dark</span>
            </span>
            {themeMode === 'dark' && <Check className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setThemeMode('system');
              setDropdownOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left transition-colors ${
              themeMode === 'system'
                ? 'text-indigo-600 dark:text-[#22D3EE] bg-indigo-50/50 dark:bg-[#10213D]'
                : 'text-slate-700 dark:text-[#EAF2FF] hover:bg-slate-50 dark:hover:bg-[#10213D]/60'
            }`}
          >
            <span className="flex items-center gap-2">
              <Laptop className="w-3.5 h-3.5 text-slate-400" />
              <span>System</span>
            </span>
            {themeMode === 'system' && <Check className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
};
