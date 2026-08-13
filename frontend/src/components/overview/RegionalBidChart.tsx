import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell,
  } from 'recharts';
  import { useStateStats } from '../../hooks/useTenders';
  import { formatCurrency, formatNumber } from '../../utils/formatters';
  import styles from './Chart.module.css';
  
  const STATE_COLORS: Record<string, string> = {
    NSW: '#3B82F6', VIC: '#8B5CF6', QLD: '#F59E0B',
    SA:  '#10B981', WA:  '#EC4899', ACT: '#06B6D4',
    NT:  '#EF4444', TAS: '#84CC16', Federal: '#6B7280',
  };
  
  interface TooltipProps { active?: boolean; payload?: { payload: { state: string; count: number; total_value: number } }[]; }
  const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipTitle}>{d.state}</p>
        <p className={styles.tooltipRow}><span>Contracts</span><strong>{formatNumber(d.count)}</strong></p>
        <p className={styles.tooltipRow}><span>Total Value</span><strong>{formatCurrency(d.total_value)}</strong></p>
      </div>
    );
  };
  
  export default function RegionalBidChart() {
    const { data, isLoading } = useStateStats();
  
    const chartData = (data ?? [])
      .filter(d => d.state && d.state !== 'Unknown')
      .sort((a, b) => b.count - a.count)
      .slice(0, 9);
  
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>Regional Distribution</h3>
            <p className={styles.sub}>Tenders by Australian State</p>
          </div>
          <div className={styles.pill}>{chartData.length} states</div>
        </div>
  
        {isLoading ? (
          <div className={styles.loadingArea}>
            <div className={styles.shimmer} style={{ height: '260px', borderRadius: '10px' }} />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="state"
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={36}>
                {chartData.map((entry) => (
                  <Cell key={entry.state} fill={STATE_COLORS[entry.state] ?? '#6B7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    );
  }
