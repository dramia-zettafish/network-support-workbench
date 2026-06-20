import { requireAuth } from '@/lib/auth/require-auth.js';
import { getAllowedModules } from '@/lib/auth/allowed-modules.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Protected Dashboard — EU Support', description: 'Authenticated user dashboard' };

export default async function ProtectedDashboardPage() {
  const user = await requireAuth();
  const modules = await getAllowedModules();

  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="bg-white border border-slate-200 rounded-lg p-8">
          <div className="flex items-center gap-3 px-6 py-4 bg-green-50 border border-green-200 rounded-md text-green-800 font-medium">
            <span className="text-xl">🔒</span>
            <span>Authenticated as <strong>{user.username}</strong></span>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-200">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Current User</h2>
            <ul className="list-none p-0">
              <li className="py-2 text-sm text-gray-500">Username: <code className="bg-gray-100 px-2 py-0.5 rounded text-gray-800 text-xs">{user.username}</code></li>
              <li className="py-2 text-sm text-gray-500">Email: <code className="bg-gray-100 px-2 py-0.5 rounded text-gray-800 text-xs">{user.email}</code></li>
              <li className="py-2 text-sm text-gray-500">Role: <code className="bg-gray-100 px-2 py-0.5 rounded text-gray-800 text-xs">{user.role}</code></li>
              <li className="py-2 text-sm text-gray-500">Teams: <code className="bg-gray-100 px-2 py-0.5 rounded text-gray-800 text-xs">{(user.teams || []).join(', ')}</code></li>
            </ul>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-200">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Allowed Modules</h2>
            <ul className="list-none p-0">
              {modules.map((mod) => (<li key={mod} className="py-2 text-sm text-gray-500"><code className="bg-gray-100 px-2 py-0.5 rounded text-gray-800 text-xs">{mod}</code></li>))}
            </ul>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-200">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Auth Boundary Status</h2>
            <ul className="list-none p-0">
              <li className="py-2 text-sm text-gray-500">Provider: <code className="bg-gray-100 px-2 py-0.5 rounded text-gray-800 text-xs">{process.env.AUTH_PROVIDER || 'mock'}</code></li>
              <li className="py-2 text-sm text-gray-500">Auth type: Placeholder/mock — no real credentials validated</li>
              <li className="py-2 text-sm text-gray-500">Future provider: Cisco Duo MFA (not yet integrated)</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
