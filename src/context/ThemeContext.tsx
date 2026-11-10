import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppTheme } from '../types';
import { safeGetStorage, safeSetStorage, getAppSettings, saveAppSettings } from '../services/supabase';

interface ThemeConfig {
  theme: AppTheme;
  primaryHex: string;
  primaryHoverHex: string;
  buttonPrimary: string;
  textPrimary: string;
  textPrimaryBold: string;
  bgLight: string;
  borderLight: string;
  badge: string;
  gradientBg: string;
  activeTab: string;
}

const THEME_CONFIGS: Record<AppTheme, ThemeConfig> = {
  burgundy: {
    theme: 'burgundy',
    primaryHex: '#7a0f2b',
    primaryHoverHex: '#8f1334',
    buttonPrimary: 'bg-[#7a0f2b] hover:bg-[#8f1334] text-white',
    textPrimary: 'text-[#7a0f2b]',
    textPrimaryBold: 'text-[#7a0f2b] font-bold',
    bgLight: 'bg-[#faf2f4]',
    borderLight: 'border-rose-200',
    badge: 'bg-rose-50 text-[#7a0f2b] border border-rose-200',
    gradientBg: 'from-[#fcf7f8] via-[#f7eef0] to-[#f4e6e8]',
    activeTab: 'bg-[#7a0f2b] text-white',
  },
  blue: {
    theme: 'blue',
    primaryHex: '#1e40af',
    primaryHoverHex: '#1d4ed8',
    buttonPrimary: 'bg-blue-700 hover:bg-blue-800 text-white',
    textPrimary: 'text-blue-700',
    textPrimaryBold: 'text-blue-700 font-bold',
    bgLight: 'bg-blue-50',
    borderLight: 'border-blue-200',
    badge: 'bg-blue-50 text-blue-700 border border-blue-200',
    gradientBg: 'from-slate-50 via-blue-50/40 to-indigo-50/30',
    activeTab: 'bg-blue-700 text-white',
  },
  green: {
    theme: 'green',
    primaryHex: '#047857',
    primaryHoverHex: '#065f46',
    buttonPrimary: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    textPrimary: 'text-emerald-700',
    textPrimaryBold: 'text-emerald-700 font-bold',
    bgLight: 'bg-emerald-50',
    borderLight: 'border-emerald-200',
    badge: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    gradientBg: 'from-slate-50 via-emerald-50/40 to-teal-50/30',
    activeTab: 'bg-emerald-700 text-white',
  },
  glass: {
    theme: 'glass',
    primaryHex: '#6366f1',
    primaryHoverHex: '#4f46e5',
    buttonPrimary: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 text-white shadow-md shadow-indigo-500/20 backdrop-blur-md',
    textPrimary: 'text-indigo-600',
    textPrimaryBold: 'text-indigo-700 font-bold',
    bgLight: 'bg-white/60 backdrop-blur-md',
    borderLight: 'border-white/60',
    badge: 'bg-white/70 text-indigo-700 border border-indigo-200/60 shadow-2xs backdrop-blur-xs',
    gradientBg: 'from-indigo-50/50 via-purple-50/40 to-pink-50/30',
    activeTab: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25',
  },
};

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  config: ThemeConfig;
  isBlue: boolean;
  isBurgundy: boolean;
  isGreen: boolean;
  isGlass: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'school_survey_global_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = safeGetStorage(THEME_STORAGE_KEY) as AppTheme | null;
    return saved === 'blue' || saved === 'green' || saved === 'glass' ? saved : 'burgundy';
  });

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    safeSetStorage(THEME_STORAGE_KEY, newTheme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    saveAppSettings({ theme: newTheme }).catch(err => {
      console.warn('Failed to persist theme to database', err);
    });
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // Synchronize global theme from Supabase database on app load
  useEffect(() => {
    let active = true;
    const syncTheme = async () => {
      try {
        const s = await getAppSettings();
        if (s?.theme && active && s.theme !== theme) {
          setThemeState(s.theme);
          safeSetStorage(THEME_STORAGE_KEY, s.theme);
          if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', s.theme);
          }
        }
      } catch (e) {
        // ignore
      }
    };
    syncTheme();
    return () => { active = false; };
  }, []);

  const config = THEME_CONFIGS[theme] || THEME_CONFIGS.burgundy;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        config,
        isBlue: theme === 'blue',
        isBurgundy: theme === 'burgundy',
        isGreen: theme === 'green',
        isGlass: theme === 'glass',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback if rendered outside provider
    return {
      theme: 'burgundy',
      setTheme: () => {},
      config: THEME_CONFIGS.burgundy,
      isBlue: false,
      isBurgundy: true,
      isGreen: false,
      isGlass: false,
    };
  }
  return ctx;
}
