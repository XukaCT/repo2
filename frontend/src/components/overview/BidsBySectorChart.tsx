import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell,
  } from 'recharts';
  import { useSectorStats } from '../../hooks/useTenders';
  import { sectorLabel, sectorColor } from '../../utils/tender.utils';
  import { formatCurrency } from '../../utils/formatters';
  import styles from './Chart.module.css';
  import clsx from 'clsx';
  
  interface TooltipProps { active?: boolean; payload?: { payload: { sector: string; count: number; total_value: number } }[]; }
  const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipTitle}>{sectorLabel(d.sector)}</p>
        <p className={styles.tooltipRow}><span>Contracts</span><strong>{d.count}</strong></p>
        <p className={styles.tooltipRow}><span>Total Value</span><strong>{formatCurrency(d.total_value)}</strong></p>
      </div>
    );
  };
  
  export default function BidsBySectorChart() {
    const { data, isLoading } = useSectorStats();
  
    const chartData = (data ?? [])
      .filter(d => d.sector)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(d => ({ ...d, label: sectorLabel(d.sector) }));
  
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>Bids by Sector</h3>
            <p className={styles.sub}>Tenders Distribution Across Sectors</p>
          </div>
          <div className={styles.pill}>{chartData.length} sectors</div>
        </div>
  
        {isLoading ? (
          <div className={styles.loadingBars}>
            {[80, 65, 90, 55, 70].map((w, i) => (
              <div key={i} className={styles.loadingBarRow}>
                <div className={clsx(styles.shimmer, styles.shimmerLabel)} />
                <div className={clsx(styles.shimmer, styles.shimmerBar)} style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis
                type="number"
                tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="label"
                type="category"
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={78}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={20}>
                {chartData.map((entry) => (
                  <Cell key={entry.sector} fill={sectorColor(entry.sector)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    );
  }