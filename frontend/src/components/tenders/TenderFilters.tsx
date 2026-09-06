import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import styles from './TenderFilters.module.css';

export type PageSize = '15' | '25' | '50' | '100';
export type YearMode = 'close' | 'published';
export type TenderSortField = 'created_at' | 'title' | 'published_date' | 'close_date' | 'contract_value' | 'agency';
export type SortDirection = 'asc' | 'desc';

const SECTORS = [
  { value: '', label: 'All Sectors' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'construction', label: 'Construction' },
  { value: 'facility_management', label: 'Facility Management' },
  { value: 'it_services', label: 'IT Services' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'other', label: 'Other' },
];

const STATES = [
  { value: '', label: 'All States' },
  { value: 'NSW', label: 'NSW' },
  { value: 'VIC', label: 'VIC' },
  { value: 'QLD', label: 'QLD' },
  { value: 'SA', label: 'SA' },
  { value: 'WA', label: 'WA' },
  { value: 'ACT', label: 'ACT' },
  { value: 'NT', label: 'NT' },
  { value: 'TAS', label: 'TAS' },
  { value: 'Federal', label: 'Federal' },
];

const PAGE_SIZES: Array<{ value: PageSize; label: string }> = [
  { value: '15', label: 'Show 15' },
  { value: '25', label: 'Show 25'},
  { value: '50', label: 'Show 50' },
  { value: '100', label: 'Show 100'},
];

const SORT_FIELDS: Array<{ value: TenderSortField; label: string }> = [
  { value: 'created_at', label: 'Default' },
  { value: 'title', label: 'Tender Name' },
  { value: 'agency', label: 'Agency' },
  { value: 'published_date', label: 'Publish Date' },
  { value: 'close_date', label: 'Close Date' },
  { value: 'contract_value', label: 'Value' },
];

const defaultSortDirection = (field: TenderSortField): SortDirection =>
  field === 'title' || field === 'agency' ? 'asc' : 'desc';

const SOURCE_LABELS: Record<string, string> = {
  austender: 'AusTender',
  AusTender: 'AusTender',
  qtenders: 'QTenders',
  QTenders: 'QTenders',
  'NSW eTendering': 'NSW eTendering',
  nsw_etendering: 'NSW eTendering',
  BuyingForVictoria: 'Buying for Victoria',
  buying_for_victoria: 'Buying for Victoria',
  VendorPanel: 'VendorPanel',
  vendorpanel: 'VendorPanel',
};

const sourceLabel = (source: string) =>
  SOURCE_LABELS[source] ?? source
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

interface TenderFiltersProps {
  search: string;
  sector: string;
  state: string;
  yearMode: YearMode;
  year: string;
  sourceName: string;
  pageSize: PageSize;
  sortField: TenderSortField;
  sortDirection: SortDirection;
  yearOptions: string[];
  sourceOptions: string[];
  onSearch: (v: string) => void;
  onSector: (v: string) => void;
  onState: (v: string) => void;
  onYearMode: (v: YearMode) => void;
  onYear: (v: string) => void;
  onSource: (v: string) => void;
  onPageSize: (v: PageSize) => void;
  onSortField: (v: TenderSortField) => void;
  onSortDirection: (v: SortDirection) => void;
  onClear: () => void;
  totalResults: number;
  loading: boolean;
}

