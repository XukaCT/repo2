import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Toaster } from 'sonner';

// Layout
import AppShell from './components/layout/AppShell';

// Pages
import HomePage from './pages/HomePage/HomePage';
import OverviewPage from './pages/OverviewPage/OverviewPage';
import TendersPage from './pages/TendersPage/TendersPage';
import AnalyticsPage from './pages/AnalyticsPage/AnalyticsPage';
import ReportsPage from './pages/ReportsPage/ReportsPage';
import AlertsPage from './pages/AlertsPage/AlertsPage';
import DataSourcesPage from './pages/DataSourcesPage/DataSourcesPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';

// Store
import { useUIStore } from './store/ui.store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export default function App() {
  const { themeMode, resolvedTheme, setResolvedTheme } = useUIStore();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const syncResolvedTheme = () => {
      setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
    };

    if (themeMode === 'system') {
      syncResolvedTheme();
      const onChange = () => syncResolvedTheme();
      mediaQuery.addEventListener('change', onChange);
      return () => mediaQuery.removeEventListener('change', onChange);
    }

    setResolvedTheme(themeMode);
    return undefined;
  }, [themeMode, setResolvedTheme]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* 
        The basename tells React Router that it is not sitting at the root of the domain.
        When we map this to Frappe later, we will host it at /warroom 
      */}
      <BrowserRouter basename="/warroom">
        <Routes>
          {/* Main App Shell */}
          <Route element={<AppShell />}>
            <Route index            element={<HomePage />} />
            <Route path="home"      element={<Navigate to="/" replace />} />
            <Route path="overview"  element={<OverviewPage />} />
            <Route path="tenders"   element={<TendersPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="reports"   element={<ReportsPage />} />
            <Route path="alerts"    element={<AlertsPage />} />
            <Route path="data-sources" element={<DataSourcesPage />} />
            <Route path="settings"  element={<SettingsPage />} />
            <Route path="customers" element={<Navigate to="/" replace />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-center"
        toastOptions={{
          classNames: {
            toast:        'appToast',
            title:        'appToastTitle',
            description:  'appToastDescription',
            actionButton: 'appToastAction',
            cancelButton: 'appToastCancel',
            closeButton:  'appToastClose',
            icon:         'appToastIcon',
            loader:       'appToastLoader',
          },
          style: {
            width:    '420px',
            maxWidth: 'calc(100vw - 32px)',
          },
        }}
      />
    </QueryClientProvider>
  );
}