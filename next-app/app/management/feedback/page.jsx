import { requireAuth } from '@/lib/auth/require-auth.js';
import FeedbackClient from './feedback-client.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'System Feedback - Management' };

export default async function FeedbackPage() {
  const user = await requireAuth();
  if (user.role !== 'manager') {
    const { redirect } = await import('next/navigation');
    redirect('/my-workspace');
  }
  return (
    <main>
      <div className="mx-auto px-8"><FeedbackClient /></div>
    </main>
  );
}