export default function TenderFilters({
  search,
  sector,
  state,
  yearMode,
  year,
  sourceName,
  pageSize,
  sortField,
  sortDirection,
  yearOptions,
  sourceOptions,
  onSearch,
  onSector,
  onState,
  onYearMode,
  onYear,
  onSource,
  onPageSize,
  onSortField,
  onSortDirection,
  onClear,
  totalResults,
  loading,
}: TenderFiltersProps) {
  const activeFilters = [search, sector, state, year, sourceName].filter(Boolean);
  const hasFilters = activeFilters.length > 0;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const selectedSortLabel = SORT_FIELDS.find((item) => item.value === sortField)?.label ?? 'Default';

  useEffect(() => {
    if (!sortOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!sortRef.current?.contains(event.target as Node)) {
        setSortOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [sortOpen]);

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div className={styles.primaryControls}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search title or agency..."
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
            {search && (
              <button className={styles.clearInput} onClick={() => onSearch('')}>
                <X size={12} />
              </button>
            )}
          </div>
          <button
            className={styles.filterMenuBtn}
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal size={14} />
            <span>Filters</span>
            {hasFilters && <span className={styles.activeCount}>{activeFilters.length}</span>}
            <ChevronDown size={14} className={filtersOpen ? styles.chevronOpen : ''} />
          </button>
          <div className={styles.sortWrap} ref={sortRef}>
            <button
              type="button"
              className={styles.sortMenuBtn}
              onClick={() => setSortOpen((open) => !open)}
              aria-expanded={sortOpen}
            >
              {sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              <span>Sort</span>
              <span className={styles.sortSummary}>{selectedSortLabel}</span>
              <ChevronDown size={14} className={sortOpen ? styles.chevronOpen : ''} />
            </button>

            <AnimatePresence initial={false}>
              {sortOpen && (
                <motion.div
                  className={styles.sortPanel}
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                >
                  <select
                    className={styles.sortSelect}
                    value={sortField}
                    onChange={(event) => {
                      const nextField = event.target.value as TenderSortField;
                      onSortField(nextField);
                      onSortDirection(defaultSortDirection(nextField));
                    }}
                    aria-label="Sort tenders by"
                  >
                    {SORT_FIELDS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                  <div className={styles.sortDirectionGroup} aria-label="Sort direction">
                    <button
                      type="button"
                      title="Ascending"
                      className={`${styles.sortDirectionBtn} ${sortDirection === 'asc' ? styles.sortDirectionActive : ''}`}
                      onClick={() => onSortDirection('asc')}
                    >
                      <ArrowUp size={15} />
                      <span>Asc</span>
                    </button>
                    <button
                      type="button"
                      title="Descending"
                      className={`${styles.sortDirectionBtn} ${sortDirection === 'desc' ? styles.sortDirectionActive : ''}`}
                      onClick={() => onSortDirection('desc')}
                    >
                      <ArrowDown size={15} />
                      <span>Desc</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className={styles.pageSizeWrap}>
            <select
              className={styles.pageSizeSelect}
              value={pageSize}
              onChange={(event) => onPageSize(event.target.value as PageSize)}
              aria-label="Items per page"
            >
              {PAGE_SIZES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className={styles.selectChevron} />
          </div>
        </div>
        <div className={styles.rightGroup}>
          {loading ? (
            <span className={styles.loading}>Searching...</span>
          ) : (
            <span className={styles.results}>{totalResults.toLocaleString()} results</span>
          )}
          {hasFilters && (
            <button className={styles.clearBtn} onClick={onClear}>
              <X size={12} /> Clear all
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {filtersOpen && (
          <motion.div
            className={styles.menuPanel}
            initial={{ maxHeight: 0, opacity: 0, scaleY: 0.96, y: -4 }}
            animate={{ maxHeight: 140, opacity: 1, scaleY: 1, y: 0 }}
            exit={{ maxHeight: 0, opacity: 0, scaleY: 0.98, y: -4 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <motion.div
              className={styles.controls}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
            >
              <select
                className={styles.select}
                value={sector}
                onChange={(event) => onSector(event.target.value)}
              >
                {SECTORS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>

              <select
                className={styles.select}
                value={state}
                onChange={(event) => onState(event.target.value)}
              >
                {STATES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>

              <select
                className={styles.select}
                value={yearMode}
                onChange={(event) => onYearMode(event.target.value as YearMode)}
              >
                <option value="close">Close Year</option>
                <option value="published">Published Year</option>
              </select>

              <select
                className={styles.select}
                value={year}
                onChange={(event) => onYear(event.target.value)}
              >
                <option value="">All Years</option>
                {yearOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>

              <select
                className={styles.select}
                value={sourceName}
                onChange={(event) => onSource(event.target.value)}
              >
                <option value="">All Sources</option>
                {sourceOptions.map((item) => (
                  <option key={item} value={item}>{sourceLabel(item)}</option>
                ))}
              </select>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
