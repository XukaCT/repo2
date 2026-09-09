import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import {
  X, Building2, MapPin, DollarSign, Calendar,
  Tag, ExternalLink, Globe, Hash, Briefcase
} from 'lucide-react';
import type { Tender } from '../../types/tender.types';
import { formatCurrencyFull, formatDate } from '../../utils/formatters';
import { normalizeTenderStatus, sectorLabel, sectorColor } from '../../utils/tender.utils';
import styles from './TenderDetailModal.module.css';
import { tendersApi } from '../../api/endpoints/tenders.api';

interface Props {
  tender: Tender | null;
  onClose: () => void;
}

function Row({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>
        <Icon size={13} className={styles.rowIcon} />
        <span>{label}</span>
      </div>
      <p className={mono ? styles.rowValueMono : styles.rowValue}>{value}</p>
    </div>
  );
}

export default function TenderDetailModal({ tender, onClose }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!tender) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [tender, onClose]);

  if (!tender) return null;

  const hasContractValue = tender.contract_value != null;
  const status = normalizeTenderStatus(tender.status);
  
  // FIX 1: Force lowercase for strict CSS class matching
  const cssClass = status ? status.toLowerCase() : 'closed';
  
  // FIX 2: Only allow bidding on active/open tenders
  const canBid = cssClass === 'active' || cssClass === 'open';

  const handlePursueBid = async () => {
    if (confirm("Are you sure you want to convert this to an active Bid?")) {
      setIsSubmitting(true);
      try {
        const result = await tendersApi.pushToBidTracker(tender.id);
        
        if (result.status === 'success') {
           alert(`Bid Created successfully! ID: ${result.new_bid_id}`);
           onClose();
        } else {
           alert(result.message || "Failed to create bid.");
        }
      } catch (err) {
        alert("Failed to connect to the server.");
        console.error(err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div
                className={styles.sectorDot}
                style={{ background: sectorColor(tender.sector) }}
              />
              <div>
                <p className={styles.headerSector}>{sectorLabel(tender.sector)}</p>
                <p className={styles.headerSource}>{tender.source_name} | {tender.source_id}</p>
              </div>
            </div>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          <div className={styles.titleSection}>
            <h2 className={styles.title}>{tender.title}</h2>
            {/* Applies the forced lowercase class */}
            <span className={styles[`status_${cssClass}`]}>{status}</span>
          </div>

          {tender.description && (
            <div className={styles.descSection}>
              <p className={styles.descLabel}>Description / Category</p>
              <p className={styles.desc}>{tender.description}</p>
            </div>
          )}

          <div className={styles.detailsGrid}>
            <div className={styles.detailsCol}>
              <p className={styles.colLabel}>Contract Details</p>
              <Row icon={Building2} label="Agency" value={tender.agency} />
              <Row
                icon={DollarSign}
                label="Contract Value"
                value={hasContractValue ? formatCurrencyFull(tender.contract_value) : 'Not Disclosed'}
              />
              <Row icon={MapPin} label="State" value={tender.state ?? 'Federal'} />
              <Row icon={Tag} label="Sector" value={sectorLabel(tender.sector)} />
            </div>

            <div className={styles.detailsCol}>
              <p className={styles.colLabel}>Dates &amp; Source</p>
              <Row icon={Calendar} label="Close Date" value={formatDate(tender.close_date)} />
              <Row icon={Calendar} label="Published" value={formatDate(tender.published_date)} />
              <Row icon={Globe} label="Source" value={tender.source_name} />
              <Row icon={Hash} label="Source ID" value={tender.source_id} mono />
            </div>
          </div>

          {hasContractValue && (
            <div className={styles.valueBanner}>
              <span className={styles.valueBannerLabel}>Contract Value</span>
              <span className={styles.valueBannerAmount}>
                {formatCurrencyFull(tender.contract_value)}
              </span>
            </div>
          )}

          <div className={styles.footerActions}>
            <button className={styles.cancelBtn} onClick={onClose}>Close</button>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              {/* Conditionally renders only if the tender is open/active */}
              {canBid && (
                <button 
                  className={styles.primaryBtn} 
                  onClick={handlePursueBid}
                  disabled={isSubmitting}
                  style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                >
                  <Briefcase size={14} style={{ marginRight: '6px' }} />
                  {isSubmitting ? 'Creating...' : 'Create Bid Record'}
                </button>
              )}

              {tender.source_url && (
                <a
                  href={tender.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.primaryBtn}
                >
                  <ExternalLink size={14} style={{ marginRight: '6px' }} />
                  View on AusTender
                </a>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}