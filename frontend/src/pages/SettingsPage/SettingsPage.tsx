import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Palette, SlidersHorizontal, Bell,
  Shield, Users, Trash2,
  Camera, Eye, EyeOff, Check, ChevronRight,
  RefreshCw, Download, AlertTriangle,
  Clock, Mail, Smartphone,
  KeyRound, Plus, Trash, MonitorSmartphone, Copy, X,
  ShieldCheck, ShieldOff, UserPlus, XCircle,
} from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import ThemePreviewSelector from '../../components/theme/ThemePreviewSelector';
import {useAuth} from '../../hooks/useAuth';
import { useUIStore } from '../../store/ui.store';
import {
  useNotificationPreferences,
  type NotificationPreferences,
} from '../../hooks/useNotificationPreferences';
import {
  requestBrowserNotificationPermission,
  showBrowserNotification,
} from '../../utils/browserNotifications';
import { isAxiosError } from 'axios';
import apiClient from '../../api/client';
import styles from './SettingsPage.module.css';

const INVITE_STATUS_CLASS: Record<string, string> = {
  pending:  styles.inviteStatus_pending,
  accepted: styles.inviteStatus_accepted,
  revoked:  styles.inviteStatus_revoked,
  expired:  styles.inviteStatus_expired,
};

const SECTIONS = [
  { id: 'profile',      label: 'Profile',             icon: User,              group: 'Account'      },
  { id: 'security',     label: 'Security',            icon: Shield,            group: 'Account'     },
  { id: 'team',         label: 'Team & Access',       icon: Users,             group: 'Account', hidden: true },
  { id: 'appearance',   label: 'Appearance',          icon: Palette,           group: 'Preferences' },
  { id: 'notification',        label: 'Notification',        icon: Bell,              group: 'Preferences'      },
  { id: 'tender-prefs', label: 'Tender Preferences',  icon: SlidersHorizontal, group: 'Preferences' },
  { id: 'data-privacy', label: 'Data & Privacy',      icon: Trash2,            group: 'System'      },
] as const;

type SectionId = typeof SECTIONS[number]['id'];
const GROUPS = ['Account', 'Preferences', 'System'];

const SECTION_SUBTITLES: Record<SectionId, string> = {
  profile: 'Edit the Profile Shown Across the Dashboard',
  security: 'Account Security and Session Management',
  team: 'Manage Team Members and Roles',
  appearance: 'Choose a Theme and Preview it Before Applying',
  notification: 'Control How and When Alerts Reach You',
  'tender-prefs': 'Default Filters Applied When Opening the Tenders Page',
  'data-privacy': 'Manage Your Local Data and Preferences',
};

function userKey(userId: string, key: string) {
  return `wr_${userId}_${key}`;
}
function getPref<T>(userId: string, key: string, fallback: T): T {
  try { const v = localStorage.getItem(userKey(userId, key)); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function setPref<T>(userId: string, key: string, val: T) {
  localStorage.setItem(userKey(userId, key), JSON.stringify(val));
}
function removePref(userId: string, key: string) {
  localStorage.removeItem(userKey(userId, key));
}

type ChannelKey = 'email' | 'sms' | 'push';
const CHANNEL_CONFIG: Record<ChannelKey, { label: string; sub: string; icon: React.ElementType }> = {
  email: { label: 'Email Notifications',          sub: 'Delivered to your inbox',      icon: Mail       },
  sms:   { label: 'SMS Notifications',            sub: 'Text messages to your phone',  icon: Smartphone },
  push:  { label: 'Browser Notifications', sub: 'Desktop push notifications',   icon: Bell       },
};

type ToastMessage = Parameters<typeof sonnerToast.success>[0];
type ToastOptions = Parameters<typeof sonnerToast.success>[1];

const toast = {
  ...sonnerToast,
  success: (message: ToastMessage, options?: ToastOptions) =>
    sonnerToast.success(message, { className: 'appToastToggleOn', ...options }),
  error: (message: ToastMessage, options?: ToastOptions) =>
    sonnerToast.error(message, { className: 'appToastToggleOff', ...options }),
  info: (message: ToastMessage, options?: ToastOptions) =>
    sonnerToast.info(message, { className: 'appToast', ...options }),
};

type DisplayPrefs = {
  dateFormat: string; currency: string;
  landingPage: string; density: string;
};
const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  dateFormat: 'relative', currency: 'short',
  landingPage: 'home', density: 'comfortable',
};
const DISPLAY_SELECT_FIELDS: {
  key: keyof DisplayPrefs; label: string;
  options: { val: string; label: string }[];
}[] = [
  { key: 'dateFormat', label: 'Date Format', options: [
    { val: 'relative', label: 'Relative (3 days ago)' },
    { val: 'absolute', label: 'Absolute (01/05/2026)' },
  ]},
  { key: 'currency', label: 'Currency Format', options: [
    { val: 'short', label: 'Short ($1.2M)' },
    { val: 'full',  label: 'Full ($1,200,000)' },
  ]},
  { key: 'landingPage', label: 'Default Landing Page', options: [
    { val: 'home',     label: 'Home — Intelligence Map' },
    { val: 'overview', label: 'Overview — Dashboard' },
    { val: 'tenders',  label: 'Tenders — Bid List' },
  ]},
  { key: 'density', label: 'Card Density', options: [
    { val: 'comfortable', label: 'Comfortable' },
    { val: 'compact',     label: 'Compact' },
  ]},
];

function axiosErrorDetail(err: unknown): string | undefined {
  if (!isAxiosError(err)) return undefined;
  const data = err.response?.data;
  if (data && typeof data === 'object' && data !== null && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === 'string') return detail;
  }
  return undefined;
}

interface SessionItem {
  id: string; ip_address: string | null; user_agent: string | null;
  created_at: string; last_active_at: string; is_current: boolean;
}
interface ApiKeyItem {
  id: string; name: string; prefix: string;
  is_active: boolean; last_used_at: string | null; created_at: string;
}
interface TeamItem { id: string; name: string; }
interface InvitationItem {
  id: string; email: string; role: string; status: string; expires_at: string;
}

// ── Password Verify Modal ─────────────────────────────────────
interface PasswordModalProps {
  onConfirm: (password: string) => Promise<void>;
  onCancel:  () => void;
  loading:   boolean;
  error:     string;
  title?:    string;
  subtitle?: string;
}

function PasswordVerifyModal({ onConfirm, onCancel, loading, error, title = 'Verify Your Password', subtitle = 'Enter Your Password to View Recovery Codes' }: PasswordModalProps) {
  const [pw,      setPw]      = useState('');
  const [showPw,  setShowPw]  = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const modal = (
    <motion.div
      className={styles.modalBackdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className={styles.modalCard}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>{title}</h3>
            <p className={styles.modalSub}>{subtitle}</p>
          </div>
          <button className={styles.modalClose} onClick={onCancel}><X size={16} /></button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.label}><Lock size={14} className={styles.inputIcon} /> Current Password </label>
            <div className={styles.inputWrap}>
              <input
                ref={inputRef}
                className={styles.input}
                type={showPw ? 'text' : 'password'}
                placeholder="Enter your password"
                value={pw}
                onChange={e => setPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && pw && onConfirm(pw)}
                disabled={loading}
              />
              <button className={styles.inputToggle} type="button" onClick={() => setShowPw(v => !v)}>
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {error && (
              <motion.p
                className={styles.modalError}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.p>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.ghostBtn} onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className={styles.primaryBtn}
            onClick={() => onConfirm(pw)}
            disabled={loading || !pw}
          >
            {loading
              ? <><RefreshCw size={13} className={styles.spinning} /> Verifying…</>
              : <><Eye size={13} /> View Codes</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  return createPortal(modal, document.body);
}

// ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, updateUser }                    = useAuth();
  const { themeMode, setThemeMode } = useUIStore();
  const uid = user?.id ?? 'default';
  const { prefs, setPrefs } = useNotificationPreferences(uid);
  const [activeSection, setActive]  = useState<SectionId>('profile');
  const activeSectionMeta = SECTIONS.find(section => section.id === activeSection) ?? SECTIONS[0];

  const avatarKey = `wr_avatar_${user?.id ?? 'default'}`;

  // ── Profile ───────────────────────────────────────────────
  const [profileName,   setProfileName]   = useState(user?.name ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarSrc,     setAvatarSrc]     = useState<string>(
    () => localStorage.getItem(`wr_avatar_${user?.id ?? 'default'}`) ?? user?.avatar ?? ''
  );
  const avatarRef    = useRef<HTMLInputElement>(null);
  const originalName = useRef(user?.name ?? '');

  useEffect(() => {
    setProfileName(user?.name ?? '');
    originalName.current = user?.name ?? '';
  }, [user?.name]);

  const initials = user?.name
    ?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'WR';

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      setAvatarSrc(src);
      localStorage.setItem(avatarKey, src);
      toast.success('Avatar Ready — Click Save Profile to Apply');
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async () => {
    if (!profileName.trim()) return toast.error('Name cannot be empty');
    setProfileSaving(true);
    try {
      await apiClient.patch('/auth/me', { name: profileName.trim() });
      // PATCH succeeded — update local store separately so a localStorage
      // quota error (e.g. large base64 avatar) never causes a false failure toast
      try {
        updateUser({ name: profileName.trim(), avatar: avatarSrc || undefined });
      } catch {
        // Store update failed (e.g. localStorage quota) — not critical, ignore silently
      }
      originalName.current = profileName.trim();
      toast.success('Profile Updated Successfully');
    } catch (err) {
      console.error('Profile save error:', err);
      toast.error(axiosErrorDetail(err) ?? 'Failed to Update Profile');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Password ──────────────────────────────────────────────
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew,     setPwNew]     = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving,  setPwSaving]  = useState(false);
  const [showPw,    setShowPw]    = useState({ current: false, new: false, confirm: false });

  const pwStrength = pwNew.length === 0 ? 0
    : pwNew.length < 8 ? 1
    : /[A-Z]/.test(pwNew) && /[0-9]/.test(pwNew) && /[^A-Za-z0-9]/.test(pwNew) ? 3
    : 2;

  const handlePasswordSave = async () => {
    if (!pwCurrent || !pwNew || !pwConfirm) return toast.error('Fill in All Password Fields');
    if (pwNew.length < 8) return toast.error('Password Must be at Least 8 Characters');
    if (pwNew !== pwConfirm) return toast.error('Passwords Do Not Match');
    if (pwNew === pwCurrent) return toast.error('New Password Must be Different from Current');
    setPwSaving(true);
    try {
      await apiClient.post('/auth/change-password', {
        current_password: pwCurrent, new_password: pwNew,
      });
      toast.success('Password Updated Successfully');
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    } catch (err: unknown) {
      toast.error(axiosErrorDetail(err) ?? 'Failed to Update Password');
    } finally {
      setPwSaving(false);
    }
  };

  // ── Notification channels ─────────────────────────────────
  const updateChannel = async (key: ChannelKey) => {
    const nextEnabled = !prefs[key];
    if (key === 'push' && nextEnabled) {
      const permission = await requestBrowserNotificationPermission();
      if (permission !== 'granted') {
        toast.error('Browser Notifications are Blocked', {
          description: permission === 'denied'
            ? 'Allow Notifications in Your Browser Settings.'
            : 'Permission is Required to Enable Browser Notifications.',
        });
        return;
      }
      showBrowserNotification('Browser notifications enabled', {
        body: 'You will now receive alert notifications in this browser.',
        tag:  'settings-browser-enabled',
      });
    }
    setPrefs((prev: NotificationPreferences) => ({ ...prev, [key]: nextEnabled }));
    toast.success(`${CHANNEL_CONFIG[key].label} ${nextEnabled ? 'enabled' : 'disabled'}`);
  };

  // ── Tender preferences ────────────────────────────────────
  const [tenderPrefs, setTenderPrefs] = useState(() => getPref(uid, 'tender_prefs', {
    defaultSector: '', defaultState: '', defaultSort: 'newest',
    defaultPageSize: '15', minValue: '',
  }));
  useEffect(() => {
    if (user?.id) {
      setTenderPrefs(getPref(user.id, 'tender_prefs', {
        defaultSector: '', defaultState: '', defaultSort: 'newest',
        defaultPageSize: '15', minValue: '',
      }));
      setDisplayPrefs(getPref(user.id, 'display_prefs', DEFAULT_DISPLAY_PREFS));
    }
  }, [user?.id]);

  const saveTenderPrefs = () => {
    setPref(uid, 'tender_prefs', tenderPrefs);
    toast.success('Tender Preferences Saved');
  };

  // ── Display preferences ───────────────────────────────────
  const [displayPrefs, setDisplayPrefs] = useState<DisplayPrefs>(
    () => getPref(uid, 'display_prefs', DEFAULT_DISPLAY_PREFS),
  );
  const saveDisplayPrefs = (patch: Partial<DisplayPrefs>) => {
    const next = { ...displayPrefs, ...patch };
    setDisplayPrefs(next);
    setPref(uid, 'display_prefs', next);
    toast.success('Display Preferences Saved');
  };

  // ── Data & privacy ────────────────────────────────────────
  const clearHistory = () => {
    ['stats_history','stats_snapshot_ts','last_total_tenders','last_visit_ts']
      .forEach(k => removePref(uid, k));
    toast.success('History Cleared');
  };
  const resetAllPrefs = () => {
    ['tender_prefs','alert_prefs','display_prefs'].forEach(k => removePref(uid, k));
    toast.success('All Preferences Reset to Defaults');
    window.location.reload();
  };
  const exportData = () => {
    const data = {
      exported_at:   new Date().toISOString(),
      user:          { name: user?.name, email: user?.email, role: user?.role },
      tender_prefs:  getPref(uid, 'tender_prefs', {}),
      display_prefs: getPref(uid, 'display_prefs', {}),
      notif_prefs:   prefs,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `warroom-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data Exported');
  };

  // ════════════════════════════════════════════════════════════
  // PHASE 3 — 2FA + RECOVERY CODES
  // ════════════════════════════════════════════════════════════
  const [totpEnabled,       setTotpEnabled]      = useState(false);
  const [totpQr,            setTotpQr]           = useState<string | null>(null);
  const [totpSecret,        setTotpSecret]       = useState<string | null>(null);
  const [totpCode,          setTotpCode]         = useState('');
  const [totpLoading,       setTotpLoading]      = useState(false);
  const [totpSetupMode,     setTotpSetupMode]    = useState(false);
  const [recoveryCodes,     setRecoveryCodes]    = useState<string[]>([]);
  const [showRecoveryCodes, setShowRecoveryCodes]= useState(false);
  const [remainingCodes,    setRemainingCodes]   = useState(0);
  const [totpStatusLoading, setTotpStatusLoading]= useState(false);
  const [regenLoading,      setRegenLoading]     = useState(false);
  const [savedConfirmed,    setSavedConfirmed]   = useState(false);

  // ── Password modal for viewing recovery codes ─────────────
  const [showPwModal,    setShowPwModal]    = useState(false);
  const [pwModalLoading, setPwModalLoading] = useState(false);
  const [pwModalError,   setPwModalError]   = useState('');
  // Whether the modal was triggered for "view" vs "regenerate"
  const [pwModalIntent, setPwModalIntent]   = useState<'view' | 'regen' | 'clearHistory' | 'resetPrefs'>('view');
  const passwordModalCopy = {
    view: {
      title: 'Verify Your Password',
      subtitle: 'Enter Your Password to View Recovery Codes',
    },
    regen: {
      title: 'Verify Your Password',
      subtitle: 'Enter Your Password to Regenerate Recovery Codes',
    },
    clearHistory: {
      title: 'Clear Trend History?',
      subtitle: 'Enter Your Password Before Clearing Local Tender Trend History',
    },
    resetPrefs: {
      title: 'Reset Preferences?',
      subtitle: 'Enter Your Password Before Resetting Local Preferences',
    },
  }[pwModalIntent];

  const load2faStatus = useCallback(async () => {
    setTotpStatusLoading(true);
    try {
      const res = await apiClient.get('/auth/totp/status');
      setTotpEnabled(res.data.enabled);
      setRemainingCodes(res.data.remaining_recovery_codes ?? 0);
    } catch { /* silently ignore */ }
    finally { setTotpStatusLoading(false); }
  }, []);

  useEffect(() => {
    if (activeSection === 'security') {
      // Reset visibility whenever user navigates to security section
      setShowRecoveryCodes(false);
      setSavedConfirmed(false);
      load2faStatus();
    }
  }, [activeSection, load2faStatus]);

  const handle2faSetup = async () => {
    setTotpLoading(true);
    try {
      const res = await apiClient.post('/auth/totp/setup');
      setTotpQr(res.data.qr_code);
      setTotpSecret(res.data.secret);
      setRecoveryCodes(res.data.recovery_codes);
      setShowRecoveryCodes(false);
      setSavedConfirmed(false);
      setTotpSetupMode(true);
    } catch (err) {
      toast.error(axiosErrorDetail(err) ?? 'Failed to start 2FA setup');
    } finally {
      setTotpLoading(false);
    }
  };

  const handle2faVerify = async () => {
    if (totpCode.length !== 6) return toast.error('Enter the 6-digit code from your authenticator app');
    setTotpLoading(true);
    try {
      const res = await apiClient.post('/auth/totp/verify', { code: totpCode });
      setTotpEnabled(true);
      setRemainingCodes(res.data.remaining_recovery_codes ?? 10);
      setTotpSetupMode(false);
      setTotpQr(null);
      setTotpSecret(null);
      setTotpCode('');
      // After first-time setup, show codes immediately (no password needed — user just set their password moments ago)
      setShowRecoveryCodes(true);
      setSavedConfirmed(false);
      toast.success('2FA Enabled Successfully — save your recovery codes below');
    } catch (err) {
      toast.error(axiosErrorDetail(err) ?? 'Invalid code. Please try again.');
    } finally {
      setTotpLoading(false);
    }
  };

  const handle2faDisable = async () => {
    setTotpLoading(true);
    try {
      await apiClient.delete('/auth/totp');
      setTotpEnabled(false);
      setRecoveryCodes([]);
      setShowRecoveryCodes(false);
      setRemainingCodes(0);
      setSavedConfirmed(false);
      toast.success('2FA Disabled');
    } catch (err) {
      toast.error(axiosErrorDetail(err) ?? 'Failed to Disable 2FA');
    } finally {
      setTotpLoading(false);
    }
  };

  // ── Password modal handlers ───────────────────────────────
  const openViewModal = () => {
    setPwModalIntent('view');
    setPwModalError('');
    setShowPwModal(true);
  };

  const openRegenModal = () => {
    setPwModalIntent('regen');
    setPwModalError('');
    setShowPwModal(true);
  };

  const openProtectedActionModal = (intent: 'clearHistory' | 'resetPrefs') => {
    setPwModalIntent(intent);
    setPwModalError('');
    setShowPwModal(true);
  };

  const handlePasswordModalConfirm = async (password: string) => {
    setPwModalLoading(true);
    setPwModalError('');
    try {
      // Verify password by calling change-password with same password — we use a dedicated verify endpoint
      // Since we don't have a standalone verify endpoint, we call /auth/me after setting Authorization
      // and attempt a dry-run via change-password with current=new (backend rejects with 422, not 401)
      // Better: just POST to login with current credentials to confirm identity
      const formData = new URLSearchParams();
      formData.append('username', user?.email ?? '');
      formData.append('password', password);

      const res = await fetch(
        `${(import.meta.env.VITE_API_URL ?? 'http://localhost:8000')}/auth/login`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    formData.toString(),
        }
      );

      if (!res.ok) {
        setPwModalError('Incorrect password. Please try again.');
        setPwModalLoading(false);
        return;
      }

      // Password confirmed — now perform the intended action
      setShowPwModal(false);

      if (pwModalIntent === 'view') {
        // Fetch fresh codes from the API
        const codesRes = await apiClient.get('/auth/totp/status');
        setRemainingCodes(codesRes.data.remaining_recovery_codes ?? 0);
        // We don't store plain codes server-side after initial generation
        // So if recoveryCodes is empty (returning user), show the low-count warning instead
        if (recoveryCodes.length > 0) {
          setShowRecoveryCodes(true);
        } else {
          // No codes in memory — user needs to regenerate to see them
          toast.info('Recovery codes are not stored after initial setup. Click Regenerate to get a new set.');
        }
      } else if (pwModalIntent === 'regen') {
        // Regenerate
        await doRegenerate();
      } else if (pwModalIntent === 'clearHistory') {
        clearHistory();
      } else if (pwModalIntent === 'resetPrefs') {
        resetAllPrefs();
      }

    } catch {
      setPwModalError('Could not verify password. Check your connection.');
    } finally {
      setPwModalLoading(false);
    }
  };

  const doRegenerate = async () => {
    setRegenLoading(true);
    try {
      const res = await apiClient.post('/auth/totp/recovery-codes/regenerate');
      setRecoveryCodes(res.data.recovery_codes);
      setRemainingCodes(res.data.recovery_codes.length);
      setShowRecoveryCodes(true);
      setSavedConfirmed(false);
      toast.success('New Recovery Codes Generated — Save Them Now');
    } catch (err) {
      toast.error(axiosErrorDetail(err) ?? 'Failed to Regenerate Recovery Codes');
    } finally {
      setRegenLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════════
  // SESSIONS
  // ════════════════════════════════════════════════════════════
  const [sessions,        setSessions]       = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await apiClient.get('/sessions');
      setSessions(Array.isArray(res.data) ? res.data : []);
    } catch { /* silently ignore */ }
    finally { setSessionsLoading(false); }
  }, []);

  useEffect(() => {
    if (activeSection === 'security') loadSessions();
  }, [activeSection, loadSessions]);

  const revokeSession = async (id: string) => {
    try {
      await apiClient.delete(`/sessions/${id}`);
      setSessions(prev => prev.filter(s => s.id !== id));
      toast.success('Session Revoked');
    } catch (err) {
      toast.error(axiosErrorDetail(err) ?? 'Failed to revoke session');
    }
  };

  const revokeAllSessions = async () => {
    try {
      await apiClient.delete('/sessions');
      await loadSessions();
      toast.success('All Other Sessions Revoked');
    } catch (err) {
      toast.error(axiosErrorDetail(err) ?? 'Failed to revoke sessions');
    }
  };

  // ════════════════════════════════════════════════════════════
  // API KEYS
  // ════════════════════════════════════════════════════════════
  const [apiKeys,        setApiKeys]       = useState<ApiKeyItem[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [newKeyName,     setNewKeyName]    = useState('');
  const [createdKey,     setCreatedKey]    = useState<string | null>(null);

  const loadApiKeys = useCallback(async () => {
    setApiKeysLoading(true);
    try {
      const res = await apiClient.get('/api-keys');
      setApiKeys(Array.isArray(res.data) ? res.data : []);
    } catch { /* silently ignore */ }
    finally { setApiKeysLoading(false); }
  }, []);

  useEffect(() => {
    if (activeSection === 'security') loadApiKeys();
  }, [activeSection, loadApiKeys]);

  const createApiKey = async () => {
    if (!newKeyName.trim()) return toast.error('Enter a name for this API key');
    try {
      const res = await apiClient.post('/api-keys', { name: newKeyName.trim() });
      setCreatedKey(res.data.key);
      setNewKeyName('');
      await loadApiKeys();
      toast.success("API Key Created — copy it now, it won't be shown again");
    } catch (err) {
      toast.error(axiosErrorDetail(err) ?? 'Failed to create API key');
    }
  };

  const revokeApiKey = async (id: string) => {
    try {
      await apiClient.delete(`/api-keys/${id}`);
      setApiKeys(prev => prev.filter(k => k.id !== id));
      toast.success('API Key Revoked');
    } catch (err) {
      toast.error(axiosErrorDetail(err) ?? 'Failed to revoke API key');
    }
  };

  // ════════════════════════════════════════════════════════════
  // TEAMS
  // ════════════════════════════════════════════════════════════
  const [teams,        setTeams]       = useState<TeamItem[]>([]);
  const [selectedTeam, setSelectedTeam]= useState<TeamItem | null>(null);
  const [invitations,  setInvitations] = useState<InvitationItem[]>([]);
  const [inviteEmail,  setInviteEmail] = useState('');
  const [inviteRole,   setInviteRole]  = useState('analyst');

  const loadTeams = useCallback(async () => {
    try {
      const res = await apiClient.get('/teams');
      const data = Array.isArray(res.data) ? res.data : [];
      setTeams(data);
      if (data.length > 0 && !selectedTeam) setSelectedTeam(data[0]);
    } catch { /* silently ignore */ }
  }, [selectedTeam]);

  const loadInvitations = useCallback(async (teamId: string) => {
    try {
      const res = await apiClient.get(`/teams/${teamId}/invitations`);
      setInvitations(Array.isArray(res.data) ? res.data : []);
    } catch { /* silently ignore */ }
  }, []);

  useEffect(() => {
    if (activeSection === 'team') loadTeams();
  }, [activeSection, loadTeams]);

  useEffect(() => {
    if (selectedTeam) loadInvitations(selectedTeam.id);
  }, [selectedTeam, loadInvitations]);

  const createTeam = async () => {
    try {
      const res = await apiClient.post('/teams', { name: `${user?.name ?? 'My'}'s Team` });
      setTeams(prev => [...prev, res.data]);
      setSelectedTeam(res.data);
      toast.success('Team Created');
    } catch (err) {
      toast.error(axiosErrorDetail(err) ?? 'Failed to create team');
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return toast.error('Enter an email address');
    if (!selectedTeam) return toast.error('Create a team first');
    try {
      const res = await apiClient.post(`/teams/${selectedTeam.id}/invitations`, {
        email: inviteEmail.trim(), role: inviteRole,
      });
      setInvitations(prev => [res.data, ...prev]);
      setInviteEmail('');
      toast.success(`Invitation sent to ${inviteEmail}`);
    } catch (err) {
      toast.error(axiosErrorDetail(err) ?? 'Failed to send invitation');
    }
  };

  const revokeInvite = async (invId: string) => {
    if (!selectedTeam) return;
    try {
      await apiClient.delete(`/teams/${selectedTeam.id}/invitations/${invId}`);
      setInvitations(prev => prev.filter(i => i.id !== invId));
      toast.success('Invitation Revoked');
    } catch (err) {
      toast.error(axiosErrorDetail(err) ?? 'Failed to revoke invitation');
    }
  };

  // ─────────────────────────────────────────────────────────
  return (
    <div className={`${styles.page} page-enter`}>

      {/* ── Password Verify Modal ── */}
      <AnimatePresence>
        {showPwModal && (
          <PasswordVerifyModal
            onConfirm={handlePasswordModalConfirm}
            onCancel={() => { setShowPwModal(false); setPwModalError(''); }}
            loading={pwModalLoading}
            error={pwModalError}
            title={passwordModalCopy.title}
            subtitle={passwordModalCopy.subtitle}
          />
        )}
      </AnimatePresence>

      <div className={styles.pageSectionHeader}>
        <activeSectionMeta.icon size={18} className={styles.sectionIcon} />
        <div>
          <h3 className={styles.sectionTitle}>{activeSectionMeta.label}</h3>
          <p className={styles.sectionSub}>{SECTION_SUBTITLES[activeSection]}</p>
        </div>
      </div>

      <div className={styles.layout}>

        {/* ── Sidebar nav ── */}
        <nav className={styles.settingsNav}>
          {GROUPS.map(group => (
            <div key={group} className={styles.navGroup}>
              <p className={styles.navGroupLabel}>{group}</p>
              {SECTIONS.filter(s => s.group === group && !('hidden' in s && s.hidden)).map(section => (
                <button
                  key={section.id}
                  className={`${styles.navItem} ${activeSection === section.id ? styles.navItemActive : ''}`}
                  onClick={() => setActive(section.id)}
                >
                  <section.icon size={15} className={styles.navIcon} />
                  <span>{section.label}</span>
                  {activeSection === section.id && <ChevronRight size={13} className={styles.navChevron} />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* ── Content ── */}
        <div className={styles.content}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className={styles.section}
            >

              {/* ════ 1. PROFILE ════ */}
              {activeSection === 'profile' && (
                <>
                  <div className={styles.sectionHeader}>
                    <User size={18} className={styles.sectionIcon} />
                    <div><h3 className={styles.sectionTitle}>Profile</h3><p className={styles.sectionSub}>Edit the Profile Shown Across the Dashboard</p></div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.profileLayout}>
                      <div className={styles.avatarColumn}>
                        <div className={`${styles.avatar} ${avatarSrc ? styles.avatarWithImage : styles.avatarFallback}`}>
                          {avatarSrc ? <img src={avatarSrc} alt="avatar" /> : initials}
                        </div>
                        <button className={styles.avatarBtn} onClick={() => avatarRef.current?.click()}><Camera size={13} /> Change Avatar</button>
                        <input ref={avatarRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
                      </div>
                      <div>
                        <div className={styles.formGrid}>
                          <div className={styles.field}><label className={styles.label}>Full Name</label><input className={styles.input} value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your full name" /></div>
                          <div className={styles.field}><label className={styles.label}>Login Email</label><input className={`${styles.input} ${styles.inputReadonly}`} value={user?.email ?? ''} readOnly /><p className={styles.helpText}>Email cannot be changed here</p></div>
                          <div className={`${styles.field} ${styles.fieldFull}`}><label className={styles.label}>Role</label><input className={`${styles.input} ${styles.inputReadonly}`} value={user?.role ?? ''} readOnly /><p className={styles.helpText}>Role is managed by your administrator</p></div>
                        </div>
                        <div className={styles.actionRow}>
                          <button className={styles.ghostBtn} onClick={() => setProfileName(originalName.current)}>Reset</button>
                          <button className={styles.primaryBtn} onClick={handleProfileSave} disabled={profileSaving}>
                            {profileSaving ? <><RefreshCw size={13} className={styles.spinning} /> Saving…</> : <><Check size={13} /> Save Profile</>}
                          </button>
                        </div>
                        <div className={styles.metaLine}><span className={styles.metaBadge}>Role: {user?.role ?? 'analyst'}</span><span>Signed in as <b>{user?.email ?? 'unknown'}</b></span></div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ════ 2. PASSWORD ════ */}
              {activeSection === 'appearance' && (
                <>
                  <div className={styles.sectionHeader}><Palette size={18} className={styles.sectionIcon} /><div><h3 className={styles.sectionTitle}>Appearance</h3><p className={styles.sectionSub}>Choose a Theme and Preview it Before Applying</p></div></div>
                  <div className={styles.card}><ThemePreviewSelector selectedTheme={themeMode} onSelect={setThemeMode} /></div>
                  <div className={styles.card}>
                    <p className={styles.cardLabel}>Display Preferences</p>
                    <div className={styles.formGrid}>
                      {DISPLAY_SELECT_FIELDS.map(item => (
                        <div key={item.key} className={styles.field}>
                          <label className={styles.label}>{item.label}</label>
                          <select className={styles.select} value={displayPrefs[item.key]} onChange={e => saveDisplayPrefs({ [item.key]: e.target.value })}>
                            {item.options.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeSection === 'tender-prefs' && (
                <>
                  <div className={styles.sectionHeader}><SlidersHorizontal size={18} className={styles.sectionIcon} /><div><h3 className={styles.sectionTitle}>Tender Preferences</h3><p className={styles.sectionSub}>Default Filters Applied When Opening the Tenders Page</p></div></div>
                  <div className={styles.card}>
                    <div className={styles.formGrid}>
                      <div className={styles.field}><label className={styles.label}>Default Sector</label><select className={styles.select} value={tenderPrefs.defaultSector} onChange={e => setTenderPrefs(p => ({ ...p, defaultSector: e.target.value }))}><option value="">All Sectors</option><option value="facility_management">Facility Management</option><option value="construction">Construction</option><option value="cleaning">Cleaning</option><option value="it_services">IT Services</option><option value="healthcare">Healthcare</option><option value="transportation">Transportation</option></select></div>
                      <div className={styles.field}><label className={styles.label}>Default State</label><select className={styles.select} value={tenderPrefs.defaultState} onChange={e => setTenderPrefs(p => ({ ...p, defaultState: e.target.value }))}><option value="">All States</option>{['NSW','VIC','QLD','WA','SA','TAS','NT','ACT'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                      <div className={styles.field}><label className={styles.label}>Default Sort</label><select className={styles.select} value={tenderPrefs.defaultSort} onChange={e => setTenderPrefs(p => ({ ...p, defaultSort: e.target.value }))}><option value="newest">Newest First</option><option value="closing">Closing Soon</option><option value="value_desc">Highest Value</option><option value="value_asc">Lowest Value</option></select></div>
                      <div className={styles.field}><label className={styles.label}>Default Page Size</label><select className={styles.select} value={tenderPrefs.defaultPageSize} onChange={e => setTenderPrefs(p => ({ ...p, defaultPageSize: e.target.value }))}>{['10','15','25','50'].map(n => <option key={n} value={n}>{n} per page</option>)}</select></div>
                      <div className={`${styles.field} ${styles.fieldFull}`}><label className={styles.label}>Minimum Contract Value</label><input className={styles.input} type="number" placeholder="e.g. 100000 — leave empty for all values" value={tenderPrefs.minValue} onChange={e => setTenderPrefs(p => ({ ...p, minValue: e.target.value }))} /></div>
                    </div>
                    <div className={styles.actionRow}>
                      <button className={styles.ghostBtn} onClick={() => { const d = { defaultSector:'', defaultState:'', defaultSort:'newest', defaultPageSize:'15', minValue:'' }; setTenderPrefs(d); setPref(uid, 'tender_prefs', d); toast.success('Reset to Defaults'); }}>Reset</button>
                      <button className={styles.primaryBtn} onClick={saveTenderPrefs}><Check size={13} /> Save Preferences</button>
                    </div>
                  </div>
                </>
              )}

              {/* ════ 5. Notification ════ */}
              {activeSection === 'notification' && (
                <>
                  <div className={styles.sectionHeader}><Bell size={18} className={styles.sectionIcon} /><div><h3 className={styles.sectionTitle}>Notification</h3><p className={styles.sectionSub}>Control How and When Alerts Reach You</p></div></div>
                  <div className={styles.card}>
                    <p className={styles.cardLabel}>Notification Channels</p>
                    <div className={styles.channelList}>
                      {(Object.keys(CHANNEL_CONFIG) as ChannelKey[]).map(key => {
                        const Icon = CHANNEL_CONFIG[key].icon;
                        return (
                          <div key={key} className={styles.channelRow}>
                            <div className={styles.channelLeft}><div className={styles.channelIcon}><Icon size={16} /></div><div><p className={styles.channelLabel}>{CHANNEL_CONFIG[key].label}</p><p className={styles.channelSub}>{CHANNEL_CONFIG[key].sub}</p></div></div>
                            <button className={`${styles.toggle} ${prefs[key] ? styles.toggleOn : ''}`} onClick={() => void updateChannel(key)}><span className={styles.toggleThumb} /></button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* ════ 6. DISPLAY ════ */}
              {activeSection === 'data-privacy' && (
                <>
                  <div className={styles.sectionHeader}><Trash2 size={18} className={styles.sectionIcon} /><div><h3 className={styles.sectionTitle}>Data & Privacy</h3><p className={styles.sectionSub}>Manage Your Local Data and Preferences</p></div></div>
                  {[
                    { title: 'Clear Trend History',   sub: 'Removes the 30-Day Stats History Used for Change Indicators on the Overview Page.', icon: Clock,     btn: 'Clear History', color: '#F59E0B', action: () => openProtectedActionModal('clearHistory') },
                    { title: 'Reset All Preferences', sub: 'Resets Tender Filters, Display Preferences to Defaults. Page Will Reload.',         icon: RefreshCw, btn: 'Reset',         color: '#3B82F6', action: () => openProtectedActionModal('resetPrefs') },
                    { title: 'Export My Data',        sub: 'Download a JSON File of Your Settings, Preferences, and Profile.',                  icon: Download,  btn: 'Export',        color: '#10B981', action: exportData    },
                  ].map(item => (
                    <div key={item.title} className={styles.card}>
                      <div className={styles.actionRow}>
                        <div className={styles.actionIcon} style={{ background: item.color+'18', color: item.color }}><item.icon size={16} /></div>
                        <div className={styles.actionInfo}><p className={styles.actionTitle}>{item.title}</p><p className={styles.actionSub}>{item.sub}</p></div>
                        <button className={styles.btnOutline} style={{ borderColor: item.color+'50', color: item.color }} onClick={item.action}>{item.btn}</button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* ════ 9. SECURITY ════ */}
              {activeSection === 'security' && (
                <>
                  <div className={styles.sectionHeader}>
                    <Shield size={18} className={styles.sectionIcon} />
                    <div><h3 className={styles.sectionTitle}>Security</h3><p className={styles.sectionSub}>Account Security and Session Management</p></div>
                  </div>

                  <div className={styles.card}>
                    <div className={styles.cardHeaderRow}>
                      <div>
                        <p className={styles.cardSectionTitle}><Lock size={14} /> Password</p>
                        <p className={styles.cardSectionSub}>Update Your Account Password</p>
                      </div>
                    </div>
                    <div className={styles.formGrid}>
                      <div className={`${styles.field} ${styles.fieldFull}`}>
                        <label className={styles.label}>Current Password</label>
                        <div className={styles.inputWrap}><input className={styles.input} type={showPw.current ? 'text' : 'password'} value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} placeholder="Enter current password" /><button className={styles.inputToggle} type="button" onClick={() => setShowPw(p => ({ ...p, current: !p.current }))}>{showPw.current ? <EyeOff size={14} /> : <Eye size={14} />}</button></div>
                      </div>
                      <div className={styles.field}><label className={styles.label}>New Password</label><div className={styles.inputWrap}><input className={styles.input} type={showPw.new ? 'text' : 'password'} value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="At least 8 characters" /><button className={styles.inputToggle} type="button" onClick={() => setShowPw(p => ({ ...p, new: !p.new }))}>{showPw.new ? <EyeOff size={14} /> : <Eye size={14} />}</button></div></div>
                      <div className={styles.field}><label className={styles.label}>Confirm Password</label><div className={styles.inputWrap}><input className={styles.input} type={showPw.confirm ? 'text' : 'password'} value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder="Repeat new password" /><button className={styles.inputToggle} type="button" onClick={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))}>{showPw.confirm ? <EyeOff size={14} /> : <Eye size={14} />}</button></div></div>
                    </div>
                    {pwNew.length > 0 && (
                      <div className={styles.strengthWrap}>
                        <div className={styles.strengthBars}>{[1,2,3].map(i => <div key={i} className={styles.strengthBar} style={{ background: i <= pwStrength ? pwStrength === 1 ? '#EF4444' : pwStrength === 2 ? '#F59E0B' : '#10B981' : 'var(--bg-overlay)' }} />)}</div>
                        <span className={styles.strengthLabel}>{pwStrength === 1 ? 'Weak' : pwStrength === 2 ? 'Good' : 'Strong'}</span>
                      </div>
                    )}
                    <div className={styles.actionRow}>
                      <button className={styles.ghostBtn} onClick={() => { setPwCurrent(''); setPwNew(''); setPwConfirm(''); }}>Clear</button>
                      <button className={styles.primaryBtn} onClick={handlePasswordSave} disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm}>
                        {pwSaving ? <><RefreshCw size={13} className={styles.spinning} /> Updating...</> : <><Lock size={13} /> Update Password</>}
                      </button>
                    </div>
                  </div>

                  {/* 2FA card */}
                  <div className={styles.card}>
                    <div className={styles.actionRow}>
                      <div className={styles.actionIcon} style={{ background: totpEnabled ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.1)', color: totpEnabled ? '#10B981' : '#7C3AED' }}>
                        {totpEnabled ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
                      </div>
                      <div className={styles.actionInfo}>
                        <p className={styles.actionTitle}>Two-Factor Authentication</p>
                        <p className={styles.actionSub}>{totpEnabled ? '2FA is Active. Your Account is Protected with an Authenticator App.' : 'Add an Extra Layer of Security with an Authenticator App.'}</p>
                      </div>
                      {totpEnabled ? (
                        <button className={styles.btnOutline} style={{ borderColor: '#EF444450', color: '#EF4444' }} onClick={handle2faDisable} disabled={totpLoading}>
                          {totpLoading ? <RefreshCw size={13} className={styles.spinning} /> : <ShieldOff size={13} />} Disable 2FA
                        </button>
                      ) : (
                        <button className={styles.btnOutline} style={{ borderColor: '#7C3AED50', color: '#7C3AED' }} onClick={handle2faSetup} disabled={totpLoading}>
                          {totpLoading ? <RefreshCw size={13} className={styles.spinning} /> : <ShieldCheck size={13} />} Enable 2FA
                        </button>
                      )}
                    </div>

                    {/* QR setup flow */}
                    {totpSetupMode && totpQr && (
                      <div className={styles.totpSetup}>
                        <div className={styles.totpDivider} />
                        <p className={styles.totpInstruction}>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
                        <div className={styles.totpQrWrap}><img src={`data:image/png;base64,${totpQr}`} alt="2FA QR Code" className={styles.totpQr} /></div>
                        {totpSecret && (
                          <div className={styles.totpSecretWrap}>
                            <span className={styles.totpSecretLabel}>Manual entry key:</span>
                            <code className={styles.totpSecret}>{totpSecret}</code>
                            <button className={styles.totpCopyBtn} onClick={() => { navigator.clipboard.writeText(totpSecret); toast.success('Copied'); }}><Copy size={12} /></button>
                          </div>
                        )}
                        <div className={styles.totpVerifyRow}>
                          <input className={styles.input} placeholder="Enter 6-digit code" value={totpCode}
                            onChange={e => setTotpCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                            maxLength={6} style={{ maxWidth: 180, letterSpacing: '0.2em', textAlign: 'center' }} />
                          <button className={styles.primaryBtn} onClick={handle2faVerify} disabled={totpLoading || totpCode.length !== 6}>
                            {totpLoading ? <RefreshCw size={13} className={styles.spinning} /> : <Check size={13} />} Verify & Enable
                          </button>
                          <button className={styles.ghostBtn} onClick={() => { setTotpSetupMode(false); setTotpQr(null); setTotpCode(''); }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recovery codes card — keep this area stable while 2FA status loads */}
                  {totpStatusLoading ? (
                    <div className={styles.card}>
                      <div className={styles.cardHeaderRow}>
                        <div>
                          <p className={styles.cardSectionTitle}><KeyRound size={14} /> Recovery Codes</p>
                          <p className={styles.cardSectionSub}>Checking recovery code status...</p>
                        </div>
                      </div>
                      <div className={styles.recoveryState}>
                        <RefreshCw size={16} className={styles.spinning} />
                      </div>
                    </div>
                  ) : totpEnabled && (
                    <div className={styles.card}>
                      <div className={styles.cardHeaderRow}>
                        <div>
                          <p className={styles.cardSectionTitle}><KeyRound size={14} /> Recovery Codes</p>
                          <p className={styles.cardSectionSub}>
                            {showRecoveryCodes
                              ? 'Save These Codes Somewhere Safe — Each Can Only Be Used Once'
                              : remainingCodes < 4
                                ? `⚠️ Only ${remainingCodes} Code${remainingCodes === 1 ? '' : 's'} Remaining — Regenerate Soon`
                                : `${remainingCodes} Codes Available — Verify Your Password to View`}
                          </p>
                        </div>
                        <div className={styles.recoveryActions}>
                          {/* View / Hide toggle button */}
                          {!showRecoveryCodes ? (
                            <button
                              className={styles.btnOutline}
                              style={{ borderColor: '#3B82F650', color: '#3B82F6' }}
                              onClick={openViewModal}
                            >
                              <Eye size={13} /> View Recovery Codes
                            </button>
                          ) : (
                            <button
                              className={styles.btnOutline}
                              style={{ borderColor: '#6B728050', color: '#6B7280' }}
                              onClick={() => { setShowRecoveryCodes(false); setSavedConfirmed(false); }}
                            >
                              <EyeOff size={13} /> Hide Codes
                            </button>
                          )}
                          {/* Regenerate — also password gated */}
                          <button
                            className={styles.btnOutline}
                            style={{ borderColor: '#7C3AED50', color: '#7C3AED' }}
                            onClick={openRegenModal}
                            disabled={regenLoading}
                          >
                            {regenLoading ? <RefreshCw size={13} className={styles.spinning} /> : <RefreshCw size={13} />}
                            Regenerate
                          </button>
                        </div>
                      </div>

                      {/* Codes grid — only shown after password verification */}
                      <AnimatePresence>
                        {showRecoveryCodes && recoveryCodes.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{    opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div className={styles.recoveryCodesGrid} style={{ marginTop: 16 }}>
                              {recoveryCodes.map((code, i) => (
                                <div key={i} className={styles.recoveryCodeItem}>
                                  <code className={styles.recoveryCode}>{code}</code>
                                  <button
                                    className={styles.totpCopyBtn}
                                    onClick={() => { navigator.clipboard.writeText(code); toast.success('Copied'); }}
                                    title="Copy code"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              className={styles.copyAllBtn}
                              onClick={() => { navigator.clipboard.writeText(recoveryCodes.join('\n')); toast.success('All Codes Copied'); }}
                            >
                              <Copy size={13} /> Copy All Codes
                            </button>
                            <label className={styles.savedConfirmRow}>
                              <input
                                type="checkbox"
                                checked={savedConfirmed}
                                onChange={e => setSavedConfirmed(e.target.checked)}
                              />
                              <span>{savedConfirmed ? '✓ Saved' : "I've Saved These Recovery Codes in a Safe Place"}</span>
                            </label>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Active sessions */}
                  <div className={styles.card}>
                    <div className={styles.cardHeaderRow}>
                      <div>
                        <p className={styles.cardSectionTitle}><MonitorSmartphone size={14} /> Active Sessions</p>
                        <p className={styles.cardSectionSub}>Devices Currently Signed in to Your Account</p>
                      </div>
                      {sessions.filter(s => !s.is_current).length > 0 && (
                        <button className={styles.btnOutline} style={{ borderColor: '#EF444450', color: '#EF4444' }} onClick={revokeAllSessions}>Revoke All Others</button>
                      )}
                    </div>
                    {sessionsLoading ? (
                      <div className={styles.sessionState}><RefreshCw size={16} className={styles.spinning} /></div>
                    ) : sessions.length === 0 ? (
                      <p className={styles.sessionState}>No active sessions found</p>
                    ) : (
                      <div className={styles.sessionList}>
                        {sessions.map(s => (
                          <div key={s.id} className={styles.sessionRow}>
                            <div className={styles.sessionIcon} style={{ background: s.is_current ? 'rgba(16,185,129,0.1)' : 'var(--bg-elevated)', color: s.is_current ? '#10B981' : 'var(--text-dim)' }}>
                              <MonitorSmartphone size={14} />
                            </div>
                            <div className={styles.sessionInfo}>
                              <p className={styles.sessionAgent}>{s.user_agent ? s.user_agent.slice(0, 60) : 'Unknown device'}</p>
                              <p className={styles.sessionMeta}>{s.ip_address ?? 'Unknown IP'} · Last active {new Date(s.last_active_at).toLocaleString()}{s.is_current && <span className={styles.currentBadge}>Current</span>}</p>
                            </div>
                            {!s.is_current && <button className={styles.sessionRevokeBtn} onClick={() => revokeSession(s.id)} title="Revoke session"><XCircle size={15} /></button>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardHeaderRow}>
                      <div><p className={styles.cardSectionTitle}><KeyRound size={14} /> API Key Management</p><p className={styles.cardSectionSub}>Generate Keys for External Integrations</p></div>
                    </div>
                    {createdKey && (
                      <div className={styles.createdKeyBanner}>
                        <AlertTriangle size={14} style={{ color: '#F59E0B', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}><p className={styles.createdKeyTitle}>Copy your key now — it won't be shown again</p><code className={styles.createdKeyValue}>{createdKey}</code></div>
                        <button className={styles.totpCopyBtn} onClick={() => { navigator.clipboard.writeText(createdKey); toast.success('Copied'); }}><Copy size={13} /></button>
                        <button className={styles.sessionRevokeBtn} onClick={() => setCreatedKey(null)}><XCircle size={14} /></button>
                      </div>
                    )}
                    <div className={styles.inviteRow}>
                      <input className={styles.input} placeholder='e.g. "Zapier Integration"' value={newKeyName} onChange={e => setNewKeyName(e.target.value)} style={{ flex: 1 }} />
                      <button className={styles.primaryBtn} onClick={createApiKey}><Plus size={13} /> Generate Key</button>
                    </div>
                    {apiKeysLoading ? <div className={styles.emptyState}><RefreshCw size={16} className={styles.spinning} /></div> : apiKeys.length === 0 ? <p className={styles.emptyState}>No API keys yet</p> : (
                      <div className={styles.apiKeyList}>
                        {apiKeys.map(k => (
                          <div key={k.id} className={styles.apiKeyRow}>
                            <div className={styles.apiKeyIcon}><KeyRound size={14} /></div>
                            <div className={styles.apiKeyInfo}><p className={styles.apiKeyName}>{k.name}</p><p className={styles.apiKeyMeta}><code>{k.prefix}********</code> - created {new Date(k.created_at).toLocaleDateString()}{k.last_used_at && ` - last used ${new Date(k.last_used_at).toLocaleDateString()}`}</p></div>
                            <button className={styles.sessionRevokeBtn} onClick={() => revokeApiKey(k.id)} title="Revoke key"><Trash size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ════ 10. TEAM & ACCESS ════ */}
              {activeSection === 'team' && (
                <>
                  <div className={styles.sectionHeader}><Users size={18} className={styles.sectionIcon} /><div><h3 className={styles.sectionTitle}>Team & Access</h3><p className={styles.sectionSub}>Manage Team Members and Roles</p></div></div>

                  <div className={styles.card}>
                      <div className={styles.teamMember}>
                      <div className={`${styles.avatar} ${avatarSrc ? styles.avatarWithImage : styles.avatarFallback}`} style={{ width: 44, height: 44, fontSize: 15, borderRadius: 12 }}>{avatarSrc ? <img src={avatarSrc} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : initials}</div>
                      <div className={styles.teamInfo}><p className={styles.teamName}>{user?.name ?? 'Analyst'}</p><p className={styles.teamEmail}>{user?.email ?? ''}</p></div>
                      <span className={styles.roleBadge} style={{ background: user?.role === 'admin' ? 'rgba(124,58,237,0.15)' : 'rgba(16,185,129,0.15)', color: user?.role === 'admin' ? '#A78BFA' : '#34D399', border: `1px solid ${user?.role === 'admin' ? '#7C3AED40' : '#10B98140'}` }}>{user?.role ?? 'analyst'}</span>
                      <span className={styles.youBadge}>You</span>
                    </div>
                  </div>

                  <div className={styles.card}>
                    <div className={styles.cardHeaderRow}>
                      <div><p className={styles.cardSectionTitle}><UserPlus size={14} /> Invite Team Members</p><p className={styles.cardSectionSub}>Send email invitations to your team</p></div>
                      {teams.length === 0 && <button className={styles.btnOutline} style={{ borderColor: '#3B82F650', color: '#3B82F6' }} onClick={createTeam}><Plus size={13} /> Create Team</button>}
                    </div>
                    {teams.length === 0 ? <p className={styles.emptyState}>Create a team first to start inviting members</p> : (
                      <>
                        <div className={styles.inviteRow}>
                          <input className={styles.input} placeholder="colleague@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ flex: 1 }} />
                          <select className={styles.select} value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ width: 120 }}><option value="analyst">Analyst</option><option value="admin">Admin</option></select>
                          <button className={styles.primaryBtn} onClick={sendInvite}><UserPlus size={13} /> Invite</button>
                        </div>
                        {invitations.length > 0 && (
                          <div className={styles.invitationList}>
                            {invitations.map(inv => (
                              <div key={inv.id} className={styles.invitationRow}>
                                <div className={styles.invitationInfo}><p className={styles.invitationEmail}>{inv.email}</p><p className={styles.invitationMeta}>{inv.role} · {inv.status} · expires {new Date(inv.expires_at).toLocaleDateString()}</p></div>
                                <span className={`${styles.inviteStatusBadge} ${INVITE_STATUS_CLASS[inv.status] ?? ''}`}>{inv.status}</span>
                                {inv.status === 'pending' && <button className={styles.sessionRevokeBtn} onClick={() => revokeInvite(inv.id)} title="Revoke invitation"><XCircle size={15} /></button>}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
