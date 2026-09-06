import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle,
  Clock, Trash2, RefreshCw, Database,
  AlertCircle, ChevronDown, ChevronUp, Loader2,
  Globe, MapPin, Lock, Eye, EyeOff, ShieldAlert,
} from 'lucide-react';
import client from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { formatNumber } from '../../utils/formatters';
import styles from './DataSourcesPage.module.css';

interface IngestionJob {
  id:           number;
  job_name:     string;
  source_name:  string;
  file_name:    string | null;
  status:       'pending' | 'processing' | 'complete' | 'failed';
  total_rows:   number | null;
  inserted:     number | null;
  updated:      number | null;
  skipped:      number | null;
  error_msg:    string | null;
  created_at:   string;
  completed_at: string | null;
}

interface SourceOption {
  key:   string;
  label: string;
  scope: string;
}

interface PreviewData {
  headers: string[];
  rows:    string[][];
}

const STATUS_CONFIG = {
  complete:   { color: '#10B981', icon: CheckCircle2, label: 'Complete'   },
  failed:     { color: '#F87171', icon: XCircle,      label: 'Failed'     },
  processing: { color: '#F59E0B', icon: Loader2,      label: 'Processing' },
  pending:    { color: '#6B7280', icon: Clock,         label: 'Pending'    },
};

const SCOPE_COLOR: Record<string, string> = {
  "All States":             "#7C3AED",
  "Federal / All States":   "#7C3AED",
  "Victoria":               "#3B82F6",
  "New South Wales":        "#06B6D4",
  "Queensland":             "#F59E0B",
  "South Australia":        "#EF4444",
  "Western Australia":      "#10B981",
  "Tasmania":               "#8B5CF6",
  "Northern Territory":     "#F97316",
  "Custom":                 "#6B7280",
};

// -- Password Delete Modal -----------------------------------------------------
interface DeleteModalProps {
  job:       IngestionJob;
  onConfirm: (password: string) => void;
  onCancel:  () => void;
  loading:   boolean;
  error:     string;
}

function DeleteModal({ job, onConfirm, onCancel, loading, error }: DeleteModalProps) {
  const [pw,     setPw]     = useState('');
  const [showPw, setShowPw] = useState(false);
  const inputRef            = useRef<HTMLInputElement>(null);

  // Focus input on mount
  const setRef = (el: HTMLInputElement | null) => {
    if (el) { (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el; el.focus(); }
  };

  return (
    <div className={styles.modalBackdrop} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <motion.div
        className={styles.deleteModalCard}
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{    opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.18 }}
      >
        {/* Header */}
        <div className={styles.deleteModalHeader}>
          <div className={styles.deleteModalIcon}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className={styles.deleteModalTitle}>Confirm Deletion</h3>
            <p className={styles.deleteModalSub}>
              This will permanently delete <strong>{job.job_name}</strong> and its{' '}
              <strong>{formatNumber(job.inserted ?? 0)} tenders</strong>
            </p>
          </div>
          <button className={styles.deleteModalClose} onClick={onCancel}>
            <XCircle size={18} />
          </button>
        </div>

        {/* Warning */}
        <div className={styles.deleteModalWarning}>
          <AlertCircle size={13} />
          Only tenders from this specific upload will be removed - other uploads from the same portal are unaffected.
        </div>

        {/* Password input */}
        <div className={styles.deleteModalBody}>
          <label className={styles.deleteModalLabel}>
            <Lock size={13} /> Enter your password to confirm
          </label>
          <div className={styles.deleteModalInputWrap}>
            <input
              ref={setRef}
              className={styles.deleteModalInput}
              type={showPw ? 'text' : 'password'}
              placeholder="Your current password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && pw && onConfirm(pw)}
              disabled={loading}
            />
            <button
              className={styles.deleteModalEye}
              type="button"
              onClick={() => setShowPw(v => !v)}
            >
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {error && (
            <motion.p
              className={styles.deleteModalError}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertCircle size={12} /> {error}
            </motion.p>
          )}
        </div>

        {/* Footer */}
        <div className={styles.deleteModalFooter}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className={styles.confirmDeleteBtn}
            onClick={() => onConfirm(pw)}
            disabled={loading || !pw}
          >
            {loading
              ? <><Loader2 size={13} className={styles.spinning} /> Verifying...</>
              : <><Trash2 size={13} /> Delete Permanently</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

interface PasswordModalProps {
  title: string;
  subtitle: string;
  confirmLabel: string;
  onConfirm: (password: string) => void;
  onCancel: () => void;
  loading: boolean;
  error: string;
}

function PasswordModal({ title, subtitle, confirmLabel, onConfirm, onCancel, loading, error }: PasswordModalProps) {
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  return (
    <div className={styles.modalBackdrop} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <motion.div
        className={styles.deleteModalCard}
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.18 }}
      >
        <div className={styles.deleteModalHeader}>
          <div className={styles.deleteModalIcon}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className={styles.deleteModalTitle}>{title}</h3>
            <p className={styles.deleteModalSub}>{subtitle}</p>
          </div>
          <button className={styles.deleteModalClose} onClick={onCancel}>
            <XCircle size={18} />
          </button>
        </div>

        <div className={styles.deleteModalBody}>
          <label className={styles.deleteModalLabel}>
            <Lock size={13} /> Enter your password to continue
          </label>
          <div className={styles.deleteModalInputWrap}>
            <input
              ref={inputRef}
              className={styles.deleteModalInput}
              type={showPw ? 'text' : 'password'}
              placeholder="Your current password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && pw && onConfirm(pw)}
              disabled={loading}
            />
            <button className={styles.deleteModalEye} type="button" onClick={() => setShowPw(v => !v)}>
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {error && (
            <motion.p className={styles.deleteModalError} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
              <AlertCircle size={12} /> {error}
            </motion.p>
          )}
        </div>

        <div className={styles.deleteModalFooter}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={loading}>Cancel</button>
          <button className={styles.confirmDeleteBtn} onClick={() => onConfirm(pw)} disabled={loading || !pw}>
            {loading ? <><Loader2 size={13} className={styles.spinning} /> Verifying...</> : <><Upload size={13} /> {confirmLabel}</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// -- Main page -----------------------------------------------------------------
export default function DataSourcesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceDropRef = useRef<HTMLDivElement>(null);

  const [selectedSource, setSelectedSource] = useState<SourceOption | null>(null);
  const [customName,     setCustomName]      = useState('');
  const [sourceDropOpen, setSourceDropOpen]  = useState(false);
  const [dragOver,       setDragOver]        = useState(false);
  const [selectedFile,   setSelectedFile]    = useState<File | null>(null);
  const [expandedJob,    setExpandedJob]     = useState<number | null>(null);
  const [uploadError,    setUploadError]     = useState('');
  const [uploadNotice,   setUploadNotice]    = useState('');
  const [historySearch,  setHistorySearch]   = useState('');
  const [previewData,    setPreviewData]     = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading]  = useState(false);

  // Delete modal state
  const [deleteTarget,  setDeleteTarget]  = useState<IngestionJob | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError,   setDeleteError]   = useState('');
  const [uploadPasswordOpen, setUploadPasswordOpen] = useState(false);
  const [uploadPasswordLoading, setUploadPasswordLoading] = useState(false);
  const [uploadPasswordError, setUploadPasswordError] = useState('');

  const { data: sources = [] } = useQuery<SourceOption[]>({
    queryKey: ['ingestion-sources'],
    queryFn:  async () => {
      const data = (await client.get('/ingestion/sources')).data;
      return Array.isArray(data) ? data : [];
    },
    staleTime: Infinity,
  });

  const { data: jobs = [], isLoading: jobsLoading, isFetching: jobsFetching, refetch } = useQuery<IngestionJob[]>({
    queryKey: ['ingestion-jobs'],
    queryFn:  async () => {
      const data = (await client.get('/ingestion/jobs')).data;
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 10000,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, sourceKey, customName }: { file: File; sourceKey: string; customName: string }) => {
      const formData = new FormData();
      formData.append('file',        file);
      formData.append('source_key',  sourceKey);
      formData.append('custom_name', customName);
      return (await client.post('/ingestion/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data as IngestionJob;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ingestion-jobs']   });
      void queryClient.invalidateQueries({ queryKey: ['overview-stats']   });
      void queryClient.invalidateQueries({ queryKey: ['source-stats']     });
      setSelectedFile(null);
      setUploadError('');
      setUploadNotice('Upload accepted. Processing will continue in Uploaded History.');
      setPreviewData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setUploadError('');
      setUploadNotice(msg ? `${msg}. Processing may still continue in Uploaded History.` : 'Upload accepted. Processing may still continue in Uploaded History.');
      void queryClient.invalidateQueries({ queryKey: ['ingestion-jobs'] });
    },
  });

  useEffect(() => {
    if (!sourceDropOpen) return;

    const closeOnOutside = (event: MouseEvent) => {
      if (!sourceDropRef.current?.contains(event.target as Node)) {
        setSourceDropOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSourceDropOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [sourceDropOpen]);

  const generatePreview = useCallback((file: File) => {
    setPreviewLoading(true);
    setPreviewData(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data     = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const allRows  = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        if (allRows.length > 0) {
          const headers  = (allRows[0] as unknown[]).map(h => String(h ?? ''));
          const dataRows = allRows.slice(1, 6).map(row =>
            (row as unknown[]).map(cell => {
              if (cell instanceof Date) return cell.toLocaleDateString('en-AU');
              return String(cell ?? '');
            })
          );
          setPreviewData({ headers, rows: dataRows });
        }
      } catch {
        setPreviewData(null);
      } finally {
        setPreviewLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    setUploadNotice('');
    const allowed = ['.xlsx', '.xls', '.xlsm', '.csv'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setUploadError(`Unsupported file type. Allowed: ${allowed.join(', ')}`);
      return;
    }
    setSelectedFile(file);
    setUploadError('');
    generatePreview(file);
  }, [generatePreview]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleSubmit = () => {
    setUploadNotice('');
    if (!selectedFile)   { setUploadError('Please select a file'); return; }
    if (!selectedSource) { setUploadError('Please select a tender portal'); return; }
    if (selectedSource.key === 'others' && !customName.trim()) {
      setUploadError('Please enter a name for this portal'); return;
    }
    setUploadError('');
    setUploadPasswordError('');
    setUploadPasswordOpen(true);
  };

  const verifyPassword = async (password: string) => {
    if (!user?.email) throw new Error('Missing account email');
    const formData = new URLSearchParams();
    formData.append('username', user.email);
    formData.append('password', password);
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    if (!res.ok) throw new Error('Incorrect password');
  };

  const handleUploadPasswordConfirm = async (password: string) => {
    if (!selectedFile || !selectedSource) return;
    setUploadPasswordLoading(true);
    setUploadPasswordError('');
    try {
      await verifyPassword(password);
      setUploadPasswordOpen(false);
      setUploadNotice('Uploading file. Processing will continue in Uploaded History.');
      uploadMutation.mutate({ file: selectedFile, sourceKey: selectedSource.key, customName: customName.trim() });
    } catch (error) {
      setUploadPasswordError(error instanceof Error ? error.message : 'Could not verify password');
    } finally {
      setUploadPasswordLoading(false);
    }
  };

  // -- Password-gated delete -------------------------------------------------
  // Uses raw fetch instead of apiClient so a 403 wrong-password response
  // never triggers the apiClient interceptor that auto-logs the user out.
  const handleDeleteConfirm = async (password: string) => {
    if (!deleteTarget) return;
    const deleteTargetId = deleteTarget.id;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const token = localStorage.getItem('wr_token') ?? sessionStorage.getItem('wr_token') ?? '';
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/ingestion/jobs/${deleteTarget.id}/delete`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body:    JSON.stringify({ password }),
        }
      );
      if (res.ok) {
        queryClient.setQueryData<IngestionJob[]>(['ingestion-jobs'], current =>
          (current ?? []).filter(job => job.id !== deleteTargetId)
        );
        void queryClient.invalidateQueries({ queryKey: ['ingestion-jobs']  });
        void queryClient.invalidateQueries({ queryKey: ['overview-stats']  });
        void queryClient.invalidateQueries({ queryKey: ['source-stats']    });
        setDeleteTarget(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data?.detail ?? 'Incorrect password');
      }
    } catch {
      setDeleteError('Network error - please try again');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const totalInserted = jobs.filter(j => j.status === 'complete').reduce((s, j) => s + (j.inserted ?? 0), 0);

  const filteredJobs = jobs.filter(job =>
    !historySearch.trim() ||
    job.job_name.toLowerCase().includes(historySearch.toLowerCase()) ||
    (job.file_name ?? '').toLowerCase().includes(historySearch.toLowerCase()) ||
    job.source_name.toLowerCase().includes(historySearch.toLowerCase())
  );

  const isOthers = selectedSource?.key === 'others';

  return (
    <div className={`${styles.page} page-enter`}>

      {/* -- Delete password modal -- */}
      {createPortal(
      <AnimatePresence>
        {deleteTarget && (
            <DeleteModal
              job={deleteTarget}
              onConfirm={handleDeleteConfirm}
              onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
              loading={deleteLoading}
              error={deleteError}
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {uploadPasswordOpen && (
            <PasswordModal
              title="Verify Upload"
              subtitle="Confirm your password before importing this tender file."
              confirmLabel="Upload File"
              onConfirm={handleUploadPasswordConfirm}
              onCancel={() => { setUploadPasswordOpen(false); setUploadPasswordError(''); }}
              loading={uploadPasswordLoading}
              error={uploadPasswordError}
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* -- Header -- */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.heading}>Data Sources</h2>
          <p className={styles.headingSub}>Upload Tender Excel or CSV Files from Government Portals</p>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.headerStat}>
            <span className={styles.headerStatValue}>{jobs.length}</span>
            <span className={styles.headerStatLabel}>Total Uploads</span>
          </div>
          <div className={styles.headerStatDivider} />
          <div className={styles.headerStat}>
            <span className={styles.headerStatValue}>{formatNumber(totalInserted)}</span>
            <span className={styles.headerStatLabel}>Records Imported</span>
          </div>
        </div>
      </div>

      {/* -- Upload card -- */}
      <motion.div
        className={styles.uploadCard}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className={styles.uploadCardHeader}>
          <div className={styles.uploadCardIcon}><Upload size={18} /></div>
          <div>
            <p className={styles.uploadCardTitle}>Upload Tender File</p>
            <p className={styles.uploadCardSub}>Select the portal, upload your file, and merge data into the dashboard.</p>
          </div>
        </div>

        {/* Source dropdown */}
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Tender Portal <span className={styles.required}>*</span></label>
          <div className={styles.sourceDropWrap} ref={sourceDropRef}>
            <button
              className={`${styles.sourceDrop} ${sourceDropOpen ? styles.sourceDropOpen : ''} ${selectedSource ? styles.sourceDropSelected : ''}`}
              onClick={() => setSourceDropOpen(v => !v)}
              type="button"
            >
              {selectedSource ? (
                <div className={styles.sourceDropValue}>
                  <span className={styles.sourceDropLabel}>{selectedSource.label}</span>
                  <span className={styles.sourceDropScope} style={{ background: (SCOPE_COLOR[selectedSource.scope] ?? '#6B7280') + '20', color: SCOPE_COLOR[selectedSource.scope] ?? '#6B7280' }}>
                    {selectedSource.scope.includes('Federal') || selectedSource.scope === 'All States' ? <Globe size={10} /> : <MapPin size={10} />}
                    {selectedSource.scope}
                  </span>
                </div>
              ) : (
                <span className={styles.sourceDropPlaceholder}>Select a tender portal...</span>
              )}
              <ChevronDown size={14} className={styles.sourceDropChevron} style={{ transform: sourceDropOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
            </button>

            <AnimatePresence>
              {sourceDropOpen && (
                <motion.div className={styles.sourceDropMenu} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
                  {sources.map(src => (
                    <button
                      key={src.key}
                      className={`${styles.sourceDropItem} ${selectedSource?.key === src.key ? styles.sourceDropItemActive : ''}`}
                      onClick={() => { setSelectedSource(src); setSourceDropOpen(false); setUploadError(''); setUploadNotice(''); if (src.key !== 'others') setCustomName(''); }}
                    >
                      <span className={styles.sourceDropItemLabel}>{src.label}</span>
                      <span className={styles.sourceDropItemScope} style={{ background: (SCOPE_COLOR[src.scope] ?? '#6B7280') + '18', color: SCOPE_COLOR[src.scope] ?? '#6B7280' }}>
                        {src.scope.includes('Federal') || src.scope === 'All States' ? <Globe size={9} /> : <MapPin size={9} />}
                        {src.scope}
                      </span>
                    </button>
                  ))}
                </motion.div>
        )}
      </AnimatePresence>

          </div>

          <AnimatePresence>
            {isOthers && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} style={{ overflow: 'hidden', marginTop: 10 }}>
                <input className={styles.formInput} type="text" placeholder="Enter portal name (e.g. NT Government Tenders)" value={customName} onChange={e => setCustomName(e.target.value)} />
                <p className={styles.formHint}>This name will be used as the source label in the dashboard</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Drop zone */}
        <div
          className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''} ${selectedFile ? styles.dropZoneHasFile : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.xlsm,.csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
          {selectedFile ? (
            <div className={styles.selectedFile}>
              <FileSpreadsheet size={24} className={styles.fileIcon} />
              <div>
                <p className={styles.fileName}>{selectedFile.name}</p>
                <p className={styles.fileSize}>{(selectedFile.size / 1024).toFixed(1)} KB - ready to upload{selectedSource && ` as ${selectedSource.label}`}</p>
              </div>
              <button className={styles.clearFileBtn} onClick={e => { e.stopPropagation(); setSelectedFile(null); setPreviewData(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                <XCircle size={16} />
              </button>
            </div>
          ) : (
            <div className={styles.dropZoneContent}>
              <Upload size={28} className={styles.dropIcon} />
              <p className={styles.dropTitle}>Drop your file here or click to browse</p>
              <p className={styles.dropSub}>Excel (.xlsx, .xls) or CSV - max 10MB</p>
            </div>
          )}
        </div>

        {previewLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--text-dim)', fontSize: 12 }}>
            <Loader2 size={13} className={styles.spinning} /> Reading file preview...
          </div>
        )}

        {previewData && !previewLoading && (
          <div className={styles.previewSection}>
            <div className={styles.previewHeader}>
              <p className={styles.previewTitle}>Preview - {previewData.rows.length} rows / {previewData.headers.length} columns{selectedSource && <span style={{ color: 'var(--text-dim)', fontWeight: 400, marginLeft: 8 }}>/ mapped for {selectedSource.label}</span>}</p>
              <button className={styles.previewHideBtn} onClick={() => setPreviewData(null)}>Hide</button>
            </div>
            <div className={styles.previewTableWrap}>
              <table className={styles.previewTable}>
                <thead><tr>{previewData.headers.map((h, i) => <th key={i} className={styles.previewTh}>{h}</th>)}</tr></thead>
                <tbody>{previewData.rows.map((row, ri) => (<tr key={ri} className={styles.previewTr}>{previewData.headers.map((_, ci) => <td key={ci} className={styles.previewTd}>{row[ci] ?? ''}</td>)}</tr>))}</tbody>
              </table>
            </div>
          </div>
        )}

        {uploadError && <div className={styles.errorBanner}><AlertCircle size={14} />{uploadError}</div>}
        {uploadNotice && <div className={styles.noticeBanner}><Clock size={14} />{uploadNotice}</div>}

        <button className={styles.uploadBtn} onClick={handleSubmit} disabled={uploadMutation.isPending || !selectedFile || !selectedSource}>
          {uploadMutation.isPending
            ? <><Loader2 size={15} className={styles.spinning} /> Uploading...</>
            : <><Upload size={15} /> Upload & Import{selectedSource ? ` - ${selectedSource.label}` : ''}</>}
        </button>

        <AnimatePresence>
          {uploadMutation.isSuccess && (
            <motion.div className={styles.successBanner} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <CheckCircle2 size={14} />
              {uploadMutation.data?.inserted ?? 0} tenders imported from {uploadMutation.data?.job_name}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* -- Job history -- */}
      <div className={styles.historySection}>
        <div className={styles.historyHeader}>
          <div className={styles.historyTitle}>
            <Database size={15} /><span>Uploaded History</span>
            <span className={styles.jobCount}>{jobs.length}</span>
          </div>
          <button className={styles.refreshBtn} onClick={() => void refetch()} disabled={jobsFetching}>
            <RefreshCw size={13} className={jobsFetching ? styles.refreshIconSpin : undefined} />
            {jobsFetching ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        {jobs.length > 0 && (
          <div style={{ position: 'relative' }}>
            <input type="text" placeholder="Search uploads..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} className={styles.formInput} style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }} />
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </div>
        )}

        {jobsLoading ? (
          <div className={styles.loadingList}>
            {[1,2,3].map(i => (
              <div key={i} className={styles.skeletonRow}>
                <div className={styles.shimmer} style={{ width: 32, height: 32, borderRadius: 8 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className={styles.shimmer} style={{ height: 14, width: '40%' }} />
                  <div className={styles.shimmer} style={{ height: 11, width: '60%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className={styles.emptyHistory}>
            <FileSpreadsheet size={32} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No uploads yet</p>
            <p className={styles.emptySub}>Select a Portal and Upload Your First Tender File Above</p>
          </div>
        ) : (
          <div className={styles.jobList}>
            {filteredJobs.map(job => {
              const cfg        = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
              const isExpanded = expandedJob === job.id;
              const srcMatch   = sources.find(s => s.key === job.source_name);
              const scopeColor = srcMatch ? (SCOPE_COLOR[srcMatch.scope] ?? '#6B7280') : '#6B7280';
              return (
                <motion.div key={job.id} className={styles.jobCard} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <div className={styles.jobCardMain}>
                    <div className={styles.jobStatusIcon} style={{ background: cfg.color + '20', border: `1px solid ${cfg.color}44` }}>
                      <cfg.icon size={14} style={{ color: cfg.color, animation: job.status === 'processing' ? 'spin 1s linear infinite' : 'none' }} />
                    </div>
                    <div className={styles.jobInfo}>
                      <div className={styles.jobNameRow}>
                        <span className={styles.jobName}>{job.job_name}</span>
                        <span className={styles.jobStatusPill} style={{ background: cfg.color + '18', color: cfg.color, border: `1px solid ${cfg.color}33` }}>{cfg.label}</span>
                        {srcMatch && (
                          <span className={styles.jobScopePill} style={{ background: scopeColor + '15', color: scopeColor, border: `1px solid ${scopeColor}30` }}>
                            {srcMatch.scope.includes('Federal') || srcMatch.scope === 'All States' ? <Globe size={9} /> : <MapPin size={9} />}
                            {srcMatch.scope}
                          </span>
                        )}
                      </div>
                      <div className={styles.jobMeta}>
                        <span>{job.file_name}</span>
                        <span className={styles.jobMetaDot}>/</span>
                        <span>{formatDate(job.created_at)}</span>
                        {job.status === 'complete' && (
                          <><span className={styles.jobMetaDot}>/</span><span style={{ color: '#10B981' }}>{formatNumber(job.inserted ?? 0)} inserted</span></>
                        )}
                      </div>
                    </div>
                    <div className={styles.jobActions}>
                      <button className={styles.jobActionBtn} onClick={() => setExpandedJob(isExpanded ? null : job.id)} title="Details">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {/* Password-gated delete opens modal instead of window.confirm */}
                      <button
                        className={styles.jobDeleteBtn}
                        onClick={() => { setDeleteTarget(job); setDeleteError(''); }}
                        title="Delete (password required)"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div className={styles.jobDetails} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <div className={styles.jobDetailGrid}>
                          <div className={styles.jobDetailItem}><span className={styles.jobDetailLabel}>Portal</span><span className={styles.jobDetailValue}>{job.job_name}</span></div>
                          <div className={styles.jobDetailItem}><span className={styles.jobDetailLabel}>Source Key</span><span className={styles.jobDetailValue} style={{ fontFamily: 'monospace', fontSize: 12 }}>{job.source_name}</span></div>
                          <div className={styles.jobDetailItem}><span className={styles.jobDetailLabel}>Total Rows</span><span className={styles.jobDetailValue}>{formatNumber(job.total_rows ?? 0)}</span></div>
                          <div className={styles.jobDetailItem}><span className={styles.jobDetailLabel}>Inserted</span><span className={styles.jobDetailValue} style={{ color: '#10B981' }}>{formatNumber(job.inserted ?? 0)}</span></div>
                          <div className={styles.jobDetailItem}><span className={styles.jobDetailLabel}>Updated</span><span className={styles.jobDetailValue} style={{ color: '#F59E0B' }}>{formatNumber(job.updated ?? 0)}</span></div>
                          <div className={styles.jobDetailItem}><span className={styles.jobDetailLabel}>Skipped</span><span className={styles.jobDetailValue} style={{ color: '#6B7280' }}>{formatNumber(job.skipped ?? 0)}</span></div>
                          {job.completed_at && <div className={styles.jobDetailItem}><span className={styles.jobDetailLabel}>Completed</span><span className={styles.jobDetailValue}>{formatDate(job.completed_at)}</span></div>}
                        </div>
                        {job.error_msg && <div className={styles.jobWarning}><AlertCircle size={12} />{job.error_msg}</div>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
