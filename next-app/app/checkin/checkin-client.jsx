'use client';
// @approved-write-client
import { useState, useEffect } from 'react';
import { useTimezone } from '@/lib/format-date.js';

export default function CheckInClient() {
  const { timezone } = useTimezone();
  const [partNo, setPartNo] = useState('');
  const [workOrderNo, setWorkOrderNo] = useState('');
  const [vendorClaimNo, setVendorClaimNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [success, setSuccess] = useState(false);
  const [writesEnabled, setWritesEnabled] = useState(false);
  const [showAddPart, setShowAddPart] = useState(false);
  const [partNotFound, setPartNotFound] = useState(false);
  const [addPartForm, setAddPartForm] = useState({ part_no: '', description: '', qty_on_hand: '', location_rack: '', location_shelf: '', justification: '', inventory_pool: '' });
  const [partsCatalog, setPartsCatalog] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [descOpen, setDescOpen] = useState(false);
  const [checkinLog, setCheckinLog] = useState([]);
  const [locationPrompt, setLocationPrompt] = useState(null); // { part_no }
  const [locationInput, setLocationInput] = useState({ rack: '', shelf: '' });

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('checkinLog') || '{}');
      if (stored.date === new Date().toDateString()) setCheckinLog(stored.entries || []);
    } catch { /* ignore */ }
  }, []);

  function saveLog(entries) {
    setCheckinLog(entries);
    localStorage.setItem('checkinLog', JSON.stringify({ date: new Date().toDateString(), entries }));
  }

  useEffect(() => {
    fetch('/api/write-safety/status').then((r) => r.json()).then((d) => setWritesEnabled(d.writesEnabled)).catch(() => {});
    fetch('/api/reference/defective-parts').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setPartsCatalog(d.data); }).catch(() => {});
    fetch('/api/admin/programs').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setPrograms(d.data.filter(p => p.is_active)); }).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!writesEnabled) { setMessage('Write operations are disabled'); return; }
    if (!partNo.trim() || !workOrderNo.trim() || !vendorClaimNo.trim()) {
      setMessage('All fields are required');
      return;
    }
    setLoading(true); setMessage(null); setSuccess(false); setPartNotFound(false);
    const res = await fetch('/api/checkin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ part_no: partNo, work_order_no: workOrderNo, vendor_claim_no: vendorClaimNo }),
    });
    const d = await res.json();
    if (res.ok) {
      let location = '';
      try {
        const stockRes = await fetch(`/api/stock?search=${encodeURIComponent(partNo.trim())}`);
        if (stockRes.ok) {
          const stockData = await stockRes.json();
          const match = (stockData.data || []).find((s) => s.part_no === partNo.trim().toUpperCase());
          if (match) location = match.location || '';
        }
      } catch { /* ignore */ }
      saveLog([...checkinLog, {
        time: new Date().toLocaleTimeString([], { timeZone: timezone }),
        part_no: partNo,
        work_order_no: workOrderNo,
        vendor_claim_no: vendorClaimNo,
        location,
      }]);
      setSuccess(true); setMessage('Part checked in successfully');
      if (!location) {
        setLocationPrompt({ part_no: partNo.trim().toUpperCase() });
        setLocationInput({ rack: '', shelf: '' });
      }
      setPartNo(''); setWorkOrderNo(''); setVendorClaimNo('');
    } else {
      if (d.code === 'PART_NOT_FOUND') {
        setPartNotFound(true);
        setAddPartForm({ ...addPartForm, part_no: partNo.trim().toUpperCase() });
      }
      setMessage(d.error || 'Check in failed');
    }
    setLoading(false);
  }

  async function submitAddPart(e) {
    e.preventDefault();
    const res = await fetch('/api/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        part_no: addPartForm.part_no,
        description: addPartForm.description,
        qty_on_hand: addPartForm.qty_on_hand,
        location: `Parts Rack:${addPartForm.location_rack.trim()} Shelf:${addPartForm.location_shelf.trim()}`,
        justification: addPartForm.justification,
        inventory_pool: addPartForm.inventory_pool,
        work_order_no: workOrderNo,
        vendor_claim_no: vendorClaimNo,
      }),
    });
    if (res.ok) {
      setShowAddPart(false);
      setPartNotFound(false);
      setSuccess(true);
      setMessage('Add Part request submitted for approval');
      setAddPartForm({ part_no: '', description: '', qty_on_hand: '', location_rack: '', location_shelf: '', justification: '', inventory_pool: '' });
    } else {
      const d = await res.json();
      setMessage(d.error || 'Failed to submit request');
    }
  }

  function printLog() {
    const win = window.open('', '_blank');
    const grouped = {};
    for (const entry of checkinLog) {
      const key = entry.part_no.toUpperCase();
      if (!grouped[key]) grouped[key] = { ...entry, count: 0, wos: new Set(), vcs: new Set() };
      grouped[key].count++;
      grouped[key].wos.add(entry.work_order_no);
      grouped[key].vcs.add(entry.vendor_claim_no);
    }
    const rows = Object.values(grouped).map((e) =>
      `<tr><td>${e.time}</td><td>${e.part_no}</td><td>${e.count}</td><td>${e.location || '-'}</td><td>${e.wos.size > 1 ? 'multiple' : e.work_order_no}</td><td>${e.vcs.size > 1 ? 'multiple' : e.vendor_claim_no}</td></tr>`
    ).join('');
    win.document.write(`<html><head><title>Check In Log</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}th{background:#f0f0f0}</style></head><body><h2>Check In Log</h2><table><thead><tr><th>Time</th><th>Part No</th><th>Qty</th><th>Part Location</th><th>Case Number</th><th>Vendor Claim No</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
  }

  function clearLog() { setCheckinLog([]); localStorage.removeItem('checkinLog'); }

  const inputCls = "input-themed w-full max-w-[400px] px-3 py-2 rounded-md text-sm";

  return (
    <div className="py-8 max-w-[1200px] mx-auto">
      {message && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-lg text-sm font-medium z-[1000] shadow-lg ${success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}
      <div className="px-4 py-3 mb-6 rounded-lg" style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5a8e)', color: '#fff' }}>
        <h2 className="text-lg font-bold">Dynamics Integration</h2>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block font-semibold mb-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>Part Number</label>
          <input value={partNo} onChange={(e) => setPartNo(e.target.value)} required className={inputCls} />
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>Case Number</label>
          <input value={workOrderNo} onChange={(e) => setWorkOrderNo(e.target.value)} required className={inputCls} />
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>Vendor Claim No</label>
          <input value={vendorClaimNo} onChange={(e) => setVendorClaimNo(e.target.value)} required className={inputCls} />
        </div>
        <div className="flex gap-2 items-center">
          <button type="submit" disabled={loading} className="px-5 py-2 rounded-md text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Processing...' : 'Check In'}
          </button>
          {partNotFound && !showAddPart && (
            <button type="button" onClick={() => setShowAddPart(true)} className="px-5 py-2 rounded-md text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700">Add Part</button>
          )}
        </div>
      </form>

      {showAddPart && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[2000]">
          <form onSubmit={submitAddPart} className="rounded-xl p-6 w-full max-w-[420px] shadow-xl" style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}>
            <h3 className="text-lg font-semibold mb-4">Request New Part</h3>
            <div className="grid gap-2">
              <input placeholder="Part No" value={addPartForm.part_no} onChange={(e) => setAddPartForm({ ...addPartForm, part_no: e.target.value })} required className="input-themed p-2 rounded text-sm" />
              <div className="relative">
                <input placeholder="Description" value={addPartForm.description} onChange={(e) => { setAddPartForm({ ...addPartForm, description: e.target.value }); setDescOpen(true); }} onFocus={() => setDescOpen(true)} onBlur={() => setTimeout(() => { setDescOpen(false); if (addPartForm.description && !partsCatalog.some(c => c.name === addPartForm.description)) setAddPartForm(p => ({ ...p, description: '' })); }, 150)} autoComplete="off" className="input-themed p-2 rounded text-sm w-full" />
                {descOpen && addPartForm.description.length >= 1 && (() => { const matches = partsCatalog.filter(c => c.name.toLowerCase().includes(addPartForm.description.toLowerCase())).slice(0, 8); if (!matches.length) return null; return (<ul className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto rounded shadow-lg text-sm border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>{matches.map(c => <li key={c.id} className="px-2 py-1.5 cursor-pointer hover:opacity-80" style={{ color: 'var(--color-text-primary)' }} onMouseDown={() => { setAddPartForm({ ...addPartForm, description: c.name }); setDescOpen(false); }}>{c.name}</li>)}</ul>); })()}
              </div>
              <input placeholder="Qty on Hand" type="number" value={addPartForm.qty_on_hand} onChange={(e) => setAddPartForm({ ...addPartForm, qty_on_hand: e.target.value })} className="input-themed p-2 rounded text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Rack" value={addPartForm.location_rack} onChange={(e) => setAddPartForm({ ...addPartForm, location_rack: e.target.value })} className="input-themed p-2 rounded text-sm" />
                <input placeholder="Shelf" value={addPartForm.location_shelf} onChange={(e) => setAddPartForm({ ...addPartForm, location_shelf: e.target.value })} className="input-themed p-2 rounded text-sm" />
              </div>
              <select value={addPartForm.inventory_pool} onChange={(e) => setAddPartForm({ ...addPartForm, inventory_pool: e.target.value })} className="input-themed p-2 rounded text-sm">
                <option value="">Select Inventory Pool</option>
                {programs.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              <textarea placeholder="Reason for adding this part" value={addPartForm.justification} onChange={(e) => setAddPartForm({ ...addPartForm, justification: e.target.value })} rows={3} className="input-themed p-2 rounded text-sm resize-y" />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={!addPartForm.part_no || !addPartForm.description || !addPartForm.qty_on_hand || !addPartForm.location_rack || !addPartForm.location_shelf || !addPartForm.inventory_pool || !addPartForm.justification} className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">Submit Request</button>
              <button type="button" onClick={() => setShowAddPart(false)} className="px-4 py-2 text-sm font-semibold bg-gray-500 text-white rounded-md hover:bg-gray-600">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {locationPrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[2000]">
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!locationInput.rack.trim() || !locationInput.shelf.trim()) return;
            const formatted = `Parts Rack:${locationInput.rack.trim()} Shelf:${locationInput.shelf.trim()}`;
            await fetch('/api/checkin/set-location', {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ part_no: locationPrompt.part_no, location: formatted }),
            });
            setCheckinLog(prev => prev.map(entry =>
              entry.part_no.toUpperCase() === locationPrompt.part_no ? { ...entry, location: formatted } : entry
            ));
            saveLog(checkinLog.map(entry =>
              entry.part_no.toUpperCase() === locationPrompt.part_no ? { ...entry, location: formatted } : entry
            ));
            setLocationPrompt(null);
          }} className="rounded-xl p-6 w-full max-w-[420px] shadow-xl" style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}>
            <h3 className="text-lg font-semibold mb-2">Set Part Location</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              <strong>{locationPrompt.part_no}</strong> does not have an inventory location. Enter the location where this part is stored.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Rack</label>
                <input autoFocus value={locationInput.rack} onChange={(e) => setLocationInput(p => ({ ...p, rack: e.target.value }))} required className="input-themed w-full p-2 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Shelf</label>
                <input value={locationInput.shelf} onChange={(e) => setLocationInput(p => ({ ...p, shelf: e.target.value }))} required className="input-themed w-full p-2 rounded text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={!locationInput.rack.trim() || !locationInput.shelf.trim()} className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Save Location</button>
              <button type="button" onClick={() => setLocationPrompt(null)} className="px-4 py-2 text-sm font-semibold bg-gray-500 text-white rounded-md hover:bg-gray-600">Skip</button>
            </div>
          </form>
        </div>
      )}

      {/* Check In Log */}
      {checkinLog.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-3 mt-6">
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Check In Log</h3>
            <button onClick={printLog} className="px-3 py-1 text-xs font-semibold rounded border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>🖨️ Print</button>
            <button onClick={clearLog} className="px-3 py-1 text-xs font-semibold rounded border border-red-300 text-red-600 hover:bg-red-50">Clear</button>
          </div>
          <div className="overflow-x-auto mb-8">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-raised)' }}>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Time</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Part No</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Qty</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Part Location</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Case Number</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Vendor Claim No</th>
                </tr>
              </thead>
              <tbody>
                <LogRows entries={checkinLog} />
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* EU Support Integration */}
      <BulkOrdersSection />
    </div>
  );
}

function LogRows({ entries }) {
  const [expanded, setExpanded] = useState({});
  const grouped = {};
  for (const entry of entries) {
    const key = entry.part_no.toUpperCase();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }

  const rows = [];
  for (const [partNo, items] of Object.entries(grouped)) {
    if (items.length === 1) {
      const e = items[0];
      rows.push(
        <tr key={partNo}>
          <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.time}</td>
          <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.part_no}</td>
          <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>1</td>
          <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.location || '-'}</td>
          <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.work_order_no}</td>
          <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.vendor_claim_no}</td>
        </tr>
      );
    } else {
      const isOpen = !!expanded[partNo];
      rows.push(
        <tr key={partNo} className="cursor-pointer" style={{ background: 'var(--color-surface-raised)' }} onClick={() => setExpanded((p) => ({ ...p, [partNo]: !p[partNo] }))}>
          <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{isOpen ? '▾' : '▸'}</td>
          <td className="px-4 py-3 border-b font-bold" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{partNo} ({items.length})</td>
          <td className="px-4 py-3 border-b font-bold" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{items.length}</td>
          <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{items[0].location || '-'}</td>
          <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }} colSpan={2}></td>
        </tr>
      );
      if (isOpen) {
        for (let i = 0; i < items.length; i++) {
          const e = items[i];
          rows.push(
            <tr key={`${partNo}-${i}`}>
              <td className="px-4 py-3 border-b pl-6" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.time}</td>
              <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.part_no}</td>
              <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>1</td>
              <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.location || '-'}</td>
              <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.work_order_no}</td>
              <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.vendor_claim_no}</td>
            </tr>
          );
        }
      }
    }
  }
  return <>{rows}</>;
}

function BulkOrdersSection() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState({});
  const [counts, setCounts] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [bulkLog, setBulkLog] = useState([]);
  const [bulkLocationPrompt, setBulkLocationPrompt] = useState(null);
  const [bulkLocationInput, setBulkLocationInput] = useState({ rack: '', shelf: '' });
  const [bulkError, setBulkError] = useState(null);
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch('/api/bulk-orders').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setOrders(d.data); }).catch(() => {}).finally(() => setLoading(false));
    try {
      const stored = JSON.parse(localStorage.getItem('bulkCheckinLog') || '{}');
      if (stored.date === new Date().toDateString()) setBulkLog(stored.entries || []);
    } catch { /* ignore */ }
  }, []);

  function saveBulkLog(entries) {
    setBulkLog(entries);
    localStorage.setItem('bulkCheckinLog', JSON.stringify({ date: new Date().toDateString(), entries }));
  }

  if (loading) return null;
  if (!orders.length && !bulkLog.length) return null;
  const pendingOrders = orders.filter(o => (parseInt(o.quantity) || 0) - (o.qty_received || 0) > 0);
  const sortedOrders = [...pendingOrders].sort((a, b) => {
    if (!sortCol) return 0;
    let av = a[sortCol] || '', bv = b[sortCol] || '';
    if (sortCol === 'qty_remaining') { av = (parseInt(a.quantity) || 0) - (a.qty_received || 0); bv = (parseInt(b.quantity) || 0) - (b.qty_received || 0); }
    else if (sortCol === 'quantity' || sortCol === 'qty_received') { av = parseInt(av) || 0; bv = parseInt(bv) || 0; }
    else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const anyChecked = Object.values(checked).some(Boolean);
  const allValid = anyChecked && Object.entries(checked).filter(([,v]) => v).every(([id]) => {
    const o = orders.find(x => x.id === id);
    const remaining = (parseInt(o?.quantity) || 0) - (o?.qty_received || 0);
    if (remaining > 1) return parseInt(counts[id]) > 0;
    return true;
  });

  async function handleCheckin() {
    setSubmitting(true);
    const items = Object.entries(checked).filter(([,v]) => v).map(([id]) => {
      const o = orders.find(x => x.id === id);
      const remaining = (parseInt(o?.quantity) || 0) - (o?.qty_received || 0);
      return { id, part_number: o.part_number, part_name: o.part_name, program: o.program, count: remaining > 1 ? (parseInt(counts[id]) || 0) : remaining };
    });
    try {
      const res = await fetch('/api/checkin/bulk-inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
      if (res.ok) {
        const newEntries = await Promise.all(items.map(async (item) => {
          const o = orders.find(x => x.id === item.id);
          let location = '';
          try {
            const stockRes = await fetch(`/api/stock?search=${encodeURIComponent(item.part_number)}`);
            if (stockRes.ok) { const sd = await stockRes.json(); const match = (sd.data || []).find(s => s.part_no === item.part_number.toUpperCase()); if (match) location = match.location || ''; }
          } catch { /* ignore */ }
          return { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), part_name: o?.part_name || '-', part_number: item.part_number, qty: item.count, location };
        }));
        saveBulkLog([...bulkLog, ...newEntries]);
        const noLocation = newEntries.filter(e => !e.location);
        if (noLocation.length > 0) {
          setBulkLocationPrompt(noLocation.map(e => ({ part_no: e.part_number.toUpperCase(), part_name: e.part_name })));
          setBulkLocationInput({ rack: '', shelf: '' });
        }
        setChecked({}); setCounts({}); setBulkError(null); const r = await fetch('/api/bulk-orders'); if (r.ok) { const d = await r.json(); setOrders(d.data || []); }
      } else {
        const errData = await res.json().catch(() => null);
        setBulkError(errData?.error || 'Check in failed');
      }
    } catch { setBulkError('Network error — check in failed'); }
    finally { setSubmitting(false); }
  }

  function printBulkLog() {
    const win = window.open('', '_blank');
    const rows = bulkLog.map(e => `<tr><td>${e.time}</td><td>${e.part_name}</td><td>${e.part_number}</td><td>${e.qty}</td><td>${e.location || '-'}</td></tr>`).join('');
    win.document.write(`<html><head><title>EU Support Check In Log</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}th{background:#f0f0f0}</style></head><body><h2>EU Support Integration - Check In Log</h2><table><thead><tr><th>Time</th><th>Part</th><th>Part Number</th><th>Qty</th><th>Part Location</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
  }

  function clearBulkLog() { setBulkLog([]); localStorage.removeItem('bulkCheckinLog'); }

  function toggleSort(col) { if (sortCol === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setSortCol(col); setSortDir('asc'); } }
  function sortIcon(col) { if (sortCol !== col) return ''; return sortDir === 'asc' ? ' ▲' : ' ▼'; }
  return (
    <div className="mt-8">
      <div className="px-4 py-3 mb-6 rounded-lg" style={{ background: 'linear-gradient(135deg, #1e5a3a, #2d8e5a)', color: '#fff' }}>
        <h2 className="text-lg font-bold">EU Support Integration</h2>
      </div>
      <div className="mb-3"><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search part number or vendor order #..." className="input-themed w-full max-w-[400px] px-3 py-2 rounded-md text-sm" /></div>
      {anyChecked && <div className="mb-3 flex items-center justify-end gap-3">{bulkError && <span className="text-red-500 text-xs">{bulkError}</span>}<button onClick={handleCheckin} disabled={!allValid || submitting} className="px-4 py-1.5 rounded text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">{submitting ? 'Processing...' : 'Check In'}</button></div>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)' }}>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('part_name')}>Part{sortIcon('part_name')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('part_number')}>Part Number{sortIcon('part_number')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('quantity')}>Qty Ordered{sortIcon('quantity')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('qty_received')}>Qty Received{sortIcon('qty_received')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('qty_remaining')}>Qty Remaining{sortIcon('qty_remaining')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('vendor')}>Vendor{sortIcon('vendor')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('vendor_order_number')}>Vendor Order #{sortIcon('vendor_order_number')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('submitted_by')}>Ordered By{sortIcon('submitted_by')}</th>
              <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('created_at')}>Date{sortIcon('created_at')}</th>
              <th className="px-4 py-3 border-b-2 text-center whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}><span className="block text-xs font-semibold mb-1">Check In</span><input type="checkbox" checked={pendingOrders.length > 0 && pendingOrders.every(o => checked[o.id])} onChange={(e) => { const next = {}; if (e.target.checked) pendingOrders.forEach(o => { next[o.id] = true; }); setChecked(next); }} /></th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.filter(o => !searchTerm.trim() || (o.part_number || '').toLowerCase().includes(searchTerm.toLowerCase()) || (o.vendor_order_number || '').toLowerCase().includes(searchTerm.toLowerCase())).map(o => {
              const qtyOrdered = parseInt(o.quantity) || 0;
              const qtyReceived = o.qty_received || 0;
              const qty = qtyOrdered - qtyReceived;
              const isChecked = !!checked[o.id];
              return (
              <tr key={o.id}>
                <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{o.part_name || '-'}</td>
                <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{o.part_number || '-'}</td>
                <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{o.quantity || '-'}</td>
                <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{o.qty_received || 0}</td>
                <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{(parseInt(o.quantity) || 0) - (o.qty_received || 0)}</td>
                <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{o.vendor || '-'}</td>
                <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{o.vendor_order_number || '-'}</td>
                <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{o.submitted_by || '-'}</td>
                <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-center gap-2">
                    <input type="checkbox" checked={isChecked} onChange={(e) => setChecked(prev => ({ ...prev, [o.id]: e.target.checked }))} />
                    {isChecked && qty > 1 && <input type="number" min="1" max={qty} value={counts[o.id] || ''} onChange={(e) => { const v = Math.min(Math.max(parseInt(e.target.value) || 0, 0), qty); setCounts(prev => ({ ...prev, [o.id]: v || e.target.value })); }} onBlur={(e) => { const v = parseInt(e.target.value) || 0; if (v > qty) setCounts(prev => ({ ...prev, [o.id]: String(qty) })); if (v < 1 && e.target.value !== '') setCounts(prev => ({ ...prev, [o.id]: '1' })); }} className="input-themed w-16 px-1 py-0.5 rounded text-xs" placeholder="Count" />}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {bulkLog.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-3 mt-6">
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Check In Log</h3>
            <button onClick={printBulkLog} className="px-3 py-1 text-xs font-semibold rounded border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>🖨️ Print</button>
            <button onClick={clearBulkLog} className="px-3 py-1 text-xs font-semibold rounded border border-red-300 text-red-600 hover:bg-red-50">Clear</button>
          </div>
          <div className="overflow-x-auto mb-8">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-raised)' }}>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Time</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Part</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Part Number</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Qty</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Part Location</th>
                </tr>
              </thead>
              <tbody>
                {bulkLog.map((e, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.time}</td>
                    <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.part_name}</td>
                    <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.part_number}</td>
                    <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.qty}</td>
                    <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.location || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {bulkLocationPrompt && bulkLocationPrompt.length > 0 && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[2000]">
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!bulkLocationInput.rack.trim() || !bulkLocationInput.shelf.trim()) return;
            const current = bulkLocationPrompt[0];
            const formatted = `Parts Rack:${bulkLocationInput.rack.trim()} Shelf:${bulkLocationInput.shelf.trim()}`;
            await fetch('/api/checkin/set-location', {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ part_no: current.part_no, location: formatted }),
            });
            setBulkLog(prev => prev.map(entry =>
              entry.part_number?.toUpperCase() === current.part_no ? { ...entry, location: formatted } : entry
            ));
            const remaining = bulkLocationPrompt.slice(1);
            if (remaining.length > 0) { setBulkLocationPrompt(remaining); setBulkLocationInput({ rack: '', shelf: '' }); }
            else setBulkLocationPrompt(null);
          }} className="rounded-xl p-6 w-full max-w-[420px] shadow-xl" style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}>
            <h3 className="text-lg font-semibold mb-2">Set Part Location</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              <strong>{bulkLocationPrompt[0].part_no}</strong>{bulkLocationPrompt[0].part_name ? ` (${bulkLocationPrompt[0].part_name})` : ''} does not have an inventory location.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Rack</label>
                <input autoFocus value={bulkLocationInput.rack} onChange={(e) => setBulkLocationInput(p => ({ ...p, rack: e.target.value }))} required className="input-themed w-full p-2 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Shelf</label>
                <input value={bulkLocationInput.shelf} onChange={(e) => setBulkLocationInput(p => ({ ...p, shelf: e.target.value }))} required className="input-themed w-full p-2 rounded text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={!bulkLocationInput.rack.trim() || !bulkLocationInput.shelf.trim()} className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Save Location</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
