import { Suspense } from 'react';
import AccessDeniedBanner from './components/access-denied-banner.jsx';
import DashboardModules from './components/dashboard-modules.jsx';

export default function Home() {
  return (
    <main>
      <div className="max-w-[1200px] mx-auto p-8">
        <Suspense fallback={null}>
          <AccessDeniedBanner />
        </Suspense>
        <div className="rounded-lg p-8" style={{ background: 'var(--color-surface)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Operations Dashboard</h2>
            <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Modules available for your current workspace.
            </p>
          </div>

          <DashboardModules />
        </div>
      </div>
    </main>
  );
}
