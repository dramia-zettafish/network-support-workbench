'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AccessDeniedBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [denied, setDenied] = useState(null);

  useEffect(() => {
    const path = searchParams.get('access_denied');
    if (path) {
      setDenied(path);
      // Clean the URL without triggering a navigation
      window.history.replaceState(null, '', '/');
    }
  }, [searchParams]);

  if (!denied) return null;

  return (
    <div className="mb-6 flex items-center justify-between gap-4 px-5 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
      <div>
        <span className="font-semibold">Access denied</span> — You do not have permission to access <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">{denied}</code>. Contact your administrator if you believe this is an error.
      </div>
      <button onClick={() => setDenied(null)} className="shrink-0 text-amber-600 hover:text-amber-800 text-lg leading-none">&times;</button>
    </div>
  );
}
