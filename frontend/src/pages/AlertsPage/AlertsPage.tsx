import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, Plus, Search, X, Trash2, Check,
  CheckCheck, AlertCircle, TrendingUp, FileText,
  Info, Building2, Mail, MessageSquare, Monitor,
  Target, Clock, MapPin, DollarSign, Save,
  ChevronLeft, ChevronRight, BarChart2, Activity,
} from 'lucide-react';
import { formatAgo } from '../../utils/formatters';
import {
  useAlerts, useMarkRead, useMarkAllRead,
  useDeleteAlert, useSavedSearches, useCreateSavedSearch,
  useDeleteSavedSearch, useToggleSavedSearch,
  type AlertItem, type SavedSearchItem,
} from '../../hooks/useAlerts';
import { useNotificationPreferences } from '../../hooks/useNotificationPreferences';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
} from '../../utils/browserNotifications';
import styles from './AlertsPage.module.css';
import clsx from 'clsx';

// ── Constants ─────────────────────────────────────────────────
const PAGE_SIZE = 10;

// ── Types ─────────────────────────────────────────────────────
type AlertPriority = 'high' | 'medium' | 'low';
type AlertType     = 'tender' | 'bid' | 'system' | 'report';

// ── Helpers ───────────────────────────────────────────────────
const TYPE_CONFIG: Record<AlertType, { icon: React.ElementType; color: string; bg: string }> = {
  tender: { icon: Target,     color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
  bid:    { icon: TrendingUp, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  report: { icon: FileText,   color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  system: { icon: Info,       color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
};

const PRIORITY_CONFIG: Record<AlertPriority, { label: string; cls: string }> = {
  high:   { label: 'High',   cls: styles.priHigh   },
  medium: { label: 'Medium', cls: styles.priMedium  },
  low:    { label: 'Low',    cls: styles.priLow     },
};

const SECTOR_LABELS: Record<string, string> = {
  cleaning: 'Cleaning', construction: 'Construction',
  facility_management: 'Facility Mgmt', it_services: 'IT Services',
  healthcare: 'Healthcare', transportation: 'Transportation',
  other: 'Other', '': 'All Sectors',
};

const bold = (content: React.ReactNode) => <strong>{content}</strong>;
const stateText = (text: string) => <strong className="appToastStateText">{text}</strong>;

const getToastErrorMessage = (error: unknown) => {
  if (!isAxiosError(error)) return 'Unexpected error';

  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (error.response?.status) return `Request failed (${error.response.status})`;
  return error.message || 'Network request failed';
};

// ── Pagination component ──────────────────────────────────────
interface PaginationProps {
  page:       number;
  totalPages: number;
  total:      number;
  pageSize:   number;
  onChange:   (p: number) => void;
}

function Pagination({ page, totalPages, total, pageSize, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  const pages: (number | '…')[] = [];
  const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };

  add(1);
  if (page - 2 > 2)                  pages.push('…');
  if (page - 1 > 1)                  add(page - 1);
  if (page > 1 && page < totalPages) add(page);
  if (page + 1 < totalPages)         add(page + 1);
  if (page + 2 < totalPages - 1)     pages.push('…');
  add(totalPages);

  return (
    <div className={styles.pagination}>
      <span className={styles.paginationInfo}>
        {from}–{to} of {total} alert{total !== 1 ? 's' : ''}
      </span>
      <div className={styles.paginationControls}>
        <button
          className={styles.pageBtn}
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className={styles.pageEllipsis}>…</span>
          ) : (
            <button
              key={p}
              className={clsx(styles.pageBtn, p === page && styles.pageBtnActive)}
              onClick={() => onChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          className={styles.pageBtn}
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Alert Activity Summary card ───────────────────────────────
function AlertActivitySummary({ alerts }: { alerts: AlertItem[] }) {
  const types: { key: AlertType; label: string; color: string; bg: string }[] = [
    { key: 'tender', label: 'Tender', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
    { key: 'bid',    label: 'Bid',    color: '#3B82F6', bg: 'rgba(59,130,246,0.12)'  },
    { key: 'report', label: 'Report', color: '#10B981', bg: 'rgba(16,185,129,0.12)'  },
    { key: 'system', label: 'System', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  ];

  const total = alerts.length || 1;

  return (
    <div className={styles.sideCard}>
      <div className={styles.sideCardHeader}>
        <div>
          <h3 className={styles.sideCardTitle}>Alert Activity</h3>
          <p className={styles.sideCardSub}>Breakdown by Type</p>
        </div>
        <div className={styles.sideCardIcon}>
          <BarChart2 size={14} />
        </div>
      </div>

      <div className={styles.activityList}>
        {types.map(t => {
          const count  = alerts.filter(a => a.type === t.key).length;
          const unread = alerts.filter(a => a.type === t.key && !a.read).length;
          const pct    = Math.round((count / total) * 100);
          const Icon   = TYPE_CONFIG[t.key].icon;
          return (
            <div key={t.key} className={styles.activityRow}>
              <div className={styles.activityLeft}>
                <div
                  className={styles.activityIcon}
                  style={{ background: t.bg, color: t.color }}
                >
                  <Icon size={12} />
                </div>
                <span className={styles.activityLabel}>{t.label}</span>
              </div>

              <div className={styles.activityRight}>
                <div className={styles.activityBarWrap}>
                  <div
                    className={styles.activityBar}
                    style={{ width: `${pct}%`, background: t.color }}
                  />
                </div>
                <span className={styles.activityCount}>{count}</span>
                {unread > 0 && (
                  <span className={styles.activityUnread}>{unread} new</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Quick Stats card ──────────────────────────────────────────
function QuickStats({
  alerts,
  searches,
}: {
  alerts:   AlertItem[];
  searches: SavedSearchItem[];
}) {
  // Capture "now" once on mount so render stays pure (React disallows Date.now() during render)
  const [mountedAt] = useState(() => Date.now());
  const thisWeek = useMemo(() => {
    const sevenDaysAgo = mountedAt - 7 * 24 * 60 * 60 * 1000;
    return alerts.filter(a => new Date(a.created_at).getTime() > sevenDaysAgo).length;
  }, [alerts, mountedAt]);

  const readCount = alerts.filter(a => a.read).length;
  const readRate  = alerts.length > 0
    ? Math.round((readCount / alerts.length) * 100)
    : 0;

  const notifOn = searches.filter(s => s.notifications).length;

  const typeCounts = (['tender', 'bid', 'report', 'system'] as AlertType[]).map(t => ({
    type:  t,
    count: alerts.filter(a => a.type === t).length,
  }));
  const topType      = [...typeCounts].sort((a, b) => b.count - a.count)[0];
  const topTypeLabel = topType?.count > 0
    ? topType.type.charAt(0).toUpperCase() + topType.type.slice(1)
    : '—';
  const topTypeSub   = topType?.count > 0
    ? `${topType.count} alert${topType.count !== 1 ? 's' : ''}`
    : 'No alerts yet';

  const stats = [
    {
      label: 'Alerts This Week',
      value: String(thisWeek),
      sub:   'Last 7 Days',
      color: '#3B82F6',
    },
    {
      label: 'Read Rate',
      value: `${readRate}%`,
      sub:   `${readCount} of ${alerts.length} Read`,
      color: '#10B981',
    },
    {
      label: 'Top Alert Type',
      value: topTypeLabel,
      sub:   topTypeSub,
      color: '#7C3AED',
    },
    {
      label: 'Live Searches',
      value: String(notifOn),
      sub:   'Notifications On',
      color: '#F59E0B',
    },
  ];

  return (
    <div className={styles.sideCard}>
      <div className={styles.sideCardHeader}>
        <div>
          <h3 className={styles.sideCardTitle}>Quick Stats</h3>
          <p className={styles.sideCardSub}>At a Glance</p>
        </div>
        <div className={styles.sideCardIcon}>
          <Activity size={14} />
        </div>
      </div>

      <div className={styles.quickStatsList}>
        {stats.map((s, i) => (
          <div key={i} className={styles.quickStatRow}>
            <div className={styles.quickStatLeft}>
              <p className={styles.quickStatLabel}>{s.label}</p>
              <p className={styles.quickStatSub}>{s.sub}</p>
            </div>
            <span
              className={styles.quickStatValue}
              style={{ color: s.color }}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Create saved search modal ─────────────────────────────────
function CreateAlertModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    name: '', sector: '', state: '', minValue: '', maxValue: '', notifications: true,
  });
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));
  const createSavedSearch = useCreateSavedSearch();
  const deleteSavedSearch = useDeleteSavedSearch();

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const searchName = form.name.trim();
    const toastId = toast.loading(
      <span>{bold('Creating')} {searchName} ...
      </span>
    );

    try {
      const created = await createSavedSearch.mutateAsync({
        name:          searchName,
        sector:        form.sector || undefined,
        state:         form.state  || undefined,
        min_value:     Number(form.minValue) || 0,
        max_value:     Number(form.maxValue) || 0,
        notifications: form.notifications,
      }) as SavedSearchItem;

      toast.dismiss(toastId);
      toast.success(<span> {bold(`${searchName}`)} has been {stateText('Created')}</span>, 
      {
        className: 'appToastToggleOn',
        action: created?.id
          ? {
              label: 'Undo',
              onClick: () => deleteSavedSearch.mutate(created.id),
            }
          : undefined,
      });
      onClose();
    } catch (error) {
      toast.dismiss(toastId);
      toast.error('Alert search could not be created', 
        {
        className: 'appToastToggleOn',
        description: "(" + getToastErrorMessage(error) + ")",
      });
    }
  };

  const modal = (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{    opacity: 0, y: 16, scale: 0.97  }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Create Saved Search</h3>
            <p className={styles.modalSub}>Get Notified When Matching Tenders are Published</p>
          </div>
          <button className={styles.modalClose} onClick={onClose}><X size={16} /></button>
        </div>

          <div className={styles.modalBody}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Search Name</label>
              <input
                className={styles.formInput}
                placeholder="e.g. Facility Mgmt NSW $1M+"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Sector</label>
                <select className={styles.formSelect} value={form.sector} onChange={e => set('sector', e.target.value)}>
                  {Object.entries(SECTOR_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>State</label>
                <select className={styles.formSelect} value={form.state} onChange={e => set('state', e.target.value)}>
                  {['', 'NSW', 'VIC', 'QLD', 'SA', 'WA', 'ACT', 'NT', 'TAS'].map(s => (
                    <option key={s} value={s}>{s || 'All States'}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Min Value (AUD)</label>
                <input type="number" className={styles.formInput} placeholder="500000"
                  value={form.minValue} onChange={e => set('minValue', e.target.value)} />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Max Value (AUD)</label>
                <input type="number" className={styles.formInput} placeholder="10000000"
                  value={form.maxValue} onChange={e => set('maxValue', e.target.value)} />
              </div>
            </div>

            <div className={styles.toggleRow}>
              <div>
                <p className={styles.toggleLabel}>Enable Notifications</p>
                <p className={styles.toggleSub}>Get Alerted When New Matches are Found</p>
              </div>
              <button
                className={clsx(styles.toggle, form.notifications && styles.toggleOn)}
                onClick={() => set('notifications', !form.notifications)}
              >
                <span className={styles.toggleThumb} />
              </button>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={createSavedSearch.isPending}
            >
              <Save size={13} />
              {createSavedSearch.isPending ? 'Saving…' : 'Save Search'}
            </button>
          </div>
        </motion.div>
      </motion.div>
  );

  return createPortal(modal, document.body);
}

// ── Main page ─────────────────────────────────────────────────
export default function AlertsPage() {
  const [searchParams, setSearchParams]     = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const setSearch = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next.trim()) params.set('search', next);
    else params.delete('search');
    setSearchParams(params, { replace: true });
  };
  const [typeFilter,     setTypeFilter]     = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showModal,      setShowModal]      = useState(false);
  const [page,           setPage]           = useState(1);
  const { prefs: notifPrefs, setPrefs: setNotifPrefs } = useNotificationPreferences();
  const [browserPermission, setBrowserPermission] = useState(getBrowserNotificationPermission());

  const updateNotifPref = async (key: 'email' | 'sms' | 'push') => {
    const labels = {
      email: 'Email Alerts',
      sms:   'SMS Alerts',
      push:  'Browser',
    };
    const previousValue = notifPrefs[key];
    const nextValue = !previousValue;

    if (key === 'push' && nextValue) {
      const permission = await requestBrowserNotificationPermission();
      setBrowserPermission(permission);

      if (permission !== 'granted') {
        toast.error('Browser notifications are blocked', {
          description: permission === 'denied'
            ? 'Allow this site in your browser settings, then enable Browser again.'
            : 'Browser permission is required before this channel can be enabled.',
        });
        return;
      }
    }

    setNotifPrefs((prev) => ({ ...prev, [key]: nextValue }));

    if (key === 'push' && nextValue) {
      showBrowserNotification('Browser notifications enabled', {
        body: 'New bid alerts will now appear in this browser.',
        tag: 'alerts-browser-enabled',
      });
    }

    toast(
      <span>{bold(labels[key])} has been {stateText(nextValue ? 'Enabled' : 'Disabled')}</span>,
      {
      className: nextValue ? 'appToastToggleOn' : 'appToastToggleOff',
      action: {
        label: 'Undo',
        onClick: () => {
          setNotifPrefs((prev) => ({ ...prev, [key]: previousValue }));
        },
      },
      },
    );
  };

  // ── Real data hooks ───────────────────────────────────────
  const { data: alertsData,   isLoading: alertsLoading   } = useAlerts();
  const { data: searchesData, isLoading: searchesLoading } = useSavedSearches();
  const markRead          = useMarkRead();
  const markAllRead       = useMarkAllRead();
  const deleteAlert       = useDeleteAlert();
  const deleteSavedSearch = useDeleteSavedSearch();
  const toggleSavedSearch = useToggleSavedSearch();

  const handleToggleSavedSearch = async (searchItem: SavedSearchItem) => {
    const nextEnabled = !searchItem.notifications;
    const toastId = toast.loading(
      <span>{stateText(nextEnabled ? 'Enabling' : 'Muting')} {bold(`${searchItem.name}`)}</span>,
      {className: nextEnabled ? 'appToastToggleOn' : 'appToastToggleOff',}
    );
    try {
      await toggleSavedSearch.mutateAsync(searchItem.id);

      toast.dismiss(toastId);
      toast.success(<span>{bold(`${searchItem.name}`)} has been {stateText(nextEnabled ? 'Enabled' : 'Muted')}</span>, {
        className: nextEnabled ? 'appToastToggleOn' : 'appToastToggleOff',
        action: {
          label: 'Undo',
          onClick: () => toggleSavedSearch.mutate(searchItem.id),
        },
      });
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(<span>{stateText(`${searchItem.name}`)} could not be updated</span>, {
         className: 'appToastToggleOff',
         description: "(" + getToastErrorMessage(error) + ")",
      });
    }
  };

  const handleDeleteSavedSearch = async (searchItem: SavedSearchItem) => {
    const toastId = toast.loading(<span>{stateText("Deleting")} {bold(`${searchItem.name}`)}...</span>,
    {className: 'appToastToggleOff'}
    );

    try {
      await deleteSavedSearch.mutateAsync(searchItem.id);

      toast.dismiss(toastId);
      toast.success(<span>{bold(`${searchItem.name}`)} has been {stateText('Deleted')}
      </span>,
      {className: 'appToastToggleOn'}
      );
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(<span>{bold(`${searchItem.name}`)} could not be deleted</span>, {
         description: "(" + getToastErrorMessage(error) + ")",
      });
    }
  };

  const alerts   = useMemo(() => alertsData   ?? [], [alertsData]);
  const searches = useMemo(() => searchesData ?? [], [searchesData]);

  const unreadCount = alerts.filter(a => !a.read).length;

  // ── Filter alerts ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return alerts.filter(a =>
      (!q || a.title.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q)) &&
      (typeFilter === 'all'     || a.type === typeFilter) &&
      (priorityFilter === 'all' || a.priority === priorityFilter) &&
      (!showUnreadOnly || !a.read)
    );
  }, [alerts, search, typeFilter, priorityFilter, showUnreadOnly]);

  // Reset page to 1 whenever filters change
  const filterKey = `${search}|${typeFilter}|${priorityFilter}|${showUnreadOnly}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  // ── Pagination derived values ─────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handlePageChange = (p: number) => {
    setPage(p);
    document.getElementById('alert-list-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Stat cards ────────────────────────────────────────────
  const statCards = [
    { label: 'Unread Alerts',   value: String(unreadCount),     sub: 'Require Attention',    color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   icon: AlertCircle },
    { label: 'Active Searches', value: String(searches.length), sub: 'Monitoring Live Feeds', color: '#7C3AED', bg: 'rgba(124,58,237,0.1)',  icon: Target      },
    { label: 'Total Alerts',    value: String(alerts.length),   sub: 'All Time',              color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  icon: Bell        },
    {
      label: 'Notifications',
      value: Object.values(notifPrefs).filter(Boolean).length + '/3',
      sub: 'Channels Active', color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: Mail,
    },
  ];

  return (
    <div className={`${styles.page} page-enter`}>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.heading}>Alerts &amp; Notifications</h2>
          <p className={styles.headingSub}>Manage Your Bid Intelligence Alerts and Saved Search Criteria</p>
        </div>
        <div className={styles.headerActions}>
          {unreadCount > 0 && (
            <button className={styles.ghostBtn} onClick={() => markAllRead.mutate()}>
              <CheckCheck size={13} /> Mark All Read
            </button>
          )}
          <button className={styles.primaryBtn} onClick={() => setShowModal(true)}>
            <Plus size={13} /> Create Alert
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className={styles.statGrid}>
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            className={styles.statCard}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0  }}
            transition={{ delay: i * 0.07 }}
          >
            <div className={styles.statIcon} style={{ background: card.bg, color: card.color }}>
              <card.icon size={18} />
            </div>
            <div>
              <p className={styles.statLabel}>{card.label}</p>
              <p className={styles.statValue} style={{ color: card.color }}>{card.value}</p>
              <p className={styles.statSub}>{card.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Main content grid ── */}
      <div className={styles.contentGrid}>

        {/* LEFT — Alerts list */}
        <div className={styles.alertsColumn}>

          {/* Filter bar */}
          <div className={styles.filterBar} id="alert-list-top">
            <div className={styles.searchWrap}>
              <Search size={13} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search alerts…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className={styles.clearSearch} onClick={() => setSearch('')}>
                  <X size={11} />
                </button>
              )}
            </div>

            <div className={styles.filterRow}>
              <div className={styles.filterGroup}>
                {(['all', 'tender', 'bid', 'report', 'system'] as const).map(t => (
                  <button
                    key={t}
                    className={clsx(styles.filterChip, typeFilter === t && styles.filterChipActive)}
                    onClick={() => setTypeFilter(t)}
                  >
                    {t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              <div className={styles.filterRight}>
                <select
                  className={styles.filterSelect}
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value)}
                >
                  <option value="all">All Priority</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <button
                  className={clsx(styles.filterChip, showUnreadOnly && styles.filterChipActive)}
                  onClick={() => setShowUnreadOnly(v => !v)}
                >
                  Unread only
                </button>
                {alerts.some(a => a.read) && (
                  <button
                    className={styles.clearReadBtn}
                    onClick={() => alerts.filter(a => a.read).forEach(a => deleteAlert.mutate(a.id))}
                  >
                    <Trash2 size={11} /> Clear Read
                  </button>
                )}
              </div>
            </div>

            <p className={styles.alertCount}>
              {filtered.length} alert{filtered.length !== 1 ? 's' : ''}
              {unreadCount > 0 && <span className={styles.unreadPill}>{unreadCount} unread</span>}
            </p>
          </div>

          {/* ── Top pagination ── */}
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onChange={handlePageChange}
          />

          {/* Alert list */}
          <div className={styles.alertList}>
            {alertsLoading ? (
              <div className={styles.emptyAlerts}>
                <Bell size={32} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>Loading alerts…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className={styles.emptyAlerts}>
                <Bell size={32} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No alerts found</p>
                <p className={styles.emptySub}>Try adjusting your filters or create a new saved search</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {paginated.map((alert, i) => {
                  const tc = TYPE_CONFIG[alert.type as AlertType] ?? TYPE_CONFIG.system;
                  const pc = PRIORITY_CONFIG[alert.priority as AlertPriority] ?? PRIORITY_CONFIG.medium;
                  return (
                    <motion.div
                      key={alert.id}
                      className={clsx(styles.alertCard, !alert.read && styles.alertCardUnread)}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0   }}
                      exit={{    opacity: 0, x: 12, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      layout
                    >
                      {!alert.read && <div className={styles.unreadDot} />}

                      <div className={styles.alertIcon} style={{ background: tc.bg, color: tc.color }}>
                        <tc.icon size={15} />
                      </div>

                      <div className={styles.alertContent}>
                        <div className={styles.alertTopRow}>
                          <h4 className={clsx(styles.alertTitle, !alert.read && styles.alertTitleUnread)}>
                            {alert.title}
                          </h4>
                          <span className={clsx(styles.priorityBadge, pc.cls)}>{pc.label}</span>
                        </div>
                        <p className={styles.alertDesc}>{alert.description}</p>
                        <div className={styles.alertMeta}>
                          <Clock size={11} />
                          <span>{formatAgo(alert.created_at)}</span>
                          <span className={styles.metaDot}>·</span>
                          <span className={styles.alertType}>{alert.type}</span>
                        </div>
                      </div>

                      <div className={styles.alertActions}>
                        {!alert.read && (
                          <button
                            className={styles.alertActionBtn}
                            title="Mark as read"
                            onClick={() => markRead.mutate(alert.id)}
                          >
                            <Check size={13} />
                          </button>
                        )}
                        <button
                          className={clsx(styles.alertActionBtn, styles.alertDeleteBtn)}
                          title="Delete alert"
                          onClick={() => deleteAlert.mutate(alert.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          {/* ── Bottom pagination ── */}
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onChange={handlePageChange}
          />

        </div>

        {/* RIGHT — sidebar: 4 cards in order */}
        <div className={styles.sideColumn}>

          {/* 1 — Saved searches */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}>
              <div>
                <h3 className={styles.sideCardTitle}>Saved Searches</h3>
                <p className={styles.sideCardSub}>Auto-Alert On New Matches</p>
              </div>
              <button className={styles.sideAddBtn} onClick={() => setShowModal(true)}>
                <Plus size={13} />
              </button>
            </div>

            <div className={styles.searchList}>
              {searchesLoading ? (
                <p className={styles.emptySub}>Loading…</p>
              ) : searches.length === 0 ? (
                <div className={styles.emptyAlerts}>
                  <Target size={24} className={styles.emptyIcon} />
                  <p className={styles.emptySub}>No saved searches yet. Create one to get started.</p>
                </div>
              ) : (
                <AnimatePresence>
                  {searches.map((s, i) => (
                    <motion.div
                      key={s.id}
                      className={styles.savedSearchCard}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{    opacity: 0, height: 0 }}
                      transition={{ delay: i * 0.05 }}
                      layout
                    >
                      <div className={styles.ssHeader}>
                        <h4 className={styles.ssName}>{s.name}</h4>
                        <div className={styles.ssActions}>
                          <button
                            className={clsx(styles.ssToggle, s.notifications && styles.ssToggleOn)}
                            onClick={() => void handleToggleSavedSearch(s)}
                            title={s.notifications ? 'Disable notifications' : 'Enable notifications'}
                          >
                            <span className={styles.ssToggleThumb} />
                          </button>
                          <button
                            className={styles.ssDeleteBtn}
                            onClick={() => void handleDeleteSavedSearch(s)}
                            title="Delete search"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      </div>

                      <div className={styles.ssCriteria}>
                        {s.sector && (
                          <div className={styles.ssCrit}>
                            <Building2 size={10} /> {SECTOR_LABELS[s.sector] ?? s.sector}
                          </div>
                        )}
                        {s.state && (
                          <div className={styles.ssCrit}>
                            <MapPin size={10} /> {s.state}
                          </div>
                        )}
                        {(s.min_value > 0 || s.max_value > 0) && (
                          <div className={styles.ssCrit}>
                            <DollarSign size={10} />
                            {s.min_value > 0 ? `$${(s.min_value / 1000000).toFixed(1)}M` : '—'}
                            {' – '}
                            {s.max_value > 0 ? `$${(s.max_value / 1000000).toFixed(1)}M` : '—'}
                          </div>
                        )}
                      </div>

                      <div className={styles.ssMeta}>
                        <span className={clsx(styles.ssNotifBadge, s.notifications ? styles.ssNotifOn : styles.ssNotifOff)}>
                          {s.notifications ? <Bell size={12} /> : <BellOff size={12} />}
                          {s.notifications ? 'Notifications On' : 'Muted'}
                        </span>
                        <span className={styles.ssMatch}>
                          {s.match_count} matches · {s.last_matched ? formatAgo(s.last_matched) : 'Never'}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* 2 — Notification channels */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}>
              <div>
                <h3 className={styles.sideCardTitle}>Notification Channels</h3>
                <p className={styles.sideCardSub}>How You Want to be Alerted</p>
              </div>
            </div>

            <div className={styles.notifList}>
                {([
                  { key: 'email', icon: Mail,         label: 'Email Alerts',       sub: 'Delivered to Your Inbox'    },
                  { key: 'sms',   icon: MessageSquare, label: 'SMS Alerts',         sub: 'Text Message to Your Phone' },
                  { key: 'push',  icon: Monitor,       label: 'Browser',            sub: 'Desktop Browser Notifications' },
                ] as const).map(channel => (
                <div key={channel.key} className={styles.notifRow}>
                  <div className={styles.notifLeft}>
                    <div className={clsx(
                      styles.notifIcon,
                      notifPrefs[channel.key] ? styles.notifIconOn : styles.notifIconOff,
                    )}>
                      <channel.icon size={14} />
                    </div>
                    <div>
                      <p className={styles.notifLabel}>{channel.label}</p>
                      <p className={styles.notifSub}>
                        {channel.key === 'push'
                          ? `${channel.sub} · ${browserPermission}`
                          : channel.sub}
                      </p>
                    </div>
                  </div>
                  <button
                    className={clsx(styles.toggle, notifPrefs[channel.key] && styles.toggleOn)}
                    onClick={() => void updateNotifPref(channel.key)}
                  >
                    <span className={styles.toggleThumb} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 3 — Alert Activity Summary */}
          <AlertActivitySummary alerts={alerts} />

          {/* 4 — Quick Stats */}
          <QuickStats alerts={alerts} searches={searches} />

        </div>
      </div>

      {/* Modal — portal to document.body so position:fixed anchors to viewport */}
      <AnimatePresence>
        {showModal && <CreateAlertModal onClose={() => setShowModal(false)} />}
      </AnimatePresence>

    </div>
  );
}
