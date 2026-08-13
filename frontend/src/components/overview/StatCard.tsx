import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import styles from './StatCard.module.css';
import clsx from 'clsx';

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  change?: number;
  icon: LucideIcon;
  gradient: string;
  delay?: number;
  loading?: boolean;
}

export default function StatCard({
  title, value, sub, change, icon: Icon, gradient, delay = 0, loading = false,
}: StatCardProps) {
  const isPositive = (change ?? 0) >= 0;

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    >
      {loading ? (
        <div className={styles.skeleton}>
          <div className={clsx(styles.shimmer, styles.shimmerTitle)} />
          <div className={clsx(styles.shimmer, styles.shimmerValue)} />
          <div className={clsx(styles.shimmer, styles.shimmerSub)} />
        </div>
      ) : (
        <>
          <div className={styles.top}>
            <div className={styles.iconWrap} style={{ background: gradient }}>
              <Icon size={18} />
            </div>
            {change !== undefined && (
              <div className={clsx(styles.change, isPositive ? styles.changePos : styles.changeNeg)}>
                {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                <span>{Math.abs(change)}%</span>
              </div>
            )}
          </div>
          <p className={styles.title}>{title}</p>
          <p className={styles.value}>{value}</p>
          {sub && <p className={styles.sub}>{sub}</p>}
        </>
      )}
    </motion.div>
  );
}