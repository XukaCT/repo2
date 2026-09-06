import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import styles from '../../pages/HomePage/HomePage.module.css';

// ── Types ─────────────────────────────────────────────────────
export interface StateStat {
  state:       string;
  count:       number;
  total_value: number;
}

type StateCode = 'WA' | 'NT' | 'SA' | 'QLD' | 'NSW' | 'VIC' | 'TAS' | 'ACT';

// ── State metadata ─────────────────────────────────────────────
const STATE_META: Record<string, { name: string; color: string }> = {
  WA:  { name: 'Western Australia',             color: '#EC4899' },
  NT:  { name: 'Northern Territory',            color: '#06B6D4' },
  SA:  { name: 'South Australia',               color: '#10B981' },
  QLD: { name: 'Queensland',                    color: '#F59E0B' },
  NSW: { name: 'New South Wales',               color: '#3B82F6' },
  VIC: { name: 'Victoria',                      color: '#8B5CF6' },
  TAS: { name: 'Tasmania',                      color: '#84CC16' },
  ACT: { name: 'Australian Capital Territory',  color: '#F97316' },
};

// Simplified projected state paths. These preserve the real state boundaries
// while keeping the SVG light enough to maintain by hand.
const STATE_PATHS: Record<StateCode, string> = {
  WA: 'M159.56,426.85l2.64-11.18,4.03-4.49-2.67-9.67-12.33-31-32.67-55.67,5.67-8-13.67-28-1.33-34,7,4,28.67-30,37-14.33,26.67-10.33,13-21.33-3.33-18.33,12-13.67,9.33,11,1-15,13.67.33.33-14.67,29.67-26.67,19.33,6,17.67,7.33,9.52,169.8,4.26,88.73-56.11,21.14-12,18-51.47,8.33-15.19,20-40.67-8.33Z',
  NT: 'M321.22,109.19l13-1.67-4-9.67,22.67-34,24-1-1.67-14,41.94,15,17.73-6.67.33,7,9.33-.33-21,40.33,19.67,16.33,18.74,7.3-1.46,153.02-129.76-1.85-9.52-169.8Z',
  SA: 'M330.74,278.99l129.76,1.85h40.84l-2.88,46.05-4.1,74.06-2.98,62.62-20.25-19.25,1.36-20.85-15.03-.48,1.33-12.67-15.69,1.81,6.36-20.15-26.67,18.33-26.33-36-9-7-37.33-6.67-15.13,5.93-4.26-87.6Z',
  QLD: 'M461,280.34h40.84l-2.48,47.61,110.62,1.02,24.88,3.31,9.33,8.17,5.5-6.33,20.09-.5-1.23-36.75-2.67-13.67-20.44-29.95-1.56-14.71-12.92-1.38-10.33-38-35.96-29.33v-21.67l-6.37-10-1.67-30-9.8-10.69-10.2.69-8-33.33-12-21.67-13,24-2.67,47-23,33.67-36-20-.96,152.52Z',
  NSW: 'M498.86,328.44l109.43.87,26.07,3.47,9.33,8.17,5.5-6.33,20.59-1-.42,14.5-17.51,35.42-13.63,13.97-14,22-22.03,42.94-22.33-12.5-2-12.67-40.67-2.5-11.33-11.83-5.19-10.19-26.31-11.81,4.5-72.5Z',
  VIC: 'M494.36,400.94l26.63,12.44,3.55,6.97,12.65,14.42,40.67,2.5,1.83,11.56,22.51,13.61-9.87,3.18-21.79,6.32-17.5,10.5-15.83-13.17-20.5,9.17-25.31-14.88,2.98-62.62Z',
  TAS: 'M533.53,505.94l16,9,23-1.17-.67,19.67-15.83,17.67-13-.5-5.83-14.67-1.17-14-4.67-8.5,2.17-7.5Z',
  ACT: 'M598.11,428.44h0c2.26,0,4.09,1.83,4.09,4.09v5.21c0,2.26-1.83,4.09-4.09,4.09h0c-2.26,0-4.09-1.83-4.09-4.09v-5.21c0-2.26,1.83-4.09,4.09-4.09Z',
};

// ── Label positions ────────────────────────────────────────────
const STATE_LABELS: Record<string, { x: number; y: number }> = {
  WA: { x: 225, y: 295 },
  NT: { x: 390, y: 200 },
  SA: { x: 408, y: 350 },
  QLD: { x: 550, y: 260 },
  NSW: { x: 582, y: 380 },
  VIC: { x: 538, y: 480 },
  TAS: { x: 552, y: 550 },
  ACT: { x: 598, y: 436 },
};

const ACT_HIT_TARGET = {
  x: 574,
  y: 416,
  width: 48,
  height: 42,
  labelX: 642,
  labelY: 434,
};

// ── Full name → abbreviation normaliser ───────────────────────
const FULL_NAME_MAP: Record<string, string> = {
  'WESTERN AUSTRALIA': 'WA', 'NORTHERN TERRITORY': 'NT',
  'SOUTH AUSTRALIA': 'SA', 'QUEENSLAND': 'QLD',
  'NEW SOUTH WALES': 'NSW', 'VICTORIA': 'VIC',
  'TASMANIA': 'TAS', 'AUSTRALIAN CAPITAL TERRITORY': 'ACT',
  'WA': 'WA', 'NT': 'NT', 'SA': 'SA', 'QLD': 'QLD',
  'NSW': 'NSW', 'VIC': 'VIC', 'TAS': 'TAS', 'ACT': 'ACT',
};

// ── Component ─────────────────────────────────────────────────
interface Props {
  stateStats: StateStat[];
  isLoading:  boolean;
}

export default function AustraliaMap({ stateStats, isLoading }: Props) {
  const [hoveredState,  setHoveredState]  = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [tooltipPos,    setTooltipPos]    = useState<{ x: number; y: number } | null>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const svgRef   = useRef<SVGSVGElement>(null);
  const navigate = useNavigate();

  const statsMap = useMemo(() => {
    const m: Record<string, StateStat> = {};
    stateStats.forEach(s => {
      const raw = s.state?.toUpperCase().trim() ?? '';
      const key = FULL_NAME_MAP[raw];
      if (key) m[key] = s;
    });
    return m;
  }, [stateStats]);

  const maxCount = useMemo(
    () => Math.max(...Object.values(statsMap).map(s => s.count), 1),
    [statsMap],
  );

  const handleMouseMove = (stateKey: string, e: React.MouseEvent<SVGElement>) => {
    if (!mapWrapRef.current) return;
    const rect = mapWrapRef.current.getBoundingClientRect();
    setHoveredState(stateKey);
    setTooltipPos({
      x: e.clientX - rect.left + 22,
      y: e.clientY - rect.top + 12,
    });
  };

  const handleMouseLeave = () => {
    setHoveredState(null);
    setTooltipPos(null);
  };

  const handleStateClick = (key: string) => {
    setSelectedState(prev => prev === key ? null : key);
  };

  const goToStateTenders = (key: string) => {
    navigate(`/tenders?state=${encodeURIComponent(key)}&status=active`);
  };

  return (
    <div className={styles.mapContainer}>

      {/* ── SVG Map ── */}
      <div ref={mapWrapRef} className={styles.mapSvgWrap} aria-busy={isLoading}>
        <svg
          ref={svgRef}
          viewBox="0 0 800 640"
          className={styles.mapSvg}
          style={{ overflow: 'visible' }}
        >
          <defs>
            {Object.entries(STATE_META).map(([key, meta]) => (
              <filter key={key} id={`glow-${key}`} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="7" result="blur" />
                <feFlood floodColor={meta.color} floodOpacity="0.85" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="shadow" />
                <feMerge>
                  <feMergeNode in="shadow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
            <filter id="glow-selected" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="14" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Intelligence grid */}
          {Array.from({ length: 13 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 52} x2="800" y2={i * 52}
              stroke="rgba(99,102,241,0.05)" strokeWidth="1" />
          ))}
          {Array.from({ length: 16 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 52} y1="0" x2={i * 52} y2="640"
              stroke="rgba(99,102,241,0.05)" strokeWidth="1" />
          ))}

          {/* Ocean labels */}
          <text x="62" y="100" fontSize="10" fill="rgba(99,102,241,0.28)"
            fontStyle="italic" letterSpacing="2">INDIAN OCEAN</text>
          <text x="720" y="300" fontSize="10" fill="rgba(99,102,241,0.28)"
            fontStyle="italic" letterSpacing="2"
            transform="rotate(90,720,300)">PACIFIC OCEAN</text>
          <text x="250" y="500" fontSize="10" fill="rgba(99,102,241,0.28)"
            fontStyle="italic" letterSpacing="2">SOUTHERN OCEAN</text>

          {/* State shapes */}
          {Object.entries(STATE_PATHS).map(([key, path]) => {
            const meta      = STATE_META[key];
            const stat      = statsMap[key];
            const count     = stat?.count ?? 0;
            const intensity = count / maxCount;
            const isHovered  = hoveredState  === key;
            const isSelected = selectedState === key;
            const labelPos  = STATE_LABELS[key];
            const isSmall   = key === 'ACT';

            return (
              <g key={key}>
                {/* Glow halo */}
                {(isSelected || isHovered) && (
                  <path
                    d={path}
                    fill={meta.color}
                    fillOpacity={isSelected ? 0.20 : 0.12}
                    stroke="none"
                    filter={`url(#glow-${key})`}
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* Main fill */}
                <path
                  d={path}
                  fill={meta.color}
                  fillOpacity={
                    isSelected ? 0.55
                    : isHovered  ? 0.42
                    : count > 0  ? 0.07 + intensity * 0.30
                    : 0.05
                  }
                  stroke={meta.color}
                  strokeWidth={isSelected ? 2.5 : isHovered ? 1.8 : 1}
                  strokeOpacity={
                    isSelected ? 1
                    : isHovered  ? 0.9
                    : count > 0  ? 0.25 + intensity * 0.55
                    : 0.18
                  }
                  filter={isSelected ? 'url(#glow-selected)' : undefined}
                  style={{
                    cursor: 'pointer',
                    transition: 'fill-opacity 0.2s, stroke-opacity 0.2s, stroke-width 0.15s',
                  }}
                  onMouseMove={e => handleMouseMove(key, e)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleStateClick(key)}
                />

                {isSmall && (
                  <rect
                    x={ACT_HIT_TARGET.x}
                    y={ACT_HIT_TARGET.y}
                    width={ACT_HIT_TARGET.width}
                    height={ACT_HIT_TARGET.height}
                    rx="10"
                    fill="transparent"
                    stroke={isHovered || isSelected ? meta.color : 'transparent'}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    style={{ cursor: 'pointer' }}
                    onMouseMove={e => handleMouseMove(key, e)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleStateClick(key)}
                  />
                )}

                {/* Label */}
                {!isSmall && (
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    fontSize={key === 'TAS' ? 10 : 13}
                    fontWeight={isSelected || isHovered ? '700' : '600'}
                    fill={isSelected || isHovered ? 'var(--map-label-active)' : 'var(--map-label)'}
                    style={{
                      pointerEvents: 'none',
                      userSelect: 'none',
                      transition: 'fill 0.2s',
                      filter: 'drop-shadow(0 1px 1px var(--map-label-shadow))',
                    }}
                  >
                    {key}
                  </text>
                )}

                {isSmall && (
                  <>
                    <line
                      x1={labelPos.x + 4}
                      y1={labelPos.y}
                      x2={ACT_HIT_TARGET.labelX - 16}
                      y2={ACT_HIT_TARGET.labelY - 4}
                      stroke={isHovered || isSelected ? 'var(--map-label-active)' : 'var(--map-callout-line)'}
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      style={{ pointerEvents: 'none' }}
                    />
                    <text
                      x={ACT_HIT_TARGET.labelX}
                      y={ACT_HIT_TARGET.labelY}
                      textAnchor="start"
                      fontSize="11"
                      fontWeight={isSelected || isHovered ? '800' : '700'}
                      fill={isSelected || isHovered ? 'var(--map-label-active)' : 'var(--map-label)'}
                      style={{
                        pointerEvents: 'none',
                        userSelect: 'none',
                        transition: 'fill 0.2s',
                        filter: 'drop-shadow(0 1px 1px var(--map-label-shadow))',
                      }}
                    >
                      ACT
                    </text>
                  </>
                )}

                {/* Count */}
                {count > 0 && !isSmall && (
                  <text
                    x={labelPos.x}
                    y={labelPos.y + 15}
                    textAnchor="middle"
                    fontSize={key === 'TAS' ? 8 : 10}
                    fill={meta.color}
                    opacity={isHovered || isSelected ? 1 : 0.8}
                    style={{ pointerEvents: 'none', userSelect: 'none', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatNumber(count)}
                  </text>
                )}

                {/* Pulsing dot */}
                {count > 0 && (
                  <motion.circle
                    cx={labelPos.x}
                    cy={isSmall ? labelPos.y : labelPos.y - 22}
                    r={isSelected ? 6 : isHovered ? 5.5 : 3.5 + intensity * 4}
                    fill={meta.color}
                    opacity={isSelected ? 1 : 0.65 + intensity * 0.35}
                    filter={`url(#glow-${key})`}
                    animate={
                      isSelected
                        ? { r: [4, 7, 4], opacity: [0.85, 1, 0.85] }
                        : intensity > 0.4
                          ? { opacity: [0.65, 1, 0.65] }
                          : {}
                    }
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* ── Hover tooltip ── */}
        <AnimatePresence>
          {tooltipPos && hoveredState && (
            <motion.div
              className={styles.mapTooltip}
              style={{
                left: tooltipPos.x,
                top: Math.max(tooltipPos.y, 4),
              }}
              initial={{ opacity: 0, scale: 0.93, y: 4 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{    opacity: 0, scale: 0.93, y: 4 }}
              transition={{ duration: 0.1 }}
            >
              {(() => {
                const meta = STATE_META[hoveredState];
                const stat = statsMap[hoveredState];
                return (
                  <>
                    <div className={styles.tooltipHeader}>
                      <span
                        className={styles.tooltipDot}
                        style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
                      />
                      <strong style={{ color: meta.color, fontSize: 13 }}>{meta.name}</strong>
                    </div>
                    <div className={styles.tooltipRows}>
                      <div className={styles.tooltipRow}>
                        <span>Total Tenders</span>
                        <strong>{stat ? formatNumber(stat.count) : 'No data'}</strong>
                      </div>
                      {stat?.total_value ? (
                        <div className={styles.tooltipRow}>
                          <span>Total Value</span>
                          <strong>{formatCurrency(stat.total_value)}</strong>
                        </div>
                      ) : null}
                    </div>
                    <p className={styles.tooltipCta}>
                      {stat?.count
                        ? 'Click to inspect tenders'
                        : 'No tenders for this state'}
                    </p>
                  </>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── State selected info panel ── */}
      <AnimatePresence>
        {selectedState && (
          <motion.div
            className={styles.statePanel}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0  }}
            exit={{    opacity: 0, x: 32 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <div
              className={styles.statePanelHeader}
              style={{ borderBottomColor: STATE_META[selectedState]?.color + '30' }}
            >
              <div className={styles.statePanelTitle}>
                <span
                  className={styles.statePanelDot}
                  style={{
                    background: STATE_META[selectedState]?.color,
                    boxShadow:  `0 0 8px ${STATE_META[selectedState]?.color}`,
                  }}
                />
                <div>
                  <h3 style={{ color: STATE_META[selectedState]?.color, fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>
                    {STATE_META[selectedState]?.name}
                  </h3>
                  <p className={styles.statePanelSub}>
                    {statsMap[selectedState]
                      ? `${formatNumber(statsMap[selectedState].count)} Tenders · ${formatCurrency(statsMap[selectedState].total_value)}`
                      : 'No data available'}
                  </p>
                </div>
              </div>
              <button className={styles.statePanelClose} onClick={() => setSelectedState(null)}>
                <X size={14} />
              </button>
            </div>

            <div className={styles.statePanelList}>
              {!statsMap[selectedState] ? (
                <div className={styles.statePanelEmpty}>
                  <MapPin size={26} style={{ color: 'var(--text-dim)', marginBottom: 8 }} />
                  <p>No tender data for {selectedState}</p>
                </div>
              ) : (
                <div className={styles.statePanelStats}>
                  <div className={styles.statPanelStatItem}>
                    <span className={styles.statPanelStatIcon} style={{ background: STATE_META[selectedState]?.color + '20', color: STATE_META[selectedState]?.color }}>
                      <MapPin size={14} />
                    </span>
                    <div>
                      <p className={styles.statPanelStatLabel}>Total Tenders</p>
                      <p className={styles.statPanelStatValue} style={{ color: STATE_META[selectedState]?.color }}>
                        {formatNumber(statsMap[selectedState].count)}
                      </p>
                    </div>
                  </div>
                  <div className={styles.statPanelStatItem}>
                    <span className={styles.statPanelStatIcon} style={{ background: STATE_META[selectedState]?.color + '20', color: STATE_META[selectedState]?.color }}>
                      <DollarSign size={14} />
                    </span>
                    <div>
                      <p className={styles.statPanelStatLabel}>Total Value</p>
                      <p className={styles.statPanelStatValue} style={{ color: STATE_META[selectedState]?.color }}>
                        {formatCurrency(statsMap[selectedState].total_value)}
                      </p>
                    </div>
                  </div>
                  <button
                    className={styles.statePanelViewBtn}
                    style={{ background: STATE_META[selectedState]?.color + '18', borderColor: STATE_META[selectedState]?.color + '40', color: STATE_META[selectedState]?.color }}
                    onClick={() => goToStateTenders(selectedState)}
                  >
                    View {selectedState} Tenders →
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
