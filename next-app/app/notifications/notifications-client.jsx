'use client';
// @approved-write-client
import { useState, useEffect, useCallback } from 'react';
import { useTimezone } from '@/lib/format-date.js';

export default function NotificationsClient() {
  const { fmt } = useTimezone();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [caseRequests, setCaseRequests] = useState([]);
  const [caseLoading, setCaseLoading] = useState(true);
  const [caseStatusFilter, setCaseStatusFilter] = useState('pending');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/notifications?status=${statusFilter}`);
    if (res.ok) { const d = await res.json(); setRequests(d.data || []); }
    setLoading(false);
  }, [statusFilter]);

  const fetchCaseData = useCallback(async () => {
    setCaseLoading(true);
    const res = await fetch(`/api/case-reassignment?status=${caseStatusFilter}`);
    if (res.ok) { const d = await res.json(); setCaseRequests(d.data || []); }
    setCaseLoading(false);
  }, [caseStatusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchCaseData(); }, [fetchCaseData]);

  async function handleDecision(id, decision) {
    const res = await fetch(`/api/notifications/${id}/decide`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) await fetchData();
  }

  async function handleCaseDecision(id, decision) {
    const res = await fetch(`/api/case-reassignment/${id}/decide`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) await fetchCaseData();
  }

  function badgeCls(status) {
    const base = "inline-block px-2 py-0.5 rounded text-xs font-semibold";
    if (status === 'approved') return `${base} bg-green-100 text-green-800`;
    if (status === 'denied') return `${base} bg-red-100 text-red-800`;
    return `${base} bg-amber-100 text-amber-800`;
  }

  return (
    <div className="py-8 max-w-[1200px] mx-auto space-y-10">
      {/* Parts Management Section */}
      <section>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Parts Management</h2>
        <div className="flex gap-2 flex-wrap mb-4">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-themed px-3 py-2 rounded-md text-sm">
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="all">All</option>
          </select>
        </div>
        {loading ? <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Loading...</div> : requests.length === 0 ? <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No requests</div> : (
          <div className="overflow-x-auto mb-8">
            <table className="w-full border-collapse text-sm">
              <thead><tr style={{ background: 'var(--color-surface-raised)' }}>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Part No</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Description</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Qty</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Case Number</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Vendor Claim No</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Requested By</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Justification</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Status</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Date</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Actions</th>
              </tr></thead>
              <tbody>{requests.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.part_no}</td>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.description}</td>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.qty_on_hand}</td>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.work_order_no}</td>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.vendor_claim_no}</td>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.requested_by}</td>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.requested_justification}</td>
                  <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}><span className={badgeCls(r.status)}>{r.status}</span></td>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.created_at ? fmt(r.created_at) : ''}</td>
                  <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    {r.status === 'pending' && (
                      <div className="flex gap-1">
                        <button onClick={() => handleDecision(r.id, 'approve')} className="px-3 py-1 text-xs font-semibold rounded-md bg-green-600 text-white hover:bg-green-700">Approve</button>
                        <button onClick={() => handleDecision(r.id, 'deny')} className="px-3 py-1 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-700">Deny</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {/* Case Management Section */}
      <section>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Case Management</h2>
        <div className="flex gap-2 flex-wrap mb-4">
          <select value={caseStatusFilter} onChange={(e) => setCaseStatusFilter(e.target.value)} className="input-themed px-3 py-2 rounded-md text-sm">
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="all">All</option>
          </select>
        </div>
        {caseLoading ? <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Loading...</div> : caseRequests.length === 0 ? <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No requests</div> : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead><tr style={{ background: 'var(--color-surface-raised)' }}>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Case Number</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Current Owning Team</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Requested By</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Justification</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Date</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Status</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Actions</th>
              </tr></thead>
              <tbody>{caseRequests.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.case_number}</td>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.owning_team_name || r.owning_team_id}</td>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.requested_by_name}</td>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.justification}</td>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{r.created_at ? fmt(r.created_at) : ''}</td>
                  <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}><span className={badgeCls(r.status)}>{r.status}</span></td>
                  <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    {r.status === 'pending' && (
                      <div className="flex gap-1">
                        <button onClick={() => handleCaseDecision(r.id, 'approve')} className="px-3 py-1 text-xs font-semibold rounded-md bg-green-600 text-white hover:bg-green-700">Approve</button>
                        <button onClick={() => handleCaseDecision(r.id, 'deny')} className="px-3 py-1 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-700">Deny</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
