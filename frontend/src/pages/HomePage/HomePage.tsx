import { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Database, Layers, ArrowRight,
  Shield, Globe, BarChart3,
  Bell, Zap,
} from 'lucide-react';
import AustraliaMap, { type StateStat } from '../../components/home/AustraliaMap';
import { useOverviewStats, useStateStats, useSectorStats } from '../../hooks/useTenders';
import { useAlerts } from '../../hooks/useAlerts';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, formatNumber, formatAgo } from '../../utils/formatters';
import styles from './HomePage.module.css';

// ── Source config ─────────────────────────────────────────────
const SOURCE_CONFIG: Record<string, {
  label:    string;
  color:    string;
  bg:       string;
  icon:     React.ElementType;
  desc:     string;
}> = {
  austender:   { label: 'AusTender',   color: '#7C3AED', bg: 'rgba(124,58,237,0.1)',  icon: Shield,   desc: 'Commonwealth Procurement Portal' },
  tendersnet:  { label: 'Tenders.Net', color: '#10B981', bg: 'rgba(16,185,129,0.1)',  icon: Globe,    desc: 'National Tender Aggregator' },
  qld_tenders: { label: 'QLD Tenders', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  icon: Database, desc: 'Queensland Government Tenders' },
  nsw_etender: { label: 'NSW eTender', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  icon: Database, desc: 'New South Wales eTendering' },
  vic_tenders: { label: 'VIC Tenders', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)',   icon: Database, desc: 'Victorian Government Tenders' },
  buying_for_victoria: { label: 'Buying for Victoria', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)', icon: Database, desc: 'Buying for Victoria' },
  wa_tenders:  { label: 'WA Tenders',  color: '#EC4899', bg: 'rgba(236,72,153,0.1)',  icon: Database, desc: 'Western Australian Tenders' },
  sa_tenders:  { label: 'SA Tenders',  color: '#10B981', bg: 'rgba(16,185,129,0.1)',  icon: Database, desc: 'South Australian Tenders' },
  tas_tenders: { label: 'TAS Tenders', color: '#84CC16', bg: 'rgba(132,204,22,0.1)',  icon: Database, desc: 'Tasmanian Government Tenders' },
  tenders_act: { label: 'Tenders ACT', color: '#F97316', bg: 'rgba(249,115,22,0.1)',  icon: Database, desc: 'Australian Capital Territory Tenders' },
  manual:      { label: 'Manual',      color: '#6B7280', bg: 'rgba(107,114,128,0.1)', icon: Database, desc: 'Manually Added Opportunities' },
};

const SECTOR_COLORS: Record<string, string> = {
  facility_management: '#7C3AED', construction: '#F59E0B',
  cleaning: '#06B6D4', it_services: '#3B82F6',
  healthcare: '#10B981', transportation: '#EC4899', other: '#6B7280',
};

const SECTOR_LABELS: Record<string, string> = {
  facility_management: 'Facility Mgmt', construction: 'Construction',
  cleaning: 'Cleaning', it_services: 'IT Services',
  healthcare: 'Healthcare', transportation: 'Transportation', other: 'Other',
};

const STATE_ORDER = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'ACT', 'NT', 'TAS'] as const;
const STATE_COLORS: Record<string, string> = {
  NSW: '#3B82F6', VIC: '#8B5CF6', QLD: '#F59E0B',
  SA: '#10B981', WA: '#EC4899', ACT: '#F97316',
  NT: '#06B6D4', TAS: '#84CC16',
};
const STATE_NAME_MAP: Record<string, string> = {
  'NEW SOUTH WALES': 'NSW',
  VICTORIA: 'VIC',
  QUEENSLAND: 'QLD',
  'SOUTH AUSTRALIA': 'SA',
  'WESTERN AUSTRALIA': 'WA',
  'AUSTRALIAN CAPITAL TERRITORY': 'ACT',
  'NORTHERN TERRITORY': 'NT',
  TASMANIA: 'TAS',
  NSW: 'NSW',
  VIC: 'VIC',
  QLD: 'QLD',
  SA: 'SA',
  WA: 'WA',
  ACT: 'ACT',
  NT: 'NT',
  TAS: 'TAS',
};

