'use client';
// @approved-write-client
import { useState, useEffect, useCallback } from 'react';
import { useTimezone } from '@/lib/format-date.js';

export default function IssueClient() {
  const { timezone } = useTimezone();
  const [cart, setCart] = useState([]);
  const [workOrderNo, setWorkOrderNo] = useState('');
  const [rack, setRack] = useState('');
  const [shelf, setShelf] = useState('');
  const [returnMap, setReturnMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('error');
  const [checkoutLog, setCheckoutLog] = useState([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('checkoutLog') || '{}');
      if (stored.date === new Date().toDateString()) setCheckoutLog(stored.entries || []);
    } catch { /* ignore */ }
  }, []);

  function saveLog(entries) {
    setCheckoutLog(entries);
    localStorage.setItem('checkoutLog', JSON.stringify({ date: new Date().toDateString(), entries }));
  }

  // Stock search state
  const [searchTerm, setSearchTerm] = useState('');
  const [stockResults, setStockResults] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    const res = await fetch('/api/issue/cart');
    if (res.ok) { const d = await res.json(); setCart(d.data || []); }
  }, []);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const fetchStock = useCallback(async () => {
    if (!searchTerm.trim()) { setStockResults([]); return; }
    setStockLoading(true);
    try {
      const res = await fetch(`/api/stock?search=${encodeURIComponent(searchTerm.trim())}`);
      if (res.ok) {
        const d = await res.json();
        setStockResults(d.data || []);
      }
    } catch { /* ignore */ }
    setStockLoading(false);
  }, [searchTerm]);

  // Debounced stock search
  useEffect(() => {
    const timer = setTimeout(() => { fetchStock(); }, 300);
    return () => clearTimeout(timer);
  }, [fetchStock]);

  async function addToCart(partNo) {
    if (!partNo) return;
    setLoading(true);
    const res = await fetch('/api/issue/cart', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ part_no: partNo }),
    });
    if (res.ok) { await fetchCart(); showMsg(null); }
    else { const d = await res.json(); showMsg(d.error || 'Failed to add', 'error'); }
    setLoading(false);
  }

  async function clearCart() {
    await fetch('/api/issue/cart', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear' }),
    });
    setReturnMap({});
    await fetchCart();
  }

  async function commit() {
    if (cart.length === 0) return;
    if (!workOrderNo.trim()) { showMsg('Case Number is required', 'error'); return; }
    if (!rack.trim() || !shelf.trim()) { showMsg('Target Asset Location (Rack and Shelf) is required', 'error'); return; }
    setLoading(true);
    const res = await fetch('/api/issue/commit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        work_order_no: workOrderNo || null,
        target_asset_location: [rack.trim(), shelf.trim()].filter(Boolean).join(' / ') || null,
        return_required_map: returnMap,
      }),
    });
    const d = await res.json();
    if (res.ok) {
      saveLog([...checkoutLog, {
        time: new Date().toLocaleTimeString([], { timeZone: timezone }),
        work_order_no: workOrderNo,
        asset_location: [rack.trim(), shelf.trim()].filter(Boolean).join(' / '),
        parts: cart.map((c) => ({
          part_no: c.part_no,
          part_location: stockResults.find((s) => s.part_no === c.part_no)?.location || '',
          return_required: returnMap[c.part_no] ? 'Yes' : 'No',
        })),
      }]);
      showMsg('Checkout complete', 'success');
      setWorkOrderNo('');
      setRack('');
      setShelf('');
      setReturnMap({});
      await fetchCart();
      await fetchStock();
    } else {
      showMsg(d.error || d.message || 'Checkout failed', 'error');
    }
    setLoading(false);
  }

  function toggleReturn(partNo) {
    setReturnMap((prev) => ({ ...prev, [partNo]: !prev[partNo] }));
  }

  function showMsg(text, type = 'error') {
    setMessage(text);
    setMessageType(type);
  }

  function printLog() {
    const win = window.open('', '_blank');
    const rows = checkoutLog.flatMap((e) =>
      e.parts.map((p, i) =>
        `<tr><td>${i === 0 ? e.time : ''}</td><td>${i === 0 ? e.work_order_no : ''}</td><td>${i === 0 ? (e.asset_location || '-') : ''}</td><td>${p.part_no}</td><td>${p.part_location || '-'}</td><td>${p.return_required}</td></tr>`
      )
    ).join('');
    win.document.write(`<html><head><title>Checkout Log</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}th{background:#f0f0f0}</style></head><body><h2>Checkout Log</h2><table><thead><tr><th>Time</th><th>Case Number</th><th>Asset Location</th><th>Part No</th><th>Part Location</th><th>Return Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
  }

  function clearLog() { setCheckoutLog([]); localStorage.removeItem('checkoutLog'); }

  const cartPartNos = new Set(cart.map((c) => c.part_no));

  return (
    <div className="pb-8 max-w-[1200px] mx-auto">
      {message && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-lg text-sm font-medium z-[1000] shadow-lg ${messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}

      {/* Stock Search */}
      <div className="px-4 py-3 mb-6 rounded-lg" style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5a8e)', color: '#fff' }}>
        <h2 className="text-lg font-bold">Dynamics Cases</h2>
      </div>
      <h3 className="text-base font-semibold mt-6 mb-3" style={{ color: 'var(--color-text-primary)' }}>Search Stock</h3>
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by part number or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-themed w-full max-w-[400px] px-3 py-2 rounded-md text-sm"
        />
      </div>

      {stockLoading && <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Searching...</div>}
      {!stockLoading && stockResults.length > 0 && (
        <div className="overflow-x-auto mb-8">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ background: 'var(--color-surface-raised)' }}>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Part No</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Description</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Available</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Location</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}></th>
              </tr>
            </thead>
            <tbody>
              {stockResults.map((item, i) => (
                <tr key={item.part_no || i}>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{item.part_no}</td>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{item.description}</td>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{item.qty_on_hand}</td>
                  <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{item.location}</td>
                  <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <button
                      onClick={() => addToCart(item.part_no)}
                      disabled={loading || cartPartNos.has(item.part_no) || item.qty_on_hand < 1}
                      className="px-3 py-1 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cartPartNos.has(item.part_no) ? 'In Cart' : item.qty_on_hand < 1 ? 'No Stock' : 'Add'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!stockLoading && searchTerm.trim() && stockResults.length === 0 && (
        <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No parts found</div>
      )}

      {/* Cart */}
      {cart.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mt-6 mb-3" style={{ color: 'var(--color-text-primary)' }}>Cart ({cart.length} items)</h2>
          <div className="overflow-x-auto mb-8">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-raised)' }}>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Part No</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Qty</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Return Required</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{item.part_no}</td>
                    <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{item.qty}</td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <input
                        type="checkbox"
                        checked={!!returnMap[item.part_no]}
                        onChange={() => toggleReturn(item.part_no)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Checkout Fields */}
          <div className="mb-4">
            <label className="block font-semibold mb-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>Case Number</label>
            <input value={workOrderNo} onChange={(e) => setWorkOrderNo(e.target.value)} className="input-themed w-full max-w-[400px] px-3 py-2 rounded-md text-sm" />
          </div>
          <div className="mb-4">
            <label className="block font-semibold mb-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>Target Asset Location</label>
            <div className="flex gap-2 max-w-[400px]">
              <input value={rack} onChange={(e) => setRack(e.target.value)} placeholder="Rack" className="input-themed w-full px-3 py-2 rounded-md text-sm" />
              <input value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder="Shelf" className="input-themed w-full px-3 py-2 rounded-md text-sm" />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap mb-4">
            <button onClick={commit} disabled={loading} className="px-5 py-2 rounded-md text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Processing...' : 'Commit Checkout'}
            </button>
            <button onClick={clearCart} disabled={loading} className="px-5 py-2 rounded-md text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">Clear Cart</button>
          </div>
        </>
      )}

      {/* Checkout Log */}
      {checkoutLog.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Checkout Log</h3>
            <button onClick={printLog} className="px-3 py-1 text-xs font-semibold rounded border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>🖨️ Print</button>
            <button onClick={clearLog} className="px-3 py-1 text-xs font-semibold rounded border border-red-300 text-red-600 hover:bg-red-50">Clear</button>
          </div>
          <div className="overflow-x-auto mb-8">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-raised)' }}>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Time</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Case Number</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Asset Location</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Part No</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Part Location</th>
                  <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Return Status</th>
                </tr>
              </thead>
              <tbody>
                {checkoutLog.flatMap((entry, i) =>
                  entry.parts.map((p, j) => (
                    <tr key={`${i}-${j}`}>
                      <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{j === 0 ? entry.time : ''}</td>
                      <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{j === 0 ? entry.work_order_no : ''}</td>
                      <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{j === 0 ? (entry.asset_location || '-') : ''}</td>
                      <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{p.part_no}</td>
                      <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{p.part_location || '-'}</td>
                      <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{p.return_required}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* EU Support Cases */}
      <EuSupportIssueSection timezone={timezone} />
    </div>
  );
}

function EuSupportIssueSection({ timezone }) {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [returnSelections, setReturnSelections] = useState({});
  const [issuing, setIssuing] = useState(null);
  const [message, setMessage] = useState(null);
  const [log, setLog] = useState([]);

  useEffect(() => {
    try { const stored = JSON.parse(localStorage.getItem('euIssueLog') || '{}'); if (stored.date === new Date().toDateString()) setLog(stored.entries || []); } catch {}
  }, []);

  function saveLog(entries) { setLog(entries); localStorage.setItem('euIssueLog', JSON.stringify({ date: new Date().toDateString(), entries })); }

  useEffect(() => { fetch('/api/issue/eu-support').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setParts(d.data); }).finally(() => setLoading(false)); }, []);

  function parseAssetLoc(body) { try { const p = JSON.parse(body); const a = p.awaiting_part; if (a?.rack && a?.shelf) return `Rack ${a.rack} / Shelf ${a.shelf}`; if (a?.crate) return `Crate ${a.crate}`; } catch {} return '-'; }

  async function handleIssue(part) {
    setIssuing(part.part_id); setMessage(null);
    try {
      const res = await fetch('/api/issue/eu-support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ part_id: part.part_id, case_id: part.case_id, inv_part_no: part.inv_part_no || part.part_number, return_required: returnSelections[part.part_id] }) });
      if (!res.ok) { const d = await res.json(); setMessage({ type: 'error', text: d.error || 'Failed' }); return; }
      const pno = part.inv_part_no || part.part_number;
      const entry = { time: new Date().toLocaleString('en-US', { timeZone: timezone }), case_number: part.case_number, asset_location: parseAssetLoc(part.asset_location_body), part_no: pno, part_location: part.part_location || '-', return_status: returnSelections[part.part_id] || 'N/A' };
      saveLog([entry, ...log]);
      const refreshRes = await fetch('/api/issue/eu-support');
      if (refreshRes.ok) { const d = await refreshRes.json(); setParts(d.data || []); } else { setParts(prev => prev.filter(p => p.part_id !== part.part_id)); }
      setMessage({ type: 'success', text: `Issued ${pno} for ${part.case_number}` });
    } catch { setMessage({ type: 'error', text: 'Network error' }); }
    finally { setIssuing(null); }
  }

  function printLog() { const w = window.open('', '_blank'); w.document.write('<html><head><title>EU Support Issue Log</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;text-align:left;font-size:12px}th{background:#f0f0f0}</style></head><body><h2>EU Support Issue Log — ' + new Date().toLocaleDateString() + '</h2><table><thead><tr><th>Time</th><th>Case</th><th>Asset Location</th><th>Part No</th><th>Part Location</th><th>Return</th></tr></thead><tbody>' + log.map(e => `<tr><td>${e.time}</td><td>${e.case_number}</td><td>${e.asset_location}</td><td>${e.part_no}</td><td>${e.part_location}</td><td>${e.return_status}</td></tr>`).join('') + '</tbody></table></body></html>'); w.document.close(); }

  return (
    <div className="mt-10 pt-8" style={{ borderTop: '2px solid var(--color-border)' }}>
      <div className="px-4 py-3 mb-6 rounded-lg" style={{ background: 'linear-gradient(135deg, #1e5a3a, #2d8e5a)', color: '#fff' }}>
        <h2 className="text-lg font-bold">EU Support Cases</h2>
      </div>
      {message && <div className={`px-3 py-2 rounded text-sm mb-4 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>{message.text}</div>}
      {loading && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>}
      {!loading && parts.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No parts pending distribution.</p>}
      {!loading && parts.length > 0 && (
        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ background: 'var(--color-surface-raised)' }}>
                <th className="font-semibold text-left px-3 py-2 border-b-2" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Case</th>
                <th className="font-semibold text-left px-3 py-2 border-b-2" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Part</th>
                <th className="font-semibold text-left px-3 py-2 border-b-2" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Part No</th>
                <th className="font-semibold text-left px-3 py-2 border-b-2" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Location</th>
                <th className="font-semibold text-left px-3 py-2 border-b-2" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Qty</th>
                <th className="font-semibold text-left px-3 py-2 border-b-2" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Return</th>
                <th className="font-semibold text-left px-3 py-2 border-b-2" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}></th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.part_id}>
                  <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{p.case_number}</td>
                  <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{p.part_name}</td>
                  <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{p.inv_part_no || p.part_number || '-'}</td>
                  <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{p.part_location || '-'}</td>
                  <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{p.qty_on_hand ?? '-'}</td>
                  <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <select value={returnSelections[p.part_id] || ''} onChange={(e) => setReturnSelections(prev => ({ ...prev, [p.part_id]: e.target.value }))} className="px-2 py-1 border border-slate-200 rounded text-xs">
                      <option value="">Select...</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <button onClick={() => handleIssue(p)} disabled={!returnSelections[p.part_id] || !(p.inv_part_no || p.part_number) || issuing === p.part_id} className="px-3 py-1 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">{issuing === p.part_id ? '...' : 'Issue'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {log.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Checkout Log</h3>
            <button onClick={printLog} className="px-3 py-1 text-xs font-semibold rounded border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>🖨️ Print</button>
            <button onClick={() => saveLog([])} className="px-3 py-1 text-xs font-semibold rounded border border-red-300 text-red-600 hover:bg-red-50">Clear</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-raised)' }}>
                  <th className="font-semibold text-left px-3 py-2 border-b-2" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Time</th>
                  <th className="font-semibold text-left px-3 py-2 border-b-2" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Case</th>
                  <th className="font-semibold text-left px-3 py-2 border-b-2" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Asset Location</th>
                  <th className="font-semibold text-left px-3 py-2 border-b-2" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Part No</th>
                  <th className="font-semibold text-left px-3 py-2 border-b-2" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Part Location</th>
                  <th className="font-semibold text-left px-3 py-2 border-b-2" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Return</th>
                </tr>
              </thead>
              <tbody>
                {log.map((e, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.time}</td>
                    <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.case_number}</td>
                    <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.asset_location}</td>
                    <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.part_no}</td>
                    <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.part_location}</td>
                    <td className="px-3 py-2 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{e.return_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
