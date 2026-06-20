'use client';
import { useState, useEffect, Fragment } from 'react';

export default function BulkOrdersClient() {
  const [partsCatalog, setPartsCatalog] = useState([]);
  const [lines, setLines] = useState([{ part_name: '', part_number: '', quantity: '', cost: '', unit_price: '', quote: '', sales_order: '', vendor_order_number: '', vendor: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [submitted, setSubmitted] = useState([]);
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [linkedCaseIds, setLinkedCaseIds] = useState([]);

  const allLinesFilled = lines.every(l => l.part_name.trim() && l.part_number.trim() && l.quantity.trim() && l.cost.trim() && l.unit_price.trim() && l.quote.trim() && l.sales_order.trim() && l.vendor_order_number.trim() && l.vendor.trim());

  useEffect(() => {
    fetch('/api/reference/defective-parts').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setPartsCatalog(d.data); }).catch(() => {});
    fetch('/api/bulk-orders').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setSubmitted(d.data); }).catch(() => {});
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (d?.user) setUserRole(d.user.role); }).catch(() => {});
    try { const prefill = localStorage.getItem('bulkOrderPrefill'); if (prefill) { const parsed = JSON.parse(prefill); if (Array.isArray(parsed) && parsed.length > 0) setLines(parsed); localStorage.removeItem('bulkOrderPrefill'); } const caseIds = localStorage.getItem('bulkOrderCaseIds'); if (caseIds) { const parsed = JSON.parse(caseIds); if (Array.isArray(parsed)) setLinkedCaseIds(parsed); localStorage.removeItem('bulkOrderCaseIds'); } } catch {}
  }, []);

  function updateLine(idx, field, value) {
    const upper = ['part_number', 'quote', 'sales_order', 'vendor_order_number'];
    const v = upper.includes(field) ? value.toUpperCase() : value;
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: v } : l));
  }

  function addLine() {
    setLines(prev => [...prev, { part_name: '', part_number: '', quantity: '', cost: '', unit_price: '', quote: '', sales_order: '', vendor_order_number: '', vendor: '' }]);
  }

  function removeLine(idx) {
    setLines(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }

  function copyPrevLine(idx) {
    if (idx < 1) return;
    setLines(prev => prev.map((l, i) => i === idx ? { ...prev[idx - 1] } : l));
  }

  function fillDown(field) {
    const val = lines[0][field];
    if (!val) return;
    setLines(prev => prev.map((l, i) => i === 0 ? l : { ...l, [field]: val }));
  }

  async function handleSubmit(program) {
    setSubmitting(true); setMessage(null); setProgramDialogOpen(false);
    try {
      const res = await fetch('/api/bulk-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lines, program }) });
      const data = await res.json();
      if (!res.ok) { setMessage({ type: 'error', text: data.error || 'Submit failed' }); return; }
      setMessage({ type: 'success', text: `${data.total_quantity} part(s) ordered — ${data.bulk_order_number}` });
      if (linkedCaseIds.length > 0) {
        const first = lines[0] || {};
        fetch('/api/cases/order-details/bulk-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case_ids: linkedCaseIds, bulk_order_number: data.bulk_order_number, quote_number: first.quote, vendor: first.vendor, vendor_order_number: first.vendor_order_number, po: first.sales_order }) }).catch(() => {});
        setLinkedCaseIds([]);
      }
      setLines([{ part_name: '', part_number: '', quantity: '', cost: '', unit_price: '', quote: '', sales_order: '', vendor_order_number: '', vendor: '' }]);
      const refresh = await fetch('/api/bulk-orders');
      if (refresh.ok) { const d = await refresh.json(); setSubmitted(d.data || []); }
    } catch { setMessage({ type: 'error', text: 'Network error' }); }
    finally { setSubmitting(false); }
  }

  return (
    <div>
      <form onSubmit={(e) => e.preventDefault()} className="mb-8">
        <div className="overflow-visible">
          <table className="w-full border-collapse text-sm mb-3">
            <thead>
              <tr style={{ background: 'var(--color-surface-raised)' }}>
                {['Part','Part Number','Quantity','Unit Cost (internal)','Unit Price (customer)','Quote','Purchase Order','Vendor','Vendor Order Number'].map((label, i) => {
                  const fields = ['part_name','part_number','quantity','cost','unit_price','quote','sales_order','vendor','vendor_order_number'];
                  const showFill = i >= 3 && lines.length > 1 && lines[0][fields[i]];
                  return <th key={label} className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}><span className="flex items-center gap-1">{label}{showFill && <span title="Double-click to fill all rows below" onDoubleClick={() => fillDown(fields[i])} className="cursor-pointer text-blue-500 hover:text-blue-700 select-none" style={{ fontSize: '10px' }}>⬇</span>}</span></th>;
                })}
                <th className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2 border-b relative" style={{ borderColor: 'var(--color-border)' }}>
                    <PartSearch value={line.part_name} onChange={(val) => updateLine(idx, 'part_name', val)} catalog={partsCatalog} />
                  </td>
                  <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}><input type="text" value={line.part_number} onChange={(e) => updateLine(idx, 'part_number', e.target.value)} className="input-themed w-full px-2 py-1 rounded text-sm" /></td>
                  <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}><input type="text" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} className="input-themed w-full px-2 py-1 rounded text-sm" /></td>
                  <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}><input type="text" value={line.cost} onChange={(e) => updateLine(idx, 'cost', e.target.value)} className="input-themed w-full px-2 py-1 rounded text-sm" /></td>
                  <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}><input type="text" value={line.unit_price} onChange={(e) => updateLine(idx, 'unit_price', e.target.value)} className="input-themed w-full px-2 py-1 rounded text-sm" /></td>
                  <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}><input type="text" value={line.quote} onChange={(e) => updateLine(idx, 'quote', e.target.value)} className="input-themed w-full px-2 py-1 rounded text-sm" /></td>
                  <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}><input type="text" value={line.sales_order} onChange={(e) => updateLine(idx, 'sales_order', e.target.value)} className="input-themed w-full px-2 py-1 rounded text-sm" /></td>
                  <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}><input type="text" value={line.vendor} onChange={(e) => updateLine(idx, 'vendor', e.target.value)} className="input-themed w-full px-2 py-1 rounded text-sm" /></td>
                  <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}><input type="text" value={line.vendor_order_number} onChange={(e) => updateLine(idx, 'vendor_order_number', e.target.value)} className="input-themed w-full px-2 py-1 rounded text-sm" /></td>
                  <td className="px-3 py-2 border-b whitespace-nowrap" style={{ borderColor: 'var(--color-border)' }}><button type="button" onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700 text-xs">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 justify-end">
          <button type="button" onClick={addLine} className="px-3 py-1.5 rounded text-xs font-semibold border border-slate-200 text-gray-700 hover:bg-slate-50">+ Add Line</button>
          <button type="button" onClick={() => setProgramDialogOpen(true)} disabled={submitting || !allLinesFilled} className="px-4 py-1.5 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit'}</button>
        </div>
        {message && <p className={`text-sm mt-2 ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{message.text}</p>}
      </form>

      {programDialogOpen && <ProgramDialog onClose={() => setProgramDialogOpen(false)} onSelect={(program) => handleSubmit(program)} />}

      {(() => {
        // Group all orders by bulk_order_number, then determine if entire group is complete
        const allGroups = {};
        submitted.forEach(o => { const k = o.bulk_order_number || o.id; if (!allGroups[k]) allGroups[k] = []; allGroups[k].push(o); });
        const activeGroups = Object.entries(allGroups).filter(([, items]) => items.some(o => (parseInt(o.quantity) || 0) - (o.qty_received || 0) > 0));
        const completedGroups = Object.entries(allGroups).filter(([, items]) => items.every(o => (parseInt(o.quantity) || 0) - (o.qty_received || 0) <= 0));
        return (<>
      {activeGroups.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Submitted Orders</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-raised)' }}>
                  <th className="px-3 py-2 border-b w-6" style={{ borderColor: 'var(--color-border)' }}></th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Bulk Order #</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Program</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Received/Total</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Total Unit Cost</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Total Unit Price</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Quote</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Purchase Order</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Vendor</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Vendor Order #</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Submitted By</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Date</th>
                  {userRole === 'manager' && <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {activeGroups.map(([key, items]) => {
                    const first = items[0];
                    const totalQty = items.reduce((s, o) => s + (parseFloat(o.quantity) || 0), 0);
                    const totalReceived = items.reduce((s, o) => s + (o.qty_received || 0), 0);
                    const totalCost = items.reduce((s, o) => s + (parseFloat(o.cost) || 0) * (parseInt(o.quantity) || 1), 0);
                    const totalPrice = items.reduce((s, o) => s + (parseFloat(o.unit_price) || 0) * (parseInt(o.quantity) || 1), 0);
                    const expanded = expandedOrders.has(key);
                    return (
                      <Fragment key={key}>
                        <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setExpandedOrders(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; })}>
                          <td className="px-3 py-2 border-b text-center" style={{ borderColor: 'var(--color-border)' }}>{expanded ? '▼' : '▶'}</td>
                          <td className="px-3 py-2 border-b font-mono text-xs font-semibold" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.bulk_order_number || '-'}</td>
                          <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.program || '-'}</td>
                          <td className="px-3 py-2 border-b font-semibold" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{totalReceived}/{totalQty}</td>
                          <td className="px-3 py-2 border-b font-semibold" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{totalCost ? totalCost.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}</td>
                          <td className="px-3 py-2 border-b font-semibold" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{totalPrice ? totalPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}</td>
                          <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.quote || '-'}</td>
                          <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.sales_order || '-'}</td>
                          <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.vendor || '-'}</td>
                          <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.vendor_order_number || '-'}</td>
                          <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.submitted_by || '-'}</td>
                          <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.created_at ? new Date(first.created_at).toLocaleDateString() : '-'}</td>
                          {userRole === 'manager' && <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}></td>}
                        </tr>
                        {expanded && items.map(o => (
                          <tr key={o.id} style={{ background: 'var(--color-surface-raised)' }}>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                            <td className="px-3 py-1.5 border-b text-xs" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>{o.part_name || '-'}</td>
                            <td className="px-3 py-1.5 border-b text-xs" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>{o.part_number || '-'}</td>
                            <td className="px-3 py-1.5 border-b text-xs" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>{o.qty_received || 0}/{o.quantity || 0}</td>
                            <td className="px-3 py-1.5 border-b text-xs" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>{o.cost ? parseFloat(o.cost).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}</td>
                            <td className="px-3 py-1.5 border-b text-xs" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>{o.unit_price ? parseFloat(o.unit_price).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}</td>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                            {userRole === 'manager' && <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}><button onClick={(e) => { e.stopPropagation(); setDeleteId(o.id); }} disabled={o.qty_received > 0} className="px-2 py-0.5 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">Delete</button></td>}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteId(null)}>
          <div className="rounded-lg shadow-xl p-6 w-full max-w-sm" style={{ background: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Confirm Delete</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Are you sure you want to delete this order?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-1.5 text-sm rounded border border-slate-200 text-gray-700 hover:bg-slate-50">Cancel</button>
              <button onClick={async () => { const res = await fetch('/api/bulk-orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteId }) }); if (res.ok) { setSubmitted(prev => prev.filter(o => o.id !== deleteId)); } setDeleteId(null); }} className="px-4 py-1.5 text-sm font-semibold rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {completedGroups.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Completed Orders</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-raised)' }}>
                  <th className="px-3 py-2 border-b w-6" style={{ borderColor: 'var(--color-border)' }}></th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Bulk Order #</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Program</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Total Qty</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Total Unit Cost</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Total Unit Price</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Quote</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Purchase Order</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Vendor</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Vendor Order #</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Submitted By</th>
                  <th className="font-semibold text-left px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {completedGroups.map(([key, items]) => {
                    const first = items[0];
                    const totalQty = items.reduce((s, o) => s + (parseFloat(o.quantity) || 0), 0);
                    const totalCost = items.reduce((s, o) => s + (parseFloat(o.cost) || 0) * (parseInt(o.quantity) || 1), 0);
                    const totalPrice = items.reduce((s, o) => s + (parseFloat(o.unit_price) || 0) * (parseInt(o.quantity) || 1), 0);
                    const expanded = expandedOrders.has('c_' + key);
                    return (
                      <Fragment key={key}>
                        <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setExpandedOrders(prev => { const next = new Set(prev); const k = 'c_' + key; if (next.has(k)) next.delete(k); else next.add(k); return next; })}>
                          <td className="px-3 py-2 border-b text-center" style={{ borderColor: 'var(--color-border)' }}>{expanded ? '▼' : '▶'}</td>
                          <td className="px-3 py-2 border-b font-mono text-xs font-semibold" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.bulk_order_number || '-'}</td>
                          <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.program || '-'}</td>
                          <td className="px-3 py-2 border-b font-semibold" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{totalQty}</td>
                          <td className="px-3 py-2 border-b font-semibold" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{totalCost ? totalCost.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}</td>
                          <td className="px-3 py-2 border-b font-semibold" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{totalPrice ? totalPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}</td>
                          <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.quote || '-'}</td>
                          <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.sales_order || '-'}</td>
                          <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.vendor || '-'}</td>
                          <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.vendor_order_number || '-'}</td>
                          <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.submitted_by || '-'}</td>
                          <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{first.created_at ? new Date(first.created_at).toLocaleDateString() : '-'}</td>
                        </tr>
                        {expanded && items.map(o => (
                          <tr key={o.id} style={{ background: 'var(--color-surface-raised)' }}>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                            <td className="px-3 py-1.5 border-b text-xs" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>{o.part_name || '-'}</td>
                            <td className="px-3 py-1.5 border-b text-xs" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>{o.part_number || '-'}</td>
                            <td className="px-3 py-1.5 border-b text-xs" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>{o.qty_received || 0}/{o.quantity || 0}</td>
                            <td className="px-3 py-1.5 border-b text-xs" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>{o.cost ? parseFloat(o.cost).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}</td>
                            <td className="px-3 py-1.5 border-b text-xs" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>{o.unit_price ? parseFloat(o.unit_price).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}</td>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                            <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--color-border)' }}></td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteId(null)}>
          <div className="rounded-lg shadow-xl p-6 w-full max-w-sm" style={{ background: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Confirm Delete</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Are you sure you want to delete this order?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-1.5 text-sm rounded border border-slate-200 text-gray-700 hover:bg-slate-50">Cancel</button>
              <button onClick={async () => { const res = await fetch('/api/bulk-orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteId }) }); if (res.ok) { setSubmitted(prev => prev.filter(o => o.id !== deleteId)); } setDeleteId(null); }} className="px-4 py-1.5 text-sm font-semibold rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
      </>);
      })()}
    </div>
  );
}

function PartSearch({ value, onChange, catalog }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value);
  const filtered = input ? catalog.filter(p => p.name.toLowerCase().includes(input.toLowerCase())) : catalog;
  const isValid = catalog.some(p => p.name === value);

  useEffect(() => { setInput(value); }, [value]);

  return (
    <div className="relative">
      <input type="text" value={input} onChange={(e) => { setInput(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => { setOpen(false); if (!catalog.some(p => p.name === input)) setInput(value); }, 150)} placeholder="Search part..." className="input-themed w-full px-2 py-1 rounded text-sm" style={!isValid && value ? { borderColor: 'red' } : {}} />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto border rounded shadow-lg text-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          {filtered.slice(0, 10).map(p => (
            <li key={p.id} onMouseDown={() => { onChange(p.name); setInput(p.name); setOpen(false); }} className="px-2 py-1 cursor-pointer hover:bg-blue-100" style={{ color: 'var(--color-text-primary)' }}>{p.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProgramDialog({ onClose, onSelect }) {
  const [program, setProgram] = useState('');
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    fetch('/api/admin/programs').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.data) setPrograms(d.data.filter(p => p.is_active));
    }).catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="rounded-lg shadow-xl p-6 w-full max-w-sm" style={{ background: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Select Program</h3>
        <select value={program} onChange={(e) => setProgram(e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm mb-4">
          <option value="">Select program...</option>
          {programs.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm rounded border border-slate-200 text-gray-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={() => onSelect(program)} disabled={!program} className="px-4 py-1.5 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">Submit</button>
        </div>
      </div>
    </div>
  );
}
