import {
  Menu,
  Bell,
  Search,
  RefreshCw,
  Moon,
  Sun,
  Monitor,
  ArrowRight,
  Clock3,
  CheckCheck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAlerts, useMarkAllRead, useMarkRead } from '../../hooks/useAlerts';
import { useUIStore } from '../../store/ui.store';
import { formatAgo } from '../../utils/formatters';
import ThemePreviewSelector from '../theme/ThemePreviewSelector';
import styles from './TopBar.module.css';

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/':          { title: 'Overview',          sub: 'Bid intelligence dashboard' },
  '/tenders':   { title: 'Tender Management', sub: 'Track and manage government tenders' },
  '/analytics': { title: 'Analytics',         sub: 'Deep dive into bid performance' },
  '/reports':   { title: 'Reports',           sub: 'Generate and export reports' },
  '/alerts':    { title: 'Alerts',            sub: 'Notifications and saved searches' },
  '/settings':  { title: 'Settings',          sub: 'Profile, appearance, and notification channels' },
};

interface TopBarProps {
  pathname: string;
}

interface SearchAction {
  id: string;
  kind: 'action';
  title: string;
  description: string;
  keywords: string[];
  run: () => void;
}

export default function TopBar({ pathname }: TopBarProps) {
  const { toggleSidebar, themeMode, resolvedTheme, setThemeMode } = useUIStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: alertsData } = useAlerts();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const notifRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const pageInfo = PAGE_TITLES[pathname] ?? PAGE_TITLES['/'];
  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setRefreshing(false), 600);
  };

  const themeConfig = {
    system: { label: 'System', icon: Monitor },
    dark: { label: 'Dark', icon: Moon },
    light: { label: 'Light', icon: Sun },
  }[themeMode];

  const ThemeIcon = themeConfig.icon;
  const unreadAlerts = (alertsData ?? []).filter((alert) => !alert.read);
  const recentAlerts = [...(alertsData ?? [])].slice(0, 5);

  const searchActions = useMemo<SearchAction[]>(() => [
    {
      id: 'overview',
      kind: 'action',
      title: 'Open Overview',
      description: 'Go to dashboard overview',
      keywords: ['overview', 'dashboard', 'home'],
      run: () => navigate('/'),
    },
    {
      id: 'tenders',
      kind: 'action',
      title: 'Open Tenders',
      description: 'Browse current tender opportunities',
      keywords: ['tenders', 'contracts', 'bids', 'procurement'],
      run: () => navigate('/tenders'),
    },
    {
      id: 'analytics',
      kind: 'action',
      title: 'Open Analytics',
      description: 'Review performance and trend analytics',
      keywords: ['analytics', 'charts', 'insights'],
      run: () => navigate('/analytics'),
    },
    {
      id: 'reports',
      kind: 'action',
      title: 'Open Reports',
      description: 'Generate and export report data',
      keywords: ['reports', 'exports', 'csv'],
      run: () => navigate('/reports'),
    },
    {
      id: 'alerts',
      kind: 'action',
      title: 'Open Alerts',
      description: 'View notifications and saved searches',
      keywords: ['alerts', 'notifications', 'saved search'],
      run: () => navigate('/alerts'),
    },
    {
      id: 'refresh',
      kind: 'action',
      title: 'Refresh Data',
      description: 'Refetch cached query data',
      keywords: ['refresh', 'reload', 'sync', 'refetch'],
      run: () => {
        void handleRefresh();
      },
    },
    {
      id: 'theme',
      kind: 'action',
      title: 'Appearance',
      description: `Current resolved theme is ${resolvedTheme}`,
      keywords: ['theme', 'dark', 'light', 'system', 'appearance'],
      run: () => setAppearanceOpen(true),
    },
    {
      id: 'settings',
      kind: 'action',
      title: 'Open Settings',
      description: 'Profile, theme, and notification preferences',
      keywords: ['settings', 'profile', 'appearance', 'notifications'],
      run: () => navigate('/settings'),
    },
  ], [navigate, resolvedTheme]);

  const tenderSearchAction = useMemo<SearchAction[]>(() => {
    const query = searchQuery.trim();
    if (!query) return [];

    if (/^\d{4}$/.test(query)) {
      return [
        {
          id: 'search-tenders-close-year',
          kind: 'action',
          title: `Search Tender close date year: ${query}`,
          description: 'Open Tender page and filter by close date year',
          keywords: ['tender', 'tenders', 'bid', 'bids', 'contracts', 'close date', 'year', query],
          run: () => navigate(`/tenders?year=${encodeURIComponent(query)}`),
        },
        {
          id: 'search-tenders-published-year',
          kind: 'action',
          title: `Search Tender published year: ${query}`,
          description: 'Open Tender page and filter by published date year',
          keywords: ['tender', 'tenders', 'bid', 'bids', 'contracts', 'published date', 'publish year', query],
          run: () => navigate(`/tenders?published_year=${encodeURIComponent(query)}`),
        },
      ];
    }

    return [{
      id: 'search-tenders-query',
      kind: 'action',
      title: `Search Tenders for "${query}"`,
      description: 'Open Tender page and search tender titles and agencies',
      keywords: ['tender', 'tenders', 'bid', 'bids', 'contracts', query],
      run: () => navigate(`/tenders?search=${encodeURIComponent(query)}`),
    }];
  }, [navigate, searchQuery]);

  const searchableActions = useMemo(
    () => [...tenderSearchAction, ...searchActions],
    [tenderSearchAction, searchActions],
  );

  const filteredSearchActions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return searchableActions.slice(0, 12);

    return searchableActions.filter((action) =>
      [action.title, action.description, ...action.keywords]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [searchableActions, searchQuery]);

  const groupedSearchActions = useMemo(() => {
    const sections: Array<{ label: string; items: SearchAction[] }> = [];
    const actions = filteredSearchActions.filter((item) => item.kind === 'action');

    if (actions.length > 0) sections.push({ label: 'Quick Actions', items: actions });

    return sections;
  }, [filteredSearchActions]);

  useEffect(() => {
    if (!searchOpen) return;

    setNotifOpen(false);
    const timeoutId = window.setTimeout(() => searchInputRef.current?.focus(), 20);
    return () => window.clearTimeout(timeoutId);
  }, [searchOpen]);

  useEffect(() => {
    if (!notifOpen) return;

    setSearchOpen(false);
    const handlePointerDown = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [notifOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }

      if (event.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
        setAppearanceOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const runSearchAction = (action: SearchAction) => {
    action.run();
    setSearchOpen(false);
    setSearchQuery('');
  };

  const runFirstSearchAction = () => {
    const firstAction = groupedSearchActions[0]?.items[0];
    if (firstAction) runSearchAction(firstAction);
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={toggleSidebar}>
          <Menu size={18} />
        </button>
        <div className={styles.pageInfo}>
          <h1 className={styles.pageTitle}>{pageInfo.title}</h1>
          <p className={styles.pageSub}>{today}</p>
        </div>
      </div>

      <div className={styles.right}>
        <button
          className={styles.themeBtn}
          onClick={() => setAppearanceOpen(true)}
          title="Appearance"
          aria-label="Open appearance settings"
        >
          <ThemeIcon size={15} />
          <span className={styles.themeLabel}>Appearance</span>
        </button>

        <button
          className={styles.iconBtn}
          onClick={handleRefresh}
          title="Refresh data"
        >
          <RefreshCw size={15} className={refreshing ? styles.spinning : ''} />
        </button>

        <button
          className={styles.iconBtn}
          title="Search"
          onClick={() => setSearchOpen(true)}
        >
          <Search size={15} />
        </button>

        <div className={styles.notifWrap} ref={notifRef}>
          <button
            className={styles.notifBtn}
            title="Notifications"
            onClick={() => setNotifOpen((open) => !open)}
          >
            <Bell size={15} />
            {unreadAlerts.length > 0 && <span className={styles.notifDot} />}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                className={styles.notifPanel}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                style={{ transformOrigin: 'top right' }}
              >
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelTitle}>Notifications</p>
                  <p className={styles.panelSub}>
                    {unreadAlerts.length > 0 ? `${unreadAlerts.length} unread` : 'All caught up'}
                  </p>
                </div>
                {unreadAlerts.length > 0 && (
                  <button
                    className={styles.panelAction}
                    onClick={() => void markAllRead.mutateAsync()}
                  >
                    <CheckCheck size={13} />
                    Mark all
                  </button>
                )}
              </div>

              <div className={styles.notifList}>
                {recentAlerts.length === 0 ? (
                  <div className={styles.emptyState}>
                    <Bell size={16} />
                    <span>No alerts yet</span>
                  </div>
                ) : (
                  recentAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      className={styles.notifItem}
                      onClick={() => {
                        if (!alert.read) {
                          void markRead.mutateAsync(alert.id);
                        }
                        setNotifOpen(false);
                        navigate('/alerts');
                      }}
                    >
                      <div className={styles.notifItemTop}>
                        <span className={styles.notifItemTitle}>{alert.title}</span>
                        {!alert.read && <span className={styles.notifUnread}>New</span>}
                      </div>
                      {alert.description && (
                        <p className={styles.notifItemDesc}>{alert.description}</p>
                      )}
                      <div className={styles.notifMeta}>
                        <Clock3 size={11} />
                        <span>{formatAgo(alert.created_at)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <button
                className={styles.viewAllBtn}
                onClick={() => {
                  setNotifOpen(false);
                  navigate('/alerts');
                }}
              >
                View all alerts
                <ArrowRight size={13} />
              </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              className={styles.searchOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSearchOpen(false)}
            >
          <motion.div
            className={styles.searchModal}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.searchBar}>
              <Search size={16} className={styles.searchBarIcon} />
              <input
                ref={searchInputRef}
                className={styles.searchField}
                placeholder="Search tender title, agency, or close date year..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    runFirstSearchAction();
                  }
                }}
              />
              <button className={styles.searchClose} onClick={() => setSearchOpen(false)}>
                Esc
              </button>
            </div>

            <div className={styles.searchResults}>
              {groupedSearchActions.length === 0 ? (
                <div className={styles.emptyState}>
                  <Search size={16} />
                  <span>No matching actions</span>
                </div>
              ) : (
                groupedSearchActions.map((section) => (
                  <div key={section.label} className={styles.searchSection}>
                    <p className={styles.searchSectionTitle}>{section.label}</p>
                    {section.items.map((action) => (
                      <button
                        key={action.id}
                        className={styles.searchResult}
                        onClick={() => runSearchAction(action)}
                      >
                        <div>
                          <p className={styles.searchResultTitle}>{action.title}</p>
                          <p className={styles.searchResultDesc}>{action.description}</p>
                        </div>
                        <ArrowRight size={14} className={styles.searchResultArrow} />
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {createPortal(
        <AnimatePresence>
          {appearanceOpen && (
            <motion.div
              className={styles.appearanceOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAppearanceOpen(false)}
            >
              <motion.div
                className={styles.appearanceModal}
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className={styles.appearanceHeader}>
                  <div>
                    <h2 className={styles.appearanceTitle}>Appearance</h2>
                    <p className={styles.appearanceSub}>Change your workspace theme</p>
                  </div>
                  <button className={styles.appearanceClose} onClick={() => setAppearanceOpen(false)}>
                    <X size={18} />
                  </button>
                </div>

                <div className={styles.appearanceBody}>
                  <div className={styles.appearanceSection}>
                    <p className={styles.appearanceSectionTitle}>Interface theme</p>
                    <p className={styles.appearanceSectionSub}>Choose how Dashboard should look.</p>
                    <ThemePreviewSelector selectedTheme={themeMode} onSelect={setThemeMode} />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </header>
  );
}
