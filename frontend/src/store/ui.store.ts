import { create } from 'zustand';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'war-room-theme-mode';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system'
    ? storedTheme
    : 'system';
}

function getInitialSidebarOpen(): boolean {
  if (typeof window === 'undefined') return true;
  return !window.matchMedia('(max-width: 768px)').matches;
}

interface UIStore {
  sidebarOpen: boolean;
  activePage: string;
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setActivePage: (page: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  cycleThemeMode: () => void;
  setResolvedTheme: (theme: ResolvedTheme) => void;
}

const THEME_MODE_SEQUENCE: ThemeMode[] = ['system', 'dark', 'light'];

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: getInitialSidebarOpen(),
  activePage: 'overview',
  themeMode: getStoredThemeMode(),
  resolvedTheme: getSystemTheme(),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActivePage: (page) => set({ activePage: page }),
  setThemeMode: (mode) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    }

    set({ themeMode: mode });
  },
  cycleThemeMode: () =>
    set((state) => {
      const currentIndex = THEME_MODE_SEQUENCE.indexOf(state.themeMode);
      const nextMode = THEME_MODE_SEQUENCE[(currentIndex + 1) % THEME_MODE_SEQUENCE.length];

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
      }

      return { themeMode: nextMode };
    }),
  setResolvedTheme: (theme) => set({ resolvedTheme: theme }),
}));
