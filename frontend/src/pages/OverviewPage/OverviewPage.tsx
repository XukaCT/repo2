import { useMemo, useEffect, useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, Layers, CheckCircle2,
  TrendingUp, Activity, Clock,
} from 'lucide-react';
import StatCard from '../../components/overview/StatCard';
import BidsBySectorChart from '../../components/overview/BidsBySectorChart';
import RegionalBidChart from '../../components/overview/RegionalBidChart';
import RecentActivityFeed from '../../components/overview/RecentActivityFeed';
import SourceBreakdown from '../../components/overview/SourceBreakdown';
import { useOverviewStats, useTenders } from '../../hooks/useTenders';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import styles from './OverviewPage.module.css';

// ── Storage ───────────────────────────────────────────────────
const HISTORY_KEY    = 'wr_stats_history';
const SNAPSHOT_TS    = 'wr_stats_snapshot_ts';
const WRITE_INTERVAL = 30 * 60 * 1000;
const MAX_AGE_MS     = 30 * 24 * 60 * 60 * 1000;

// ── Time window options ───────────────────────────────────────
const WINDOWS = [
  { label: '30 min',  ms: 30 * 60 * 1000,           key: '30m' },
  { label: '6 hrs',   ms: 6  * 60 * 60 * 1000,      key: '6h'  },
  { label: '12 hrs',  ms: 12 * 60 * 60 * 1000,      key: '12h' },
  { label: '24 hrs',  ms: 24 * 60 * 60 * 1000,      key: '24h' },
  { label: '7 days',  ms: 7  * 24 * 60 * 60 * 1000, key: '7d'  },
  { label: '30 days', ms: 30 * 24 * 60 * 60 * 1000, key: '30d' },
] as const;

type WindowKey = typeof WINDOWS[number]['key'];

interface HistoryEntry {
  ts:             string;
  total_value:    number;
  total_tenders:  number;
  active_tenders: number;
  closed_tenders: number;
}

// ── Helpers ───────────────────────────────────────────────────
function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeHistory(entry: HistoryEntry): HistoryEntry[] {
  const history = readHistory();
  const now     = Date.now();
  const pruned  = history.filter(e => now - new Date(e.ts).getTime() < MAX_AGE_MS);
  pruned.push(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(pruned));
  return pruned;
}

// Always returns the closest entry — no safety guard, shows 0% instead of null
function findClosestEntry(history: HistoryEntry[], targetMs: number, nowMs: number): HistoryEntry | null {
  if (!history.length) return null;
  const targetTime = nowMs - targetMs;
  let best: HistoryEntry | null = null;
  let bestDiff = Infinity;
  for (const entry of history) {
    const entryTime = new Date(entry.ts).getTime();
    if (entryTime > targetTime) continue;
    const diff = Math.abs(entryTime - targetTime);
    if (diff < bestDiff) {
      bestDiff = diff;
      best     = entry;
    }
  }
  return best;
}

// Always returns a number — 0 when no previous data instead of undefined
function pctChange(current: number | undefined, previous: number | undefined): number {
  if (current == null || previous == null || previous === 0) return 0;
  const diff = ((current - previous) / previous) * 100;
  return Math.round(diff * 10) / 10;
}

