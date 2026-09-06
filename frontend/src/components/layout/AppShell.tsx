import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useUIStore } from '../../store/ui.store';
import { useBrowserAlertNotifications } from '../../hooks/useBrowserAlertNotifications';
import Sidebar from './SideBar'; 
import TopBar from './TopBar'; 
import styles from './AppShell.module.css';

export default function AppShell() {
  const { sidebarOpen } = useUIStore();
  const location = useLocation();
  const contentRef = useRef<HTMLElement>(null);
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  useBrowserAlertNotifications();

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div
        className={styles.main}
        style={{ marginLeft: sidebarOpen && !isMobile ? 'var(--sidebar-width)' : '0' }}
      >
        <TopBar pathname={location.pathname} />
        <main className={styles.content} ref={contentRef}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
