import { motion } from 'framer-motion';
import { useTenders } from '../../hooks/useTenders';
import { formatCurrency, formatAgo } from '../../utils/formatters';
import { sectorLabel, sectorColor } from '../../utils/tender.utils';
import { ExternalLink, FileText } from 'lucide-react';
import styles from './RecentActivityFeed.module.css';

export default function RecentActivityFeed() {
  const { data, isLoading } = useTenders({ page: 1, page_size: 8, status: 'closed' });
  const items = data?.items ?? [];

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Recent Tenders</h3>
        </div>
      </div>

      <div className={styles.list}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeletonRow}>
                <div className={styles.shimmer} style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className={styles.shimmer} style={{ height: 11, width: '75%' }} />
                  <div className={styles.shimmer} style={{ height: 10, width: '50%' }} />
                </div>
                <div className={styles.shimmer} style={{ height: 11, width: 50 }} />
              </div>
            ))
          : items.map((tender, i) => (
              <motion.div
                key={tender.id}
                className={styles.row}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div
                  className={styles.iconBox}
                  style={{ background: `${sectorColor(tender.sector)}18`, color: sectorColor(tender.sector) }}
                >
                  <FileText size={13} />
                </div>
                <div className={styles.info}>
                  <p className={styles.tenderTitle}>{tender.title}</p>
                  <p className={styles.tenderMeta}>
                    <span>{tender.agency}</span>
                    {tender.sector && (
                      <>
                        <span className={styles.dot}>·</span>
                        <span>{sectorLabel(tender.sector)}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className={styles.right}>
                  <p className={styles.value}>
                    {tender.contract_value ? formatCurrency(tender.contract_value) : '—'}
                  </p>
                  <p className={styles.time}>{formatAgo(tender.created_at)}</p>
                  {tender.source_url && (
                    <a
                      href={tender.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.link}
                    >
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
      </div>
    </div>
  );
}