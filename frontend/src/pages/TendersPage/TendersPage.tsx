import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  AlertCircle,
  Clock,
  CheckCircle2,
  DollarSign,
  Activity,
  Inbox,
} from 'lucide-react';
import { tendersApi } from '../../api/endpoints/tenders.api';
import {
  useTenders,
  useOverviewStats,
  useSourceStats,
} from '../../hooks/useTenders';
import { useDebounce } from '../../hooks/useDebounce';
import TenderCard from '../../components/tenders/TenderCard';
import TenderFilters, {
  type PageSize,
  type SortDirection,
  type TenderSortField,
  type YearMode,
} from '../../components/tenders/TenderFilters';
import TenderDetailModal from '../../components/tenders/TenderDetailModal';
import type { Tender } from '../../types/tender.types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { getSourceLabel } from '../../utils/sourceLabels';
import styles from './TendersPage.module.css';
import clsx from 'clsx';

/** Calendar year from close or published date — pure helper for stable useMemo deps */
function tenderCalendarYear(tender: Tender, mode: YearMode): string {
  const dateValue =
    mode === 'published' ? tender.published_date : tender.close_date;
  if (!dateValue) return '';

  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? '' : String(parsed.getFullYear());
}

function mergeTenders(...groups: Tender[][]): Tender[] {
  const byId = new Map<string, Tender>();

  groups.flat().forEach((tender) => {
    byId.set(tender.id, tender);
  });

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
}

async function fetchAllTenderPages(
  filters: Parameters<typeof tendersApi.list>[0],
): Promise<Tender[]> {
  const firstPage = await tendersApi.list({
    ...filters,
    page: 1,
    page_size: 100,
  });
  const items = [...firstPage.items];

  const totalPagesToFetch = Math.max(
    firstPage.total_pages,
    Math.ceil(firstPage.total / 100),
  );
  for (let nextPage = 2; nextPage <= totalPagesToFetch; nextPage += 1) {
    try {
      const pageData = await tendersApi.list({
        ...filters,
        page: nextPage,
        page_size: 100,
      });
      items.push(...pageData.items);
    } catch (error) {
      console.warn(
        `Could not load tender page ${nextPage}; showing ${items.length} loaded tenders.`,
        error,
      );
      break;
    }
  }

  return items;
}

type Tab = 'active' | 'upcoming' | 'closed';
type PageItem = number | 'dots-left' | 'dots-right';

const DEFAULT_SORT_FIELD: TenderSortField = 'created_at';
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';

const STATUS_CARDS: {
  id: Tab;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  countKey: 'active_tenders' | 'upcoming_tenders' | 'closed_tenders';
  valueKey: 'active_value' | 'upcoming_value' | 'closed_value';
  statusKeys: string[];
}[] = [
  {
    id: 'active',
    label: 'Active Bids',
    desc: 'Open — Accepting Submissions Now',
    icon: Activity,
    color: '#10B981',
    bg: 'rgba(16,185,129,0.07)',
    border: 'rgba(16,185,129,0.22)',
    countKey: 'active_tenders',
    valueKey: 'active_value',
    statusKeys: ['open', 'active'],
  },
  {
    id:         'upcoming',
    label:      'Upcoming Bids',
    desc:       'Planned — Not Yet Released',
    icon:       Clock,
    color:      '#F59E0B',
    bg:         'rgba(245,158,11,0.07)',
    border:     'rgba(245,158,11,0.22)',
    countKey:   'upcoming_tenders',
    valueKey:   'upcoming_value',
    statusKeys: ['upcoming'],
  },
  {
    id:         'closed',
    label:      'Closed Bids',
    desc:       'Awarded — Historical Contracts',
    icon:       CheckCircle2,
    color:      '#EF4444',
    bg:         'rgba(239, 68, 68, 0.07)',
    border:     'rgba(239, 68, 68, 0.22)',
    countKey:   'closed_tenders',
    valueKey:   'closed_value',
    statusKeys: ['closed'],
  },
];

const LEGACY_ACTIVE_STATUS = 'open';