const normaliseStateKey = (state?: string | null) => {
  const raw = state?.toUpperCase().trim() ?? '';
  if (!raw || raw === 'UNKNOWN') return null;
  const direct = STATE_NAME_MAP[raw];
  if (direct) return direct;
  const cleaned = raw.replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const code = cleaned.match(/\b(NSW|VIC|QLD|SA|WA|ACT|NT|TAS)\b/)?.[1];
  if (code) return code;
  const fullName = Object.keys(STATE_NAME_MAP).find(name => cleaned.includes(name));
  return fullName ? STATE_NAME_MAP[fullName] : null;
};

const STORAGE_KEY_COUNT     = 'wr_last_total_tenders';
const STORAGE_KEY_TIMESTAMP = 'wr_last_visit_ts';
const BASELINE_TTL_MS       = 30 * 60 * 1000;

export default function HomePage() {
  const navigate = useNavigate();

  const { data: overviewStats, isLoading: overviewLoading } = useOverviewStats();
  const { data: stateStats,    isLoading: stateLoading    } = useStateStats();
  const { data: sectorStats,   isLoading: sectorLoading   } = useSectorStats();
  const { data: alertsData }                                 = useAlerts();
  const { user }                                             = useAuth();

  // ── New tenders since last visit ─────────────────────────
  const [snapshot] = useState(() => {
    const rawCount = localStorage.getItem(STORAGE_KEY_COUNT);
    return {
      prevCount: rawCount !== null ? Number(rawCount) : null,
      prevTs:    localStorage.getItem(STORAGE_KEY_TIMESTAMP),
    };
  });

  const newSinceLastVisit = useMemo<number | null>(() => {
    if (overviewStats?.total_tenders == null || snapshot.prevCount === null) return null;
    const diff = overviewStats.total_tenders - snapshot.prevCount;
    return diff > 0 ? diff : 0;
  }, [overviewStats?.total_tenders, snapshot.prevCount]);

  const lastVisitTs = snapshot.prevTs;

  useEffect(() => {
    if (overviewStats?.total_tenders == null) return;
    const ageMs = snapshot.prevTs
      ? Date.now() - new Date(snapshot.prevTs).getTime()
      : Infinity;
    if (ageMs > BASELINE_TTL_MS || !snapshot.prevTs) {
      localStorage.setItem(STORAGE_KEY_COUNT,     String(overviewStats.total_tenders));
      localStorage.setItem(STORAGE_KEY_TIMESTAMP, new Date().toISOString());
    }
  }, [overviewStats?.total_tenders, snapshot.prevTs]);

  const unreadAlerts = useMemo(
    () => (alertsData ?? []).filter(a => !a.read).length,
    [alertsData],
  );

  const firstName = useMemo(() => {
    const name = user?.name ?? '';
    return name.split(' ')[0] || 'Analyst';
  }, [user]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const today = useMemo(() =>
    new Date().toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }),
    [],
  );

  // ── Source cards ─────────────────────────────────────────
  const sourceCards = useMemo(() => {
    const sources = Object.entries(overviewStats?.sources ?? {});
    const total   = sources.reduce((s, [, v]) => s + v, 0);
    return sources
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => {
        const cfg = SOURCE_CONFIG[key] ?? {
          label: key.replace(/_/g, ' '), color: '#6B7280',
          bg: 'rgba(107,114,128,0.1)', icon: Database, desc: 'Data source',
        };
        return { key, ...cfg, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
      });
  }, [overviewStats?.sources]);

  const topSectors = useMemo(() =>
    (sectorStats ?? []).filter(s => s.sector).sort((a, b) => b.count - a.count).slice(0, 6),
    [sectorStats],
  );

  const maxSectorCount = useMemo(
    () => Math.max(...topSectors.map(s => s.count), 1),
    [topSectors],
  );

  const validStateStats = useMemo<StateStat[]>(() => {
    const aggregate: Record<string, StateStat> = {};
    (stateStats ?? []).forEach(s => {
      const key = normaliseStateKey(s.state);
      if (!key) return;
      aggregate[key] = {
        state: key,
        count: (aggregate[key]?.count ?? 0) + (s.count ?? 0),
        total_value: (aggregate[key]?.total_value ?? 0) + (s.total_value ?? 0),
      };
    });
    return Object.values(aggregate);
  }, [stateStats]);

  const stateLegendItems = useMemo(() => {
    const statsByState = new Map(validStateStats.map(s => [s.state, s]));
    return STATE_ORDER.map(state => ({
      state,
      count: statsByState.get(state)?.count ?? 0,
      color: STATE_COLORS[state],
    })).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state);
    });
  }, [validStateStats]);

  return (
    <div className={`${styles.page} page-enter`}>

      {/* ── Welcome strip ── */}
      <motion.div
        className={styles.welcomeStrip}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {/* LEFT — greeting + badges */}
        <div className={styles.welcomeLeft}>
          <div className={styles.welcomeTextBlock}>
            <h1 className={styles.welcomeHeading}>
              {greeting}, <span className={styles.welcomeName}>{firstName}!</span>
            </h1>
            <p className={styles.welcomeSub}>{today}</p>
          </div>
          <div className={styles.welcomeBadges}>
            {unreadAlerts > 0 && (
              <motion.button
                className={styles.alertBadge}
                onClick={() => navigate('/alerts')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Bell size={11} />
                {unreadAlerts} unread alert{unreadAlerts !== 1 ? 's' : ''}
                <ArrowRight size={11} />
              </motion.button>
            )}
            {overviewStats?.active_tenders != null && (
              <div className={styles.activeBadge}>
                <Zap size={11} />
                {formatNumber(overviewStats.active_tenders)} Active Tenders
              </div>
            )}
          </div>
        </div>

        {/* DIVIDER */}
        <div className={styles.stripDivider} />

        {/* RIGHT — new tenders since last visit only */}
        <div className={styles.welcomeRight}>
          <div className={styles.newTendersBlock}>
            <div className={styles.newTendersHeader}>
              <span className={styles.newTendersLabel}>New since last visit</span>
            </div>
            {overviewLoading ? (
              <div className={styles.newTendersCount} style={{ color: 'var(--text-dim)' }}>…</div>
            ) : newSinceLastVisit === null ? (
              <div className={styles.newTendersCount}>First visit</div>
            ) : newSinceLastVisit === 0 ? (
              <div className={styles.newTendersCount} style={{ color: 'var(--text-muted)' }}>
                No New Tenders
              </div>
            ) : (
              <div className={styles.newTendersCount}>
                +{formatNumber(newSinceLastVisit)} Tenders
              </div>
            )}
            {lastVisitTs && (
              <p className={styles.newTendersSub}>Last visit {formatAgo(lastVisitTs)}</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Page header ── */}
      <motion.div
        className={styles.pageHeader}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y:  0  }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div>
          <h2 className={styles.heading}>
            War Room
            <span className={styles.headingAccent}> · Intelligence Map</span>
          </h2>
          <p className={styles.headingSub}>
            Live Tender Intelligence Across Australian States and Territories
          </p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.livePill}>
            <motion.span
              className={styles.liveDot}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            Live Feed
          </div>
          <div className={styles.totalPill}>
            <Layers size={12} />
            {overviewLoading ? '…' : formatNumber(overviewStats?.total_tenders)} tenders
          </div>
        </div>
      </motion.div>

      {/* ── Main layout: map + sector pulse ── */}
      <div className={styles.mainGrid}>

        {/* LEFT — Australia map */}
        <motion.div
          className={styles.mapCard}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0  }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className={styles.mapCardHeader}>
            <div>
              <h3 className={styles.mapCardTitle}>
                <Globe size={15} style={{ color: 'var(--accent-lighter)' }} />
                Tender Distribution Map
              </h3>
              <p className={styles.mapCardSub}>
                Click Any State to View Active Tenders
              </p>
            </div>
            <button
              className={styles.viewAllBtn}
              onClick={() => navigate('/tenders')}
            >
              View All <ArrowRight size={12} />
            </button>
          </div>

          <AustraliaMap
            stateStats={validStateStats}
            isLoading={stateLoading}
          />

          <div className={styles.mapLegend}>
            {stateLegendItems.map(s => (
              <div key={s.state} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: s.color, boxShadow: `0 0 5px ${s.color}` }} />
                <span className={styles.legendState}>{s.state}</span>
                <span className={styles.legendCount} style={{ color: s.color }}>{formatNumber(s.count)}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* RIGHT — Sector pulse */}
        <motion.div
          className={styles.sectorCard}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0  }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className={styles.sectorCardHeader}>
            <div>
              <h3 className={styles.sectorCardTitle}>
                <BarChart3 size={15} style={{ color: 'var(--accent-lighter)' }} />
                Sector Pulse
              </h3>
              <p className={styles.sectorCardSub}>Active Tenders by Industry</p>
            </div>
          </div>

          <div className={styles.sectorList}>
            {sectorLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={styles.sectorRowSkeleton}>
                  <div className={styles.shimmer} style={{ height: 11, width: '60%' }} />
                  <div className={styles.shimmer} style={{ height: 8, width: '100%', marginTop: 6 }} />
                </div>
              ))
            ) : (
              topSectors.map((sector, i) => {
                const color = SECTOR_COLORS[sector.sector] ?? '#6B7280';
                const pct   = Math.round((sector.count / maxSectorCount) * 100);
                const label = SECTOR_LABELS[sector.sector] ?? sector.sector;
                return (
                  <motion.div
                    key={sector.sector}
                    className={styles.sectorRow}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0  }}
                    transition={{ delay: 0.2 + i * 0.06 }}
                  >
                    <div className={styles.sectorRowTop}>
                      <div className={styles.sectorRowLeft}>
                        <span className={styles.sectorDot} style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
                        <span className={styles.sectorLabel}>{label}</span>
                      </div>
                      <div className={styles.sectorRowRight}>
                        <span className={styles.sectorCount} style={{ color }}>{formatNumber(sector.count)}</span>
                        <span className={styles.sectorValue}>{formatCurrency(sector.total_value)}</span>
                      </div>
                    </div>
                    <div className={styles.sectorBarWrap}>
                      <motion.div
                        className={styles.sectorBarFill}
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.3 + i * 0.06, ease: 'easeOut' }}
                      />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          <div className={styles.sectorSummary}>
            <div className={styles.sectorSummaryItem}>
              <p className={styles.sectorSummaryLabel}>Total Pipeline Value</p>
              <p className={styles.sectorSummaryValue}>
                {overviewLoading ? '…' : formatCurrency(overviewStats?.total_value)}
              </p>
            </div>
            <div className={styles.sectorSummaryItem}>
              <p className={styles.sectorSummaryLabel}>Avg per Tender</p>
              <p className={styles.sectorSummaryValue}>
                {overviewLoading ? '…' : formatCurrency(overviewStats?.avg_value)}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Source cards row ── */}
      <div>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            <Database size={14} style={{ color: 'var(--accent-lighter)' }} />
            Data Source Intelligence
          </h3>
          <p className={styles.sectionSub}>
            Live contribution from each ingestion source
          </p>
        </div>

        <div className={styles.sourceGrid}>
          {overviewLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.sourceCardSkeleton}>
                <div className={styles.shimmer} style={{ height: 40, width: 40, borderRadius: 10 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className={styles.shimmer} style={{ height: 13, width: '60%' }} />
                  <div className={styles.shimmer} style={{ height: 10, width: '80%' }} />
                  <div className={styles.shimmer} style={{ height: 6, width: '100%', borderRadius: 99 }} />
                </div>
              </div>
            ))
          ) : (
            sourceCards.map((src, i) => (
              <motion.div
                key={src.key}
                className={styles.sourceCard}
                style={{ '--src-color': src.color } as React.CSSProperties}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0  }}
                transition={{ delay: 0.1 + i * 0.07 }}
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
              >
                <div className={styles.sourceCardTop}>
                  <div className={styles.sourceCardIcon} style={{ background: src.bg, color: src.color }}>
                    <src.icon size={18} />
                  </div>
                  <div className={styles.sourceCardPctBadge} style={{ color: src.color, background: src.bg, borderColor: src.color + '30' }}>
                    {src.pct}%
                  </div>
                </div>
                <h4 className={styles.sourceCardLabel}>{src.label}</h4>
                <p className={styles.sourceCardDesc}>{src.desc}</p>
                <div className={styles.sourceCardStats}>
                  <div className={styles.sourceCardStat}>
                    <span className={styles.sourceCardStatLabel}>Tenders</span>
                    <span className={styles.sourceCardStatValue} style={{ color: src.color }}>{formatNumber(src.count)}</span>
                  </div>
                  <div className={styles.sourceCardStat}>
                    <span className={styles.sourceCardStatLabel}>Share</span>
                    <span className={styles.sourceCardStatValue} style={{ color: src.color }}>{src.pct}%</span>
                  </div>
                </div>
                <div className={styles.sourceCardBarWrap}>
                  <motion.div
                    className={styles.sourceCardBarFill}
                    style={{ background: src.color, boxShadow: `0 0 8px ${src.color}60` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${src.pct}%` }}
                    transition={{ duration: 0.7, delay: 0.2 + i * 0.07, ease: 'easeOut' }}
                  />
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