// ── Component ─────────────────────────────────────────────────
export default function OverviewPage() {
  const { data: stats, isLoading } = useOverviewStats();
  const { data: periodTenderData, isLoading: periodLoading } = useTenders({ page: 1, page_size: 1000 });
  const [windowKey, setWindowKey]  = useState<WindowKey>('30m');
  const [history, setHistory]      = useState<HistoryEntry[]>(() => readHistory());
  const [comparisonClockMs, setComparisonClockMs] = useState<number | null>(null);

  // Wall clock updates outside render (React purity / compiler).
  useLayoutEffect(() => {
    const tick = () => setComparisonClockMs(Date.now());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Write new snapshot every 30 min
  useEffect(() => {
    if (!stats) return;
    const prevTs = localStorage.getItem(SNAPSHOT_TS);
    const ageMs  = prevTs
      ? Date.now() - new Date(prevTs).getTime()
      : Infinity;

    if (ageMs > WRITE_INTERVAL || !prevTs) {
      const snapshotTs = new Date().toISOString();
      const entry: HistoryEntry = {
        ts:             snapshotTs,
        total_value:    stats.total_value    ?? 0,
        total_tenders:  stats.total_tenders  ?? 0,
        active_tenders: stats.active_tenders ?? 0,
        closed_tenders: stats.closed_tenders ?? 0,
      };
      const nextHistory = writeHistory(entry);
      localStorage.setItem(SNAPSHOT_TS, snapshotTs);
      queueMicrotask(() => setHistory(nextHistory));
    }
  }, [stats]);

  // Find comparison snapshot for selected window
  const selectedWindow = WINDOWS.find(w => w.key === windowKey)!;
  const periodStats = useMemo(() => {
    if (comparisonClockMs == null || !periodTenderData?.items) return null;
    const startTime = comparisonClockMs - selectedWindow.ms;
    const tenders = periodTenderData.items.filter((tender) => {
      const rawDate = tender.created_at ?? tender.published_date ?? tender.close_date;
      if (!rawDate) return false;
      const normalized = /[Z+-]\d{2}:?\d{2}$|Z$/.test(rawDate) ? rawDate : rawDate + 'Z';
      const time = new Date(normalized).getTime();
      return Number.isFinite(time) && time >= startTime && time <= comparisonClockMs;
    });
    const totalValue = tenders.reduce((sum, tender) => sum + (tender.contract_value ?? 0), 0);
    const byStatusValue = (status: string) =>
      tenders
        .filter(tender => tender.status === status)
        .reduce((sum, tender) => sum + (tender.contract_value ?? 0), 0);

    return {
      total_tenders: tenders.length,
      active_tenders: tenders.filter(tender => tender.status === 'active').length,
      closed_tenders: tenders.filter(tender => tender.status === 'closed').length,
      upcoming_tenders: tenders.filter(tender => tender.status === 'upcoming').length,
      total_value: totalValue,
      avg_value: tenders.length ? totalValue / tenders.length : 0,
      active_value: byStatusValue('active'),
      closed_value: byStatusValue('closed'),
      upcoming_value: byStatusValue('upcoming'),
      sources: tenders.reduce<Record<string, number>>((acc, tender) => {
        const key = tender.source_name || 'Unknown';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    };
  }, [comparisonClockMs, periodTenderData, selectedWindow.ms]);
  const displayStats = periodStats ?? stats;
  const baseline       = useMemo(
    () =>
      comparisonClockMs == null
        ? null
        : findClosestEntry(history, selectedWindow.ms, comparisonClockMs),
    [history, selectedWindow.ms, comparisonClockMs],
  );

  // Compute live changes — always a number, 0 when no history
  const changes = useMemo(() => ({
    total_value:    pctChange(displayStats?.total_value,    baseline?.total_value),
    total_tenders:  pctChange(displayStats?.total_tenders,  baseline?.total_tenders),
    active_tenders: pctChange(displayStats?.active_tenders, baseline?.active_tenders),
    closed_tenders: pctChange(displayStats?.closed_tenders, baseline?.closed_tenders),
  }), [displayStats, baseline]);

  // How old is the baseline
  const baselineAge = useMemo(() => {
    if (!baseline || comparisonClockMs == null) return null;
    const diffMs   = comparisonClockMs - new Date(baseline.ts).getTime();
    const diffMin  = Math.round(diffMs / 60000);
    if (diffMin < 60)  return `${diffMin}m ago`;
    const diffHrs  = Math.round(diffMin / 60);
    if (diffHrs < 24)  return `${diffHrs}h ago`;
    const diffDays = Math.round(diffHrs / 24);
    return `${diffDays}d ago`;
  }, [baseline, comparisonClockMs]);

  const statCards = [
    {
      title:    'Total Tender Value',
      value:    formatCurrency(displayStats?.total_value),
      sub:      `Avg ${formatCurrency(displayStats?.avg_value)} Per Tender`,
      icon:     DollarSign,
      gradient: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
      change:   changes.total_value,
    },
    {
      title:    'Total Tender Bids',
      value:    formatNumber(displayStats?.total_tenders),
      sub:      `Across ${Object.keys(displayStats?.sources ?? {}).length} Data Sources`,
      icon:     Layers,
      gradient: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
      change:   changes.total_tenders,
    },
    {
      title:    'Active Bids',
      value:    formatNumber(displayStats?.active_tenders ?? 0),
      sub:      displayStats?.upcoming_tenders
        ? `+ ${formatNumber(displayStats.upcoming_tenders)} Upcoming`
        : 'Live procurement opportunities',
      icon:     Activity,
      gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      change:   changes.active_tenders,
    },
    {
      title:    'Closed Bids',
      value:    formatNumber(displayStats?.closed_tenders),
      sub:      'Historical Awarded Contracts',
      icon:     CheckCircle2,
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
      change:   changes.closed_tenders,
    },
  ];

  return (
    <div className={`${styles.page} page-enter`}>

      {/* ── Stat cards header with time window filter ── */}
      <div className={styles.statGridHeader}>
        <div className={styles.statGridLabel}>
          <Clock size={13} style={{ color: 'var(--text-dim)' }} />
          <span className={styles.statGridLabelText}>
            {baseline
              ? `Showing ${selectedWindow.label}; compared vs ${baselineAge}`
              : `Showing tenders added in the last ${selectedWindow.label}`}
          </span>
        </div>
        <div className={styles.windowPicker}>
          {WINDOWS.map(w => (
            <button
              key={w.key}
              className={`${styles.windowBtn} ${windowKey === w.key ? styles.windowBtnActive : ''}`}
              onClick={() => setWindowKey(w.key)}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className={styles.statGrid}>
        {statCards.map((card, i) => (
          <StatCard key={card.title} {...card} loading={isLoading || periodLoading} delay={i * 0.07} />
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className={styles.chartsRow}>
        <BidsBySectorChart />
        <RegionalBidChart />
      </div>

      {/* ── Bottom row ── */}
      <div className={styles.bottomRow}>
        <div className={styles.feedWrap}>
          <RecentActivityFeed />
        </div>
        <div className={styles.sideWrap}>
          <SourceBreakdown />
          <motion.div
            className={styles.miniCard}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.08 }}
          >
            <div className={styles.miniHeader}>
              <TrendingUp size={14} className={styles.miniIcon} />
              <span>Quick Stats</span>
            </div>
            <div className={styles.miniGrid}>
              {[
                { label: 'Avg Tender',    value: formatCurrency(stats?.avg_value) },
                { label: 'Total Sources', value: String(Object.keys(stats?.sources ?? {}).length) },
                { label: 'Closed',        value: formatNumber(stats?.closed_tenders) },
                { label: 'Active',        value: formatNumber(stats?.active_tenders ?? 0) },
              ].map(item => (
                <div key={item.label} className={styles.miniStat}>
                  <p className={styles.miniLabel}>{item.label}</p>
                  <p className={styles.miniValue}>{isLoading ? '…' : item.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

    </div>
  );
}