const csvEscape = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

function compareNullableString(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' });
}

function compareNullableDate(a: string | null | undefined, b: string | null | undefined) {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  return (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
}

function sortTenders(
  items: Tender[],
  sortField: TenderSortField,
  sortDirection: SortDirection,
) {
  const direction = sortDirection === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    let result = 0;

    if (sortField === 'title') result = compareNullableString(a.title, b.title);
    else if (sortField === 'agency') result = compareNullableString(a.agency, b.agency);
    else if (sortField === 'published_date') result = compareNullableDate(a.published_date, b.published_date);
    else if (sortField === 'close_date') result = compareNullableDate(a.close_date, b.close_date);
    else if (sortField === 'contract_value') result = (a.contract_value ?? 0) - (b.contract_value ?? 0);
    else result = compareNullableDate(a.created_at, b.created_at);

    return result * direction;
  });
}

const getVisiblePages = (
  currentPage: number,
  totalPages: number,
): PageItem[] => {
  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages]);
  const start = Math.max(2, currentPage - 2);
  const end = Math.min(totalPages - 1, currentPage + 2);

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    pages.add(pageNumber);
  }

  if (currentPage <= 4) {
    [2, 3, 4, 5, 6].forEach((pageNumber) => pages.add(pageNumber));
  }

  if (currentPage >= totalPages - 3) {
    [
      totalPages - 5,
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
    ]
      .filter((pageNumber) => pageNumber > 1)
      .forEach((pageNumber) => pages.add(pageNumber));
  }

  const sortedPages = Array.from(pages).sort((a, b) => a - b);
  const result: PageItem[] = [];

  sortedPages.forEach((pageNumber, index) => {
    const previousPage = sortedPages[index - 1];
    if (previousPage && pageNumber - previousPage > 1) {
      result.push(previousPage === 1 ? 'dots-left' : 'dots-right');
    }
    result.push(pageNumber);
  });

  return result;
};

export default function TendersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const yearParam = searchParams.get('year') ?? '';
  const publishedYearParam = searchParams.get('published_year') ?? '';
  const urlState = searchParams.get('state') ?? '';
  const urlStatus = searchParams.get('status') as Tab | null;
  const urlYear = publishedYearParam || yearParam;
  const urlYearMode: YearMode = publishedYearParam ? 'published' : 'close';
  const [activeTab, setActiveTab] = useState<Tab>(
    urlStatus && ['active', 'upcoming', 'closed'].includes(urlStatus) ? urlStatus : 'active',
  );
  const [sector, setSector] = useState('');
  const [state, setState] = useState(urlState);
  const [yearMode, setYearMode] = useState<YearMode>(urlYearMode);
  const [year, setYear] = useState(urlYear);
  const [sourceName, setSourceName] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>('15');
  const [sortField, setSortField] = useState<TenderSortField>(DEFAULT_SORT_FIELD);
  const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_SORT_DIRECTION);
  const [page, setPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('1');
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const search = searchParams.get('search') ?? '';
  const setSearch = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next.trim()) params.set('search', next);
          else params.delete('search');
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setYearFilter = useCallback(
    (next: string, mode: YearMode = yearMode) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.delete('year');
          params.delete('published_year');
          if (next.trim()) {
            params.set(mode === 'published' ? 'published_year' : 'year', next);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams, yearMode],
  );

  const setStateFilter = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next.trim()) params.set('state', next);
          else params.delete('state');
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    setYearMode(urlYearMode);
    setYear(urlYear);
    setPage(1);
  }, [urlYear, urlYearMode]);

  useEffect(() => {
    setState(urlState);
    setPage(1);
  }, [urlState]);

  useEffect(() => {
    if (urlStatus && ['active', 'upcoming', 'closed'].includes(urlStatus)) {
      setActiveTab(urlStatus);
      setPage(1);
    }
  }, [urlStatus]);

  const handleSearch = useCallback(
    (v: string) => {
      setSearch(v);
      setPage(1);
    },
    [setSearch],
  );
  const handleSector = useCallback((v: string) => {
    setSector(v);
    setPage(1);
  }, []);
  const handleState = useCallback((v: string) => {
    setState(v);
    setStateFilter(v);
    setPage(1);
  }, [setStateFilter]);
  const handleYearMode = useCallback(
    (v: YearMode) => {
      setYearMode(v);
      setYearFilter(year, v);
      setPage(1);
    },
    [setYearFilter, year],
  );
  const handleYear = useCallback(
    (v: string) => {
      setYear(v);
      setYearFilter(v);
      setPage(1);
    },
    [setYearFilter],
  );
  const handleSource = useCallback((v: string) => {
    setSourceName(v);
    setPage(1);
  }, []);
  const handlePageSize = useCallback((v: PageSize) => {
    setPageSize(v);
    setPage(1);
  }, []);
  const handleSortField = useCallback((v: TenderSortField) => {
    setSortField(v);
    setPage(1);
  }, []);
  const handleSortDirection = useCallback((v: SortDirection) => {
    setSortDirection(v);
    setPage(1);
  }, []);
  const handleTab = useCallback((t: Tab) => {
    setActiveTab(t);
    setPage(1);
  }, []);

  const handleClear = useCallback(() => {
    setSearch('');
    setSector('');
    setState('');
    setStateFilter('');
    setYearMode('close');
    setYear('');
    setYearFilter('', 'close');
    setSourceName('');
    setPage(1);
  }, [setSearch, setStateFilter, setYearFilter]);

  const hasYearFilter = Boolean(year);
  const pageSizeNumber = Number(pageSize);
  const hasCustomSort =
    sortField !== DEFAULT_SORT_FIELD || sortDirection !== DEFAULT_SORT_DIRECTION;
  const needsFullDataset = hasYearFilter || hasCustomSort;
  const isActiveTab = activeTab === 'active';

  const filters = {
    page: needsFullDataset ? 1 : page,
    page_size: needsFullDataset ? 100 : pageSizeNumber,
    status: isActiveTab ? 'active' : activeTab,
    sector: sector || undefined,
    state: state || undefined,
    source_name: sourceName || undefined,
    search: debouncedSearch || undefined,
  };
  const legacyActiveStatusFilters = {
    ...filters,
    status: LEGACY_ACTIVE_STATUS,
  };

  const { data, isLoading, isError } = useTenders(filters);
  const legacyActiveStatusQuery = useQuery({
    queryKey: ['tenders-active-legacy', legacyActiveStatusFilters],
    queryFn: () => tendersApi.list(legacyActiveStatusFilters),
    enabled: isActiveTab && !needsFullDataset,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
  const { data: stats } = useOverviewStats();
  const { data: sourceStats } = useSourceStats();

  const rawTenders = useMemo(() => {
    const primaryItems = data?.items ?? [];
    if (!isActiveTab) return primaryItems;

    return mergeTenders(
      primaryItems,
      legacyActiveStatusQuery.data?.items ?? [],
    ).slice(0, pageSizeNumber);
  }, [
    data?.items,
    isActiveTab,
    legacyActiveStatusQuery.data?.items,
    pageSizeNumber,
  ]);
  const yearFetchFilters = {
    status: isActiveTab ? 'active' : activeTab,
    sector: sector || undefined,
    state: state || undefined,
    source_name: sourceName || undefined,
    search: debouncedSearch || undefined,
  };
  const legacyActiveYearFetchFilters = {
    ...yearFetchFilters,
    status: LEGACY_ACTIVE_STATUS,
  };

  const fullDatasetQuery = useQuery({
    queryKey: ['tenders-full-dataset', yearFetchFilters, pageSize],
    enabled: needsFullDataset,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: () => fetchAllTenderPages(yearFetchFilters),
  });
  const legacyActiveFullDatasetQuery = useQuery({
    queryKey: [
      'tenders-full-dataset-legacy-active',
      legacyActiveYearFetchFilters,
      pageSize,
    ],
    enabled: needsFullDataset && isActiveTab,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: () => fetchAllTenderPages(legacyActiveYearFetchFilters),
  });

  const allYearTenders = useMemo(() => {
    if (!needsFullDataset) return rawTenders;
    if (!isActiveTab) return fullDatasetQuery.data ?? rawTenders;
    return mergeTenders(
      fullDatasetQuery.data ?? [],
      legacyActiveFullDatasetQuery.data ?? [],
    );
  }, [
    needsFullDataset,
    isActiveTab,
    rawTenders,
    fullDatasetQuery.data,
    legacyActiveFullDatasetQuery.data,
  ]);

  const isYearLoading =
    needsFullDataset &&
    (fullDatasetQuery.isLoading ||
      fullDatasetQuery.isFetching ||
      (isActiveTab &&
        (legacyActiveFullDatasetQuery.isLoading ||
          legacyActiveFullDatasetQuery.isFetching)));
  const isListLoading =
    isLoading ||
    (isActiveTab && legacyActiveStatusQuery.isLoading) ||
    isYearLoading;
  const isListError =
    isError && (!isActiveTab || legacyActiveStatusQuery.isError);

  const yearFilteredTenders = useMemo(() => {
    if (!year) return needsFullDataset ? allYearTenders : rawTenders;
    return allYearTenders.filter(
      (tender) => tenderCalendarYear(tender, yearMode) === year,
    );
  }, [allYearTenders, needsFullDataset, rawTenders, year, yearMode]);

  const sortedFilteredTenders = useMemo(
    () => sortTenders(yearFilteredTenders, sortField, sortDirection),
    [yearFilteredTenders, sortDirection, sortField],
  );

  const tenders = needsFullDataset
    ? sortedFilteredTenders.slice(
        (page - 1) * pageSizeNumber,
        page * pageSizeNumber,
      )
    : rawTenders;

  const backendTotal = isActiveTab
    ? (data?.total ?? 0) + (legacyActiveStatusQuery.data?.total ?? 0)
    : (data?.total ?? 0);
  const total = needsFullDataset
    ? hasYearFilter
      ? sortedFilteredTenders.length
      : backendTotal
    : backendTotal;
  const totalPages = needsFullDataset
    ? Math.max(1, Math.ceil(total / pageSizeNumber))
    : isActiveTab
      ? Math.max(1, Math.ceil(backendTotal / pageSizeNumber))
      : (data?.total_pages ?? 1);
  const visiblePages = useMemo(
    () => getVisiblePages(page, totalPages),
    [page, totalPages],
  );

  useEffect(() => {
    setJumpPage(String(page));
  }, [page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleJumpSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPage = Number(jumpPage);
    if (!Number.isFinite(nextPage)) return;
    setPage(Math.min(totalPages, Math.max(1, Math.trunc(nextPage))));
  };

  const sourceOptions = useMemo(
    () =>
      Object.keys(stats?.sources ?? {})
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [stats?.sources],
  );

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const baseYears = Array.from({ length: 10 }, (_, index) =>
      String(currentYear - index),
    );
    const loadedYears = allYearTenders
      .map((tender) => tenderCalendarYear(tender, yearMode))
      .filter(Boolean);
    return Array.from(new Set([...baseYears, ...loadedYears])).sort(
      (a, b) => Number(b) - Number(a),
    );
  }, [allYearTenders, yearMode]);
  const exportCSV = async () => {
    setIsExporting(true);
    try {
      const exportFilters = {
        status: isActiveTab ? 'active' : activeTab,
        sector: sector || undefined,
        state: state || undefined,
        source_name: sourceName || undefined,
        search: debouncedSearch || undefined,
      };
      const exportItems = isActiveTab
        ? mergeTenders(
            await fetchAllTenderPages(exportFilters),
            await fetchAllTenderPages({ ...exportFilters, status: LEGACY_ACTIVE_STATUS }),
          )
        : await fetchAllTenderPages(exportFilters);
      const filteredItems = year
        ? exportItems.filter((tender) => tenderCalendarYear(tender, yearMode) === year)
        : exportItems;
      const sortedItems = sortTenders(filteredItems, sortField, sortDirection);

      if (!sortedItems.length) return;

    const headers = [
      'Title',
      'Agency',
      'Sector',
      'State',
      'Value',
      'Close Date',
      'Status',
      'Source',
      'Source ID',
    ];
    const rows = sortedItems.map((t) => [
      csvEscape(t.title),
      csvEscape(t.agency),
      t.sector ?? '',
      t.state ?? '',
      t.contract_value ?? '',
      t.close_date ?? '',
      t.status,
      t.source_name ?? '',
      t.source_id ?? '',
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warroom-tenders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  // Compute displayed value for a card given selected source
  const getDisplayValue = (
    card: (typeof STATUS_CARDS)[0],
    selectedSource: string,
    isCardActive: boolean,
  ) => {
    if (!stats && !sourceStats) return '…';
    // If source filter active on this card — show that source's value
    if (isCardActive && selectedSource && sourceStats) {
      const srcData = sourceStats[selectedSource];
      if (srcData) {
        const v = card.statusKeys.reduce(
          (sum, k) => sum + (srcData[k]?.value ?? 0),
          0,
        );
        return v > 0 ? formatCurrency(v) : 'Not Disclosed';
      }
      return 'Not Disclosed';
    }
    // No source selected — show total value for this card status
    const total = stats?.[card.valueKey] ?? 0;
    return total > 0 ? formatCurrency(total) : 'Not Disclosed';
  };

  const activeCardDef = STATUS_CARDS.find((c) => c.id === activeTab)!;

  return (
    <div className={`${styles.page} page-enter`}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.heading}>Tender Management</h2>
          <p className={styles.headingSub}>
            Track and Manage Australian Government Tender Bids
          </p>
        </div>
        <button className={styles.exportBtn} onClick={exportCSV} disabled={isExporting}>
          <Download size={14} />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* ── Total Value card (full width) ── */}
      <motion.div
        className={styles.totalValueCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className={styles.totalValueLeft}>
          <div className={styles.totalValueIcon}>
            <DollarSign size={20} />
          </div>
          <div>
            <p className={styles.totalValueLabel}>Total Tender Value</p>
            <p className={styles.totalValueAmount}>
              {stats ? formatCurrency(stats.total_value) : '…'}
            </p>
          </div>
        </div>
        <div className={styles.totalValueRight}>
          <div className={styles.totalValueStat}>
            <p className={styles.tvStatLabel}>Total Tenders</p>
            <p className={styles.tvStatValue}>
              {stats ? formatNumber(stats.total_tenders) : '…'}
            </p>
          </div>
          <div className={styles.totalValueDivider} />
          <div className={styles.totalValueStat}>
            <p className={styles.tvStatLabel}>Avg Value</p>
            <p className={styles.tvStatValue}>
              {stats ? formatCurrency(stats.avg_value) : '…'}
            </p>
          </div>
          <div className={styles.totalValueDivider} />
          <div className={styles.totalValueStat}>
            <p className={styles.tvStatLabel}>Data Sources</p>
            <p className={styles.tvStatValue}>
              {stats ? Object.keys(stats.sources).length : '…'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Status filter cards ── */}
      <div className={styles.statusGrid}>
        {STATUS_CARDS.map((card, i) => {
          const isActive = activeTab === card.id;
          const count = stats?.[card.countKey] ?? 0;

          return (
            <motion.button
              key={card.id}
              className={clsx(
                styles.statusCard,
                isActive && styles.statusCardActive,
              )}
              style={{
                background: isActive ? card.bg : 'var(--card-bg)',
                borderColor: isActive ? card.color : 'var(--card-border)',
                boxShadow: isActive
                  ? `0 0 0 1px ${card.color}55, 0 4px 24px ${card.color}22`
                  : 'none',
              }}
              onClick={() => handleTab(card.id)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Icon + label */}
              <div className={styles.scTop}>
                <div
                  className={styles.scIconWrap}
                  style={{
                    background: isActive
                      ? card.color + '25'
                      : 'var(--bg-elevated)',
                    border: `1px solid ${isActive ? card.color + '55' : 'var(--border)'}`,
                  }}
                >
                  <card.icon
                    size={15}
                    style={{ color: isActive ? card.color : 'var(--text-dim)' }}
                  />
                </div>
                <span
                  className={styles.scLabel}
                  style={{
                    color: isActive ? card.color : 'var(--text-secondary)',
                  }}
                >
                  {card.label}
                </span>
                {isActive && (
                  <motion.span
                    className={styles.scActivePill}
                    style={{
                      background: card.color + '22',
                      color: card.color,
                      border: `1px solid ${card.color}44`,
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    Selected
                  </motion.span>
                )}
              </div>

              {/* Count */}
              <p
                className={styles.scCount}
                style={{ color: isActive ? card.color : 'var(--text-primary)' }}
              >
                {stats ? formatNumber(count) : '…'}
              </p>

              <p className={styles.scDesc}>{card.desc}</p>

              <div
                className={styles.scDivider}
                style={{
                  background: isActive ? card.color + '33' : 'var(--border)',
                }}
              />

              {/* Source filter dropdown */}
              <div
                className={styles.scSourceRow}
                onClick={(e) => e.stopPropagation()}
              >
                <span className={styles.scSourceLabel}>Source:</span>
                <select
                  className={styles.scSourceSelect}
                  value={isActive ? sourceName : ''}
                  onChange={(e) => {
                    handleTab(card.id);
                    handleSource(e.target.value);
                  }}
                  style={{
                    borderColor: isActive ? card.color + '44' : 'var(--border)',
                  }}
                >
                  <option value="">All Sources</option>
                  {Object.keys(stats?.sources ?? {}).map((s) => (
                    <option key={s} value={s}>
                      {getSourceLabel(s)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Value — updates based on selected source */}
              <div className={styles.scValueRow}>
                <span className={styles.scValueLabel}>
                  {isActive && sourceName
                    ? `${getSourceLabel(sourceName)} Value`
                    : 'Total Value'}
                </span>
                <span
                  className={styles.scValue}
                  style={{
                    color: isActive ? card.color : 'var(--text-secondary)',
                  }}
                >
                  {getDisplayValue(card, isActive ? sourceName : '', isActive)}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <TenderFilters
        search={search}
        sector={sector}
        state={state}
        yearMode={yearMode}
        year={year}
        sourceName={sourceName}
        pageSize={pageSize}
        sortField={sortField}
        sortDirection={sortDirection}
        yearOptions={yearOptions}
        sourceOptions={sourceOptions}
        onSearch={handleSearch}
        onSector={handleSector}
        onState={handleState}
        onYearMode={handleYearMode}
        onYear={handleYear}
        onSource={handleSource}
        onPageSize={handlePageSize}
        onSortField={handleSortField}
        onSortDirection={handleSortDirection}
        onClear={handleClear}
        totalResults={total}
        loading={isListLoading}
      />

      {/* Pagination */}
      {!isListLoading && !isListError && totalPages > 1 && (
        <div className={styles.pagination}>
          <div className={styles.pageMain}>
            <button
              className={styles.pageBtn}
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>

            <div className={styles.pageNumbers}>
              {visiblePages.map((pageItem) =>
                typeof pageItem === 'number' ? (
                  <button
                    key={pageItem}
                    className={clsx(
                      styles.pageNum,
                      page === pageItem && styles.pageNumActive,
                    )}
                    onClick={() => setPage(pageItem)}
                  >
                    {pageItem}
                  </button>
                ) : (
                  <span key={pageItem} className={styles.pageDots}>
                    ...
                  </span>
                ),
              )}
            </div>

            <button
              className={styles.pageBtn}
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>

          <form className={styles.pageJump} onSubmit={handleJumpSubmit}>
            <span className={styles.pageJumpLabel}>Go to</span>
            <input
              className={styles.pageJumpInput}
              type="number"
              min={1}
              max={totalPages}
              value={jumpPage}
              onChange={(event) => setJumpPage(event.target.value)}
            />
            <span className={styles.pageJumpLabel}>/ {totalPages}</span>
            <button className={styles.pageJumpBtn} type="submit">
              Go
            </button>
          </form>
        </div>
      )}

      {/* ── Active tab label ── */}
      <div className={styles.activeTabLabel}>
        <activeCardDef.icon size={14} style={{ color: activeCardDef.color }} />
        <span style={{ color: activeCardDef.color, fontWeight: 600 }}>
          {activeCardDef.label}
        </span>
        {sourceName && (
          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            · {getSourceLabel(sourceName)}
          </span>
        )}
        {total > 0 && (
          <span
            className={styles.activeTabCount}
            style={{
              background: activeCardDef.color + '22',
              color: activeCardDef.color,
            }}
          >
            {formatNumber(total)} results
          </span>
        )}
      </div>

      {/* ── Tender list ── */}
      <div className={styles.listWrap}>
        {/* Loading skeletons */}
        {isListLoading && (
          <div className={styles.skeletonList}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skeletonAccent} />
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div
                    className={styles.shimmer}
                    style={{ height: 12, width: '40%' }}
                  />
                  <div
                    className={styles.shimmer}
                    style={{ height: 16, width: '80%' }}
                  />
                  <div
                    className={styles.shimmer}
                    style={{ height: 11, width: '60%' }}
                  />
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    <div className={styles.shimmer} style={{ height: 10 }} />
                    <div className={styles.shimmer} style={{ height: 10 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {isListError && !isListLoading && (
          <div className={styles.emptyState}>
            <AlertCircle
              size={32}
              className={styles.emptyIcon}
              style={{ color: '#F87171' }}
            />
            <p className={styles.emptyTitle}>Could not load tenders</p>
            <p className={styles.emptySub}>
              Make sure the backend is running on port 8000
            </p>
          </div>
        )}

        {/* Empty */}
        {!isListLoading && !isListError && tenders.length === 0 && (
          <div className={styles.emptyState}>
            <Inbox size={36} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No tenders found</p>
            <p className={styles.emptySub}>
              {activeTab === 'active'
                ? 'No active tenders — add more Tenders.Net URLs in Data Sources'
                : activeTab === 'upcoming'
                  ? 'No upcoming tenders matching your filters'
                  : 'Try adjusting your filters'}
            </p>
            {(search || sector || state || year || sourceName) && (
              <button className={styles.clearFiltersBtn} onClick={handleClear}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Cards */}
        {!isListLoading && !isListError && tenders.length > 0 && (
          <div className={styles.cardList}>
            {tenders.map((tender, i) => (
              <TenderCard
                key={tender.id}
                tender={tender}
                index={i}
                onSelect={setSelectedTender}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isListLoading && !isListError && totalPages > 1 && (
          <div className={styles.pagination}>
            <div className={styles.pageMain}>
              <button
                className={styles.pageBtn}
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>

              <div className={styles.pageNumbers}>
                {visiblePages.map((pageItem) =>
                  typeof pageItem === 'number' ? (
                    <button
                      key={pageItem}
                      className={clsx(
                        styles.pageNum,
                        page === pageItem && styles.pageNumActive,
                      )}
                      onClick={() => setPage(pageItem)}
                    >
                      {pageItem}
                    </button>
                  ) : (
                    <span key={pageItem} className={styles.pageDots}>
                      ...
                    </span>
                  ),
                )}
              </div>

              <button
                className={styles.pageBtn}
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>

            <form className={styles.pageJump} onSubmit={handleJumpSubmit}>
              <span className={styles.pageJumpLabel}>Go to</span>
              <input
                className={styles.pageJumpInput}
                type="number"
                min={1}
                max={totalPages}
                value={jumpPage}
                onChange={(event) => setJumpPage(event.target.value)}
              />
              <span className={styles.pageJumpLabel}>/ {totalPages}</span>
              <button className={styles.pageJumpBtn} type="submit">
                Go
              </button>
            </form>
          </div>
        )}
      </div>

      {selectedTender && (
        <TenderDetailModal
          tender={selectedTender}
          onClose={() => setSelectedTender(null)}
        />
      )}
    </div>
  );
}
