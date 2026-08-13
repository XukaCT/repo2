import { CheckCircle2, Monitor, Moon, Sun } from 'lucide-react';
import type { ThemeMode } from '../../store/ui.store';
import styles from './ThemePreviewSelector.module.css';

interface ThemePreviewSelectorProps {
  selectedTheme: ThemeMode;
  onSelect: (mode: ThemeMode) => void;
}

const THEME_OPTIONS = [
  { mode: 'light' as const, title: 'Light', subtitle: 'Clean daytime workspace', previewClass: styles.previewLight, icon: Sun },
  { mode: 'dark' as const, title: 'Dark', subtitle: 'Deep contrast workspace', previewClass: styles.previewDark, icon: Moon },
  { mode: 'system' as const, title: 'System', subtitle: 'Follow device setting', previewClass: styles.previewSystem, icon: Monitor },
];

export default function ThemePreviewSelector({ selectedTheme, onSelect }: ThemePreviewSelectorProps) {
  return (
    <div className={styles.themePreviewGrid}>
      {THEME_OPTIONS.map((option) => {
        const OptionIcon = option.icon;
        const selected = selectedTheme === option.mode;

        return (
          <button
            key={option.mode}
            className={`${styles.themePreviewCard} ${selected ? styles.themePreviewActive : ''}`}
            onClick={() => onSelect(option.mode)}
          >
            <div className={`${styles.themePreviewArt} ${option.previewClass}`}>
              <div className={styles.previewWindowDots}>
                <span />
                <span />
                <span />
              </div>
              <div className={styles.previewSidebar}>
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className={styles.previewContent}>
                <span className={styles.previewLineShort} />
                <span className={styles.previewLineMain} />
                <span className={styles.previewLineMuted} />
                <span className={styles.previewLineSmall} />
              </div>
            </div>
            <div className={styles.themePreviewFooter}>
              <div>
                <span className={styles.themePreviewName}>{option.title}</span>
                <span className={styles.themePreviewDesc}>{option.subtitle}</span>
              </div>
              <span className={styles.themePreviewCheck}>
                {selected ? <CheckCircle2 size={17} /> : <OptionIcon size={16} />}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
