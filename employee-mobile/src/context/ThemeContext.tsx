import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  isDark: boolean;
  background: string;
  secondaryBackground: string;
  surface: string;
  elevatedSurface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  primary: string;
  primaryLight: string;
  accentCyan: string;
  accentViolet: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  info: string;
  infoBg: string;
  navBackground: string;
  navBorder: string;
  inputBackground: string;
  inputBorder: string;
  statusBar: 'light' | 'dark';
}

export const lightColors: ThemeColors = {
  isDark: false,
  background: '#F8FAFC',
  secondaryBackground: '#F1F5F9',
  surface: '#FFFFFF',
  elevatedSurface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  primary: '#4F46E5',
  primaryLight: '#EEF2FF',
  accentCyan: '#06B6D4',
  accentViolet: '#7C3AED',
  success: '#10B981',
  successBg: '#ECFDF5',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  info: '#0284C7',
  infoBg: '#F0F9FF',
  navBackground: '#FFFFFF',
  navBorder: '#E2E8F0',
  inputBackground: '#F8FAFC',
  inputBorder: '#E2E8F0',
  statusBar: 'dark',
};

export const darkColors: ThemeColors = {
  isDark: true,
  background: '#050B18', // Main app background from specification
  secondaryBackground: '#081426', // Secondary background
  surface: '#0C1930', // Standard card surface
  elevatedSurface: '#10213D', // Elevated card surface
  surfaceElevated: '#10213D',
  textPrimary: '#EAF2FF', // High-contrast primary text
  textSecondary: '#A9BCD8', // Secondary text
  textMuted: '#7E93B5', // Muted text
  border: '#203653', // Standard dark border
  borderSubtle: '#164E63', // Subtle cyan border
  primary: '#3B82F6', // Electric blue primary action
  primaryLight: '#10213D',
  accentCyan: '#22D3EE', // Neon cyan accent
  accentViolet: '#8B5CF6', // Secondary violet
  success: '#34D399',
  successBg: 'rgba(52, 211, 153, 0.14)',
  warning: '#FBBF24',
  warningBg: 'rgba(251, 191, 36, 0.14)',
  danger: '#FB7185',
  dangerBg: 'rgba(251, 113, 133, 0.14)',
  info: '#60A5FA',
  infoBg: 'rgba(96, 165, 250, 0.14)',
  navBackground: '#071020', // Bottom navigation bar
  navBorder: '#203653',
  inputBackground: '#081426',
  inputBorder: '#203653',
  statusBar: 'light',
};

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const STORAGE_KEY = '@vorldx_theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeModeState(saved);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // storage error ignored
    }
  };

  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemColorScheme]);

  const colors = useMemo(() => {
    return resolvedTheme === 'dark' ? darkColors : lightColors;
  }, [resolvedTheme]);

  const toggleTheme = async () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    await setThemeMode(next);
  };

  const value = useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      isDark: resolvedTheme === 'dark',
      colors,
      setThemeMode,
      toggleTheme,
    }),
    [themeMode, resolvedTheme, colors]
  );

  if (!isLoaded) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
