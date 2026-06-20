'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const returnTo = searchParams.get('from') || '/my-workspace';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        localStorage.removeItem('eus_workspace');
        window.location.href = returnTo;
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Unable to connect to authentication service');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label htmlFor="username" className="block mb-1 font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          autoFocus
          className="w-full p-2 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          style={{ background: 'var(--color-input-bg)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-input-border)', color: 'var(--color-text-primary)' }}
        />
      </div>
      <div className="mb-4">
        <label htmlFor="password" className="block mb-1 font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full p-2 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          style={{ background: 'var(--color-input-bg)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-input-border)', color: 'var(--color-text-primary)' }}
        />
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded font-semibold hover:opacity-90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        style={{ background: 'var(--color-accent)', color: '#ffffff' }}
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex justify-center items-center min-h-[60vh]">
      <div className="w-full max-w-[360px] p-8">
        <h1 className="mb-6 text-center text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>EU Support Login</h1>
        <Suspense fallback={<div>Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
