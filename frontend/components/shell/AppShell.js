'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { networkModules } from '../../lib/networkRoutes';
import { appDisplayName } from '../../lib/publicConfig';
import styles from './AppShell.module.css';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const envLabel = process.env.NEXT_PUBLIC_NETWORK_ENV_LABEL || process.env.NEXT_PUBLIC_ENV_LABEL || 'development';

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('network-vcode-theme');
    if (savedTheme === 'light') {
      document.documentElement.dataset.theme = 'light';
      setTheme('light');
      return;
    }

    document.documentElement.removeAttribute('data-theme');
    setTheme('dark');
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setUser(data?.user || null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    if (nextTheme === 'light') {
      document.documentElement.dataset.theme = 'light';
      window.localStorage.setItem('network-vcode-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      window.localStorage.setItem('network-vcode-theme', 'dark');
    }
    setTheme(nextTheme);
  }

  function isActive(href) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarMain}>
          <div className={styles.brandCluster}>
            <Link href="/" className={styles.brand}>
              {appDisplayName}
            </Link>
            <span className={styles.envBadge}>{envLabel}</span>
          </div>
          <div className={styles.workspaceLabel}>
            <span>Workspace</span>
            <strong>Network Technician</strong>
          </div>
        </div>

        <nav className={styles.desktopNav} aria-label="Network modules">
          {networkModules.map((module) => (
            <Link
              key={module.id}
              href={module.href}
              className={isActive(module.href) ? styles.activeNavLink : styles.navLink}
            >
              {module.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <span className={styles.userLabel}>{user?.displayName || user?.username || 'Network Team'}</span>
          <button type="button" className={styles.themeToggle} onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'light' ? 'Light' : 'Dark'}
          </button>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="network-mobile-nav"
          >
            Menu
          </button>
        </div>
      </header>

      {menuOpen && (
        <nav id="network-mobile-nav" className={styles.mobileNav} aria-label="Network modules">
          {networkModules.map((module) => (
            <Link
              key={module.id}
              href={module.href}
              className={isActive(module.href) ? styles.activeMobileNavLink : styles.mobileNavLink}
            >
              {module.label}
            </Link>
          ))}
        </nav>
      )}

      <main className={styles.content}>{children}</main>
    </div>
  );
}
