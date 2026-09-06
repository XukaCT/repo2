// ── formatters.ts ─────────────────────────────────────────────

export function formatCurrency(value: number | null | undefined): string {
    if (value == null) return '—';
	    if (value >= 100_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
	    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000)     return `$${(value / 1_000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  }
  
  export function formatCurrencyFull(value: number | null | undefined): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
  
  export function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  
  export function formatDateShort(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  }
  
  export function formatAgo(iso: string | null | undefined): string {
    if (!iso) return 'Unknown';
  
    // Append Z if no timezone info present, so browser treats it as UTC
    const normalized = /[Z+-]\d{2}:?\d{2}$|Z$/.test(iso) ? iso : iso + 'Z';
    const date = new Date(normalized);
  
    if (isNaN(date.getTime())) return 'Unknown';
  
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
    if (seconds < 60)   return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  }
  
  export function formatNumber(n: number | null | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString('en-AU');
  }
