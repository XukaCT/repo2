import { motion } from 'framer-motion';
import {
  Download, FileText, BarChart3,
  TrendingUp, Database,
} from 'lucide-react';
import { useOverviewStats, useSectorStats, useStateStats } from '../../hooks/useTenders';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import styles from './ReportsPage.module.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function ReportsPage() {

  const { data: overview } = useOverviewStats();
  const { data: sectors  } = useSectorStats();
  const { data: states   } = useStateStats();

  const downloadFromBackend = async (endpoint: string, filename: string) => {
    try {
      const res = await fetch(`${API_URL}/reports/${endpoint}`, {
        credentials: 'include', // <--- This tells the browser to send the Frappe login cookie
        headers: { 
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Report download failed:', err);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const exportSectorCSV    = () => downloadFromBackend('sector',     `warroom-sector-report-${today}.csv`);
  const exportStateCSV     = () => downloadFromBackend('regional',   `warroom-regional-report-${today}.csv`);
  const exportOverviewCSV  = () => downloadFromBackend('overview',   `warroom-overview-report-${today}.csv`);
  const exportHighValueCSV = () => downloadFromBackend('high-value', `warroom-high-value-report-${today}.csv`);

  const statCards = [
    { label:'Total Reports',       value:'4',                                  sub:'Available Now',           icon:FileText,  gradient:'linear-gradient(135deg,#7C3AED,#4F46E5)' },
    { label:'Contracts Covered',   value:formatNumber(overview?.total_tenders), sub:'Across All Reports',     icon:Database,  gradient:'linear-gradient(135deg,#3B82F6,#06B6D4)' },
    { label:'Total Value Tracked', value:formatCurrency(overview?.total_value), sub:'Combined Contract Value', icon:BarChart3, gradient:'linear-gradient(135deg,#10B981,#059669)' },
    { label:'Sectors Analysed',    value:String(sectors?.length ?? 0),          sub:'Procurement Categories',  icon:TrendingUp, gradient:'linear-gradient(135deg,#F59E0B,#EF4444)' },
  ];

  const quickExports = [
    { title:'Sector Analysis',      desc:`${sectors?.length ?? 0} sectors - Server-generated CSV`,           icon:BarChart3,  color:'#7C3AED', action:exportSectorCSV,    ready:!!sectors?.length },
    { title:'Regional Report',      desc:`${states?.length ?? 0} states - Contract distribution`,             icon:TrendingUp, color:'#3B82F6', action:exportStateCSV,     ready:!!states?.length  },
    { title:'Full Overview Export', desc:`${formatNumber(overview?.total_tenders)} contracts - All metrics`,  icon:Database,   color:'#10B981', action:exportOverviewCSV, ready:!!overview       },
    { title:'High-Value Contracts', desc:'Real tenders above $1M - Sorted by value',                          icon:FileText,   color:'#F59E0B', action:exportHighValueCSV, ready:true              },
  ];

  return (
    <div className={`${styles.page} page-enter`}>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.heading}>Reports</h2>
          <p className={styles.headingSub}>Generate and Export Procurement Intelligence Reports</p>
        </div>
      </div>

      <div className={styles.statGrid}>
        {statCards.map((card, i) => (
          <motion.div key={card.label} className={styles.statCard}
            initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.07 }}>
            <div className={styles.statIcon} style={{ background: card.gradient }}>
              <card.icon size={16} />
            </div>
            <div>
              <p className={styles.statLabel}>{card.label}</p>
              <p className={styles.statValue}>{card.value ?? '-'}</p>
              <p className={styles.statSub}>{card.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Quick Exports</h3>
        <div className={styles.exportGrid}>
          {quickExports.map((item, i) => (
            <motion.div key={item.title} className={styles.exportCard}
              initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.06 }}>
              <div className={styles.exportCardIcon} style={{ background:`${item.color}18`, color:item.color }}>
                <item.icon size={20} />
              </div>
              <div className={styles.exportCardBody}>
                <h4 className={styles.exportCardTitle}>{item.title}</h4>
                <p className={styles.exportCardDesc}>{item.desc}</p>
              </div>
              <button className={styles.exportCardBtn} onClick={item.action} disabled={!item.ready}
                style={{ borderColor:`${item.color}40`, color:item.color, background:`${item.color}10` }}>
                <Download size={13} />
                {item.ready ? 'Export' : 'Loading...'}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
