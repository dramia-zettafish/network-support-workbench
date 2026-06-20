'use client';
import { useState, useEffect } from 'react';

export default function ProgramTrackingClient() {
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/programs').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.data) setPrograms(d.data.filter(p => p.is_active));
    });
  }, []);

  useEffect(() => {
    if (!selectedProgram) { setCases([]); return; }
    setLoading(true);
    fetch(`/api/program-tracking?program=${encodeURIComponent(selectedProgram)}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.data) setCases(d.data);
    }).finally(() => setLoading(false));
  }, [selectedProgram]);

  const grouped = {};
  cases.forEach(row => {
    if (!grouped[row.id]) grouped[row.id] = { ...row, orders: [], serviceFees: [] };
    if (row.entry_type === 'service_fee') grouped[row.id].serviceFees.push(row);
    else if (row.bulk_order_number || row.quote_number) grouped[row.id].orders.push(row);
  });
  const caseList = Object.values(grouped);

  return (
    <div className="py-8 mx-auto max-w-full px-4">
      <div className="mb-4">
        <select value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)} className="input-themed px-3 py-2 rounded text-sm">
          <option value="">Select Program...</option>
          {programs.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      {selectedProgram && caseList.length > 0 && (() => {
        const actualPartPrice = caseList.reduce((sum, c) => sum + c.orders.reduce((s, o) => s + (parseFloat(o.unit_price) || 0), 0), 0);
        const totalCases = caseList.length;
        const programFee = parseFloat(programs.find(p => p.name === selectedProgram)?.standard_service_fee) || 0;
        const projectedServiceFee = totalCases * programFee;
        const actualServiceFee = caseList.reduce((sum, c) => sum + c.serviceFees.reduce((s, f) => s + (parseFloat(f.service_fee) || 0), 0), 0);
        return (
          <div className="mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>Financials</h2>
            <div className="grid grid-cols-2 gap-4 max-w-lg">
              <div className="rounded-lg p-4 border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>Part Price</div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-muted)' }}>Projected</span>
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>TBD</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span style={{ color: 'var(--color-text-muted)' }}>Actual</span>
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{actualPartPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                </div>
              </div>
              <div className="rounded-lg p-4 border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>Service Fee</div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-muted)' }}>Projected</span>
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{projectedServiceFee.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span style={{ color: 'var(--color-text-muted)' }}>Actual</span>
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{actualServiceFee.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {loading && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>}
      {!loading && selectedProgram && caseList.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No cases found for this program.</p>}
      {!loading && caseList.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ background: 'var(--color-surface-raised)' }}>
                <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Case #</th>
                <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Customer</th>
                <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Stage</th>
                <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Quote #</th>
                <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>PO</th>
                <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Vendor</th>
                <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Unit Price</th>
                <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Service Fee</th>
              </tr>
            </thead>
            <tbody>
              {caseList.map(c => (
                <tr key={c.id}>
                  <td className="px-3 py-2 border-b font-mono text-xs" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.case_number}</td>
                  <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.customer_name || '-'}</td>
                  <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.stage}</td>
                  <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.orders[0]?.quote_number || '-'}</td>
                  <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.orders[0]?.po || '-'}</td>
                  <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.orders[0]?.vendor || '-'}</td>
                  <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.orders[0]?.unit_price ? parseFloat(c.orders[0].unit_price).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}</td>
                  <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.serviceFees[0]?.service_fee ? parseFloat(c.serviceFees[0].service_fee).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
