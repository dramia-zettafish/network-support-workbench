'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getWorkspacesForUser } from '@/lib/workspace-config.js';
import { useTheme } from './theme-provider.jsx';
import { useWorkspace } from './workspace-provider.jsx';

export default function NavHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const envLabel = process.env.NEXT_PUBLIC_ENV_LABEL || 'development';
  const [user, setUser] = useState(null);
  const { activeWorkspace, setActiveWorkspace, loaded, setTimezone } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tzOpen, setTzOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwError, setPwError] = useState(null);
  const [pwSuccess, setPwSuccess] = useState(null);
  const [pwSaving, setPwSaving] = useState(false);
  const { theme, setTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingNotifCount, setPendingNotifCount] = useState(0);
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setUser(data?.user || null); if (data?.user?.timezone) setTimezone(data.user.timezone); })
      .catch(() => setUser(null));
    fetch('/api/user-messages').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setUnreadCount(d.data.filter(m => !m.is_read).length); }).catch(() => {});
    Promise.all([
      fetch('/api/notifications?status=pending').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/case-reassignment?status=pending').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([notif, cases]) => {
      const count = (Array.isArray(notif?.data) ? notif.data.length : 0) + (Array.isArray(cases?.data) ? cases.data.length : 0);
      setPendingNotifCount(count);
    });
    fetch('/api/system-feedback').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setUnreadFeedbackCount(d.data.filter(f => !f.reply && !f.is_read).length); }).catch(() => {});
  }, [pathname]);

  const workspaces = getWorkspacesForUser(user);

  useEffect(() => {
    if (!loaded || !workspaces.length) return;
    // If there's already a valid workspace set, keep it
    if (activeWorkspace && workspaces.find((w) => w.key === activeWorkspace)) return;
    // No valid workspace — derive from pathname
    if (pathname === '/my-workspace') { setActiveWorkspace('my_workspace'); return; }
    const match = workspaces.find((w) =>
      w.modules.some((m) => m.href !== '/' && (pathname === m.href || pathname.startsWith(m.href + '/')))
    );
    setActiveWorkspace(match?.key || workspaces[0]?.key || null);
  }, [loaded, workspaces, pathname, activeWorkspace]);

  const currentWorkspace = workspaces.find((w) => w.key === activeWorkspace);
  const modules = currentWorkspace?.modules || [];

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  function isActive(href) {
    if (href === '/') return pathname === '/';
    if (pathname === href) return true;
    // Only match prefix if no other module in the current set is a longer match
    if (pathname.startsWith(href + '/')) {
      const longerMatch = modules.some((m) => m.href !== href && m.href.startsWith(href + '/') && pathname.startsWith(m.href));
      return !longerMatch;
    }
    return false;
  }

  if (pathname === '/login') {
    return (
      <nav className="flex items-center justify-between px-8 h-14" style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl font-bold no-underline hover:text-blue-600" style={{ color: 'var(--color-text-primary)' }}>EU Support</Link>
          <span className="inline-block px-2.5 py-0.5 rounded text-[0.7rem] font-semibold uppercase tracking-wide" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>{envLabel}</span>
        </div>
      </nav>
    );
  }

  return (
    <header style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }} className="shadow-sm">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 h-11" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-base font-bold no-underline hover:text-blue-600" style={{ color: 'var(--color-text-primary)' }}>EU Support</Link>
          <span className="inline-block px-2 py-0.5 rounded text-[0.6rem] font-semibold uppercase tracking-wide" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>{envLabel}</span>
        </div>
        {user && (
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="text-xs font-medium cursor-pointer hover:text-[var(--color-accent)]" style={{ color: 'var(--color-text-secondary)' }}>
              {user.username} ▾
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-lg shadow-lg py-1 z-50" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                <button onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs hover:brightness-125" style={{ color: 'var(--color-text-secondary)' }}>
                  {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
                </button>
                <button onClick={() => { setTzOpen(!tzOpen); }} className="w-full text-left px-4 py-2 text-xs hover:brightness-125" style={{ color: 'var(--color-text-secondary)' }}>
                  🕐 Timezone: {user?.timezone || 'America/Chicago'}
                </button>
                {tzOpen && (
                  <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <select
                      defaultValue={user?.timezone || 'America/Chicago'}
                      onChange={async (e) => {
                        const tz = e.target.value;
                        await fetch('/api/auth/timezone', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timezone: tz }) });
                        setTimezone(tz);
                        setUser({ ...user, timezone: tz });
                        setTzOpen(false);
                        setMenuOpen(false);
                      }}
                      className="w-full text-xs rounded px-2 py-1"
                      style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                    >
                      {['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu','America/Phoenix','UTC'].map(tz => (
                        <option key={tz} value={tz}>{tz.replace('_',' ').replace('America/','').replace('Pacific/','')}{tz==='America/Chicago'?' (CST)':tz==='America/New_York'?' (EST)':tz==='America/Denver'?' (MST)':tz==='America/Los_Angeles'?' (PST)':''}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button onClick={() => { setPwOpen(true); setMenuOpen(false); setPwForm({ current: '', newPw: '', confirm: '' }); setPwError(null); setPwSuccess(null); }} className="w-full text-left px-4 py-2 text-xs hover:brightness-125" style={{ color: 'var(--color-text-secondary)' }}>
                  🔑 Change Password
                </button>
                <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs hover:brightness-125" style={{ color: 'var(--color-text-secondary)' }}>
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPwOpen(false)}>
          <div className="rounded-lg shadow-xl p-6 max-w-sm w-full mx-4" style={{ background: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Change Password</h3>
            {pwError && <div className="text-xs text-red-600 mb-3">{pwError}</div>}
            {pwSuccess && <div className="text-xs text-green-600 mb-3">{pwSuccess}</div>}
            <div className="space-y-3">
              <div><label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Current Password</label><input type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} className="input-themed w-full" /></div>
              <div><label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>New Password</label><input type="password" value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} className="input-themed w-full" /></div>
              <div><label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Confirm New Password</label><input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} className="input-themed w-full" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPwOpen(false)} className="px-4 py-2 text-sm rounded border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>Cancel</button>
              {pwForm.current && pwForm.newPw && pwForm.confirm && <button disabled={pwSaving} onClick={async () => {
                setPwError(null); setPwSuccess(null);
                if (pwForm.newPw !== pwForm.confirm) { setPwError('New passwords do not match'); return; }
                if (pwForm.newPw.length < 6) { setPwError('New password must be at least 6 characters'); return; }
                setPwSaving(true);
                try {
                  const res = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.newPw }) });
                  if (!res.ok) { const d = await res.json().catch(() => ({})); setPwError(d.error || 'Failed to change password'); return; }
                  setPwOpen(false); setPwSuccess('Password changed successfully'); setTimeout(() => setPwSuccess(null), 5000);
                } catch { setPwError('Network error'); }
                finally { setPwSaving(false); }
              }} className="px-4 py-2 text-sm font-semibold rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">{pwSaving ? 'Changing...' : 'Change Password'}</button>}
            </div>
          </div>
        </div>
      )}

      {pwSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-lg shadow-xl p-6 max-w-xs w-full mx-4 text-center" style={{ background: 'var(--color-surface)' }}>
            <div className="text-green-600 text-3xl mb-2">✓</div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{pwSuccess}</p>
          </div>
        </div>
      )}

      {/* Level 1: Workspace tabs */}
      {workspaces.length > 0 && (
        <div className="flex items-end px-8 pt-1 overflow-x-auto">
          {workspaces.map((ws) => (
            <button
              key={ws.key}
              onClick={() => {
                setActiveWorkspace(ws.key);
                const firstModule = ws.modules?.[0]?.href || '/';
                const target = ws.key === 'my_workspace' ? '/my-workspace' : firstModule;
                if (pathname !== target) window.location.href = target;
              }}
              className={`px-5 py-2.5 text-[0.9rem] font-semibold border-b-[3px] transition-colors whitespace-nowrap ${activeWorkspace === ws.key ? 'text-[var(--color-accent)] border-[var(--color-accent)]' : 'border-transparent hover:text-[var(--color-text-primary)]'}`}
              style={activeWorkspace !== ws.key ? { color: 'var(--color-text-muted)' } : undefined}
            >
              {ws.label}{ws.key === 'my_workspace' && unreadCount > 0 && <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[0.65rem] font-bold bg-blue-600 text-white">{unreadCount}</span>}{ws.label === 'Management' && pendingNotifCount > 0 && <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[0.65rem] font-bold bg-amber-500 text-white">{pendingNotifCount}</span>}{ws.label === 'Management' && unreadFeedbackCount > 0 && <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[0.65rem] font-bold bg-blue-600 text-white">{unreadFeedbackCount}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Level 2: Module tabs */}
      {modules.length > 1 && (
        <div className="flex items-end px-8 overflow-x-auto scrollbar-hide" style={{ background: 'var(--color-surface-raised)', borderTop: '1px solid var(--color-border)' }}>
          {modules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className={`px-4 py-2 text-[0.82rem] font-medium no-underline transition-colors border-b-2 whitespace-nowrap ${isActive(mod.href) ? 'text-[var(--color-accent)] font-semibold border-[var(--color-accent)]' : 'border-transparent hover:text-[var(--color-text-primary)]'}`}
              style={!isActive(mod.href) ? { color: 'var(--color-text-muted)' } : undefined}
            >
              {mod.label}{mod.href === '/notifications' && pendingNotifCount > 0 && <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[0.65rem] font-bold bg-amber-500 text-white">{pendingNotifCount}</span>}{mod.href === '/management/message-center' && unreadFeedbackCount > 0 && <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[0.65rem] font-bold bg-blue-600 text-white">{unreadFeedbackCount}</span>}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
