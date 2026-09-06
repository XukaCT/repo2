import { motion } from 'framer-motion';
import {
  Building2,
  MapPin,
  DollarSign,
  Calendar,
  ExternalLink,
  FileText,
} from 'lucide-react';
import type { Tender } from '../../types/tender.types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  normalizeTenderStatus,
  sectorLabel,
  sectorColor,
} from '../../utils/tender.utils';
import styles from './TenderCard.module.css';
import clsx from 'clsx';

interface TenderCardProps {
  tender: Tender;
  index: number;
  onSelect: (tender: Tender) => void;
}

export default function TenderCard({
  tender,
  index,
  onSelect,
}: TenderCardProps) {
  const status = normalizeTenderStatus(tender.status);

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      onClick={() => onSelect(tender)}
    >
      {/* Left accent bar using sector colour */}
      <div
        className={styles.accentBar}
        style={{ background: sectorColor(tender.sector) }}
      />

      <div className={styles.body}>
        {/* Top row */}
        <div className={styles.topRow}>
          <div
            className={styles.iconWrap}
            style={{
              background: `${sectorColor(tender.sector)}18`,
              color: sectorColor(tender.sector),
            }}
          >
            <FileText size={14} />
          </div>
          <div className={styles.badges}>
            {tender.sector && (
              <span
                className={styles.sectorBadge}
                style={{
                  color: sectorColor(tender.sector),
                  background: `${sectorColor(tender.sector)}15`,
                  borderColor: `${sectorColor(tender.sector)}30`,
                }}
              >
                {sectorLabel(tender.sector)}
              </span>
            )}
            <span
              className={clsx(styles.statusBadge, styles[`status_${status}`])}
            >
              {status}
            </span>
            {tender.source_id && (
              <span
                className={styles.sourceIdBadge}
                title={`Source ID: ${tender.source_id}`}
              >
                {tender.source_id}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <div className={styles.titleRow}>
          <h4 className={styles.title}>{tender.title}</h4>
        </div>

        {/* Description */}
        {tender.description && (
          <p className={styles.description}>{tender.description}</p>
        )}

        {/* Meta grid */}
        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <Building2 size={12} className={styles.metaIcon} />
            <span className={styles.metaText}>{tender.agency}</span>
          </div>
          <div className={styles.metaItem}>
            <MapPin size={12} className={styles.metaIcon} />
            <span className={styles.metaText}>{tender.state ?? 'Federal'}</span>
          </div>
          <div className={styles.metaItem}>
            <DollarSign size={12} className={styles.metaIcon} />
            <span className={styles.metaValue}>
              {tender.contract_value
                ? formatCurrency(tender.contract_value)
                : '—'}
            </span>
          </div>
          <div className={styles.metaItem}>
            <Calendar size={12} className={styles.metaIcon} />
            <span className={styles.metaText}>
              {tender.close_date ? formatDate(tender.close_date) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {tender.source_url && (
          <a
            href={tender.source_url}
            target="_blank"
            rel="noreferrer"
            className={styles.linkBtn}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={13} />
          </a>
        )}
        <button className={styles.detailBtn}>View Details</button>
      </div>
    </motion.div>
  );
}
