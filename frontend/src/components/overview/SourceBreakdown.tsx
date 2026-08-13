import { useOverviewStats } from '../../hooks/useTenders';
import { formatNumber } from '../../utils/formatters';
import styles from './Chart.module.css';

// ── Canonical source key → display label + color ─────────────
// Matches exactly what source_config.py stores as source_name in the DB.
// Add new portals here when added to source_config.py.
const SOURCE_META: Record<string, { label: string; color: string }> = {
  // Scraped / API sources
  austender:            { label: 'AusTender',                    color: '#7C3AED' },
  tenders_net:          { label: 'Tenders.Net',                  color: '#10B981' },
  tendersnet:            { label: 'Tenders.Net',                 color: '#10B981' },
  nsw_etender:          { label: 'NSW eTender',                  color: '#3B82F6' },
  qld_tenders:          { label: 'QLD Tenders',                  color: '#F59E0B' },
  // Upload-based sources (keys match source_config.py)
  buying_for_victoria:  { label: 'Buying for Victoria',          color: '#06B6D4' },
  sa_tenders:           { label: 'SA Tenders',                   color: '#EF4444' },
  wa_tenders:           { label: 'WA Tenders',                   color: '#10B981' },
  qtenders:             { label: 'QTenders',                     color: '#F59E0B' },
  nt_tenders:           { label: 'Quotations and Tenders Online',color: '#F97316' },
  tas_tenders:          { label: 'Tasmanian Government Tenders', color: '#8B5CF6' },
  tenders_act:          { label: 'Tenders ACT',                  color: '#EC4899' },
  // Legacy / manual
  manual:               { label: 'Manual Upload',                color: '#6B7280' },
};

/** Resolve display label for any source_name key.
 *  Falls back to title-casing the key if not in the map.
 */
function getSourceLabel(key: string): string {
  if (SOURCE_META[key]) return SOURCE_META[key].label;
  // Fallback: replace underscores, title-case each word
  return key
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getSourceColor(key: string): string {
  return SOURCE_META[key]?.color ?? '#6B7280';
}

export default function SourceBreakdown() {
  const { data, isLoading } = useOverviewStats();
  const sources = Object.entries(data?.sources ?? {});
  const total   = sources.reduce((s, [, v]) => s + v, 0);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Data Sources</h3>
          <p className={styles.sub}>Ingestion Breakdown</p>
        </div>
        <div className={styles.pill}>{formatNumber(total)} total</div>
      </div>

      {isLoading ? (
        <div className={styles.sourceList}>
          {[1, 2].map(i => (
            <div key={i}>
              <div className={styles.sourceRow}>
                <div className={styles.shimmer} style={{ width: 8, height: 8, borderRadius: '50%' }} />
                <div className={styles.shimmer} style={{ flex: 1, height: 11 }} />
                <div className={styles.shimmer} style={{ width: 40, height: 11 }} />
              </div>
              <div className={styles.sourceBar}>
                <div className={styles.shimmer} style={{ height: '100%', width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.sourceList}>
          {sources.map(([key, count]) => {
            const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
            const color = getSourceColor(key);
            return (
              <div key={key}>
                <div className={styles.sourceRow}>
                  <span className={styles.sourceDot} style={{ background: color }} />
                  <span className={styles.sourceLabel}>{getSourceLabel(key)}</span>
                  <span className={styles.sourceCount}>{formatNumber(count)}</span>
                </div>
                <div className={styles.sourceBar}>
                  <div
                    className={styles.sourceBarFill}
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}