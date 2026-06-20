'use client';

import { useState, useEffect, useCallback } from 'react';

export default function InventoryClient() {
  const [dbHealth, setDbHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [stock, setStock] = useState([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editPartNo, setEditPartNo] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPool, setEditPool] = useState('');
  const [editOriginalPool, setEditOriginalPool] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPart, setNewPart] = useState({ part_no: '', description: '', qty_on_hand: '', location: '', inventory_pool: '' });
  const [programs, setPrograms] = useState([]);
  const [partsCatalog, setPartsCatalog] = useState([]);
  const [descOpen, setDescOpen] = useState(false);
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const canEdit = userRole === 'supervisor' || userRole === 'manager';
  function toggleSort(col) { if (sortCol === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setSortCol(col); setSortDir('asc'); } }
  function sortIcon(col) { if (sortCol !== col) return ''; return sortDir === 'asc' ? ' ▲' : ' ▼'; }
  const sortedStock = [...stock].sort((a, b) => {
    if (!sortCol) return 0;
    let av = a[sortCol] || '', bv = b[sortCol] || '';
    if (sortCol === 'qty_on_hand') { av = parseInt(av) || 0; bv = parseInt(bv) || 0; }
    else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => { if (d.user) setUserRole(d.user.role); }).catch(() => {});
    fetch('/api/admin/programs').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setPrograms(d.data.filter(p => p.is_active)); }).catch(() => {});
    fetch('/api/reference/defective-parts').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setPartsCatalog(d.data); }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkHealth() {
      setHealthLoading(true);
      try {
        const res = await fetch('/api/db-health');
        const data = await res.json();
        if (!cancelled) setDbHealth(data.status === 'ok' ? 'ok' : 'error');
      } catch { if (!cancelled) setDbHealth('error'); }
      finally { if (!cancelled) setHealthLoading(false); }
    }
    checkHealth();
    return () => { cancelled = true; };
  }, []);

  const fetchData = useCallback(async () => {
    setStockLoading(true);
    setStockError(null);
    const searchParam = searchTerm.trim() ? `?search=${encodeURIComponent(searchTerm.trim())}` : '';
    try {
      const res = await fetch(`/api/stock${searchParam}`);
      if (!res.ok) throw new Error('Failed to load stock');
      const data = await res.json();
      setStock(data.data || []);
    } catch {
      setStock([]);
      setStockError('Unable to load stock levels. Please try again later.');
    }
    setStockLoading(false);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchData(); }, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  function startEdit(item) {
    setEditing(item.part_no + '||' + (item.inventory_pool || ''));
    setEditPartNo(item.part_no);
    setEditDesc(item.description || '');
    setEditQty(String(item.qty_on_hand));
    setEditLocation(item.location || '');
    setEditPool(item.inventory_pool || '');
    setEditOriginalPool(item.inventory_pool || '');
    setMessage(null);
  }

  function cancelEdit() { setEditing(null); setMessage(null); }

  async function deleteItem(partNo, pool) {
    setSaving(true);
    try {
      const res = await fetch('/api/inventory/edit', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ part_no: partNo, inventory_pool: pool || null }) });
      if (res.ok) { setMessage('Item deleted'); await fetchData(); } else { const d = await res.json(); setMessage(d.error || 'Delete failed'); }
    } catch { setMessage('Network error'); }
    finally { setSaving(false); setDeleteConfirm(null); }
  }

  function exportCSV() {
    const header = 'Part No,Description,Qty on Hand,Location,Inventory Pool';
    const rows = stock.map((item) =>
      `"${(item.part_no || '').replace(/"/g, '""')}","${(item.description || '').replace(/"/g, '""')}",${item.qty_on_hand},"${(item.location || '').replace(/"/g, '""')}","${(item.inventory_pool || '').replace(/"/g, '""')}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function addPart(e) {
    e.preventDefault();
    if (!newPart.part_no.trim()) { setMessage('Part No is required'); return; }
    setSaving(true);
    const res = await fetch('/api/inventory/add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPart),
    });
    if (res.ok) {
      setMessage('Part added');
      setNewPart({ part_no: '', description: '', qty_on_hand: '', location: '', inventory_pool: '' });
      setShowAddForm(false);
      await fetchData();
    } else {
      const d = await res.json();
      setMessage(d.error || 'Failed to add part');
    }
    setSaving(false);
  }

  async function saveEdit(partNo) {
    setSaving(true);
    const res = await fetch('/api/inventory/edit', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ part_no: partNo, original_pool: editOriginalPool, new_part_no: editPartNo.trim() || undefined, description: editDesc, qty_on_hand: editQty, location: editLocation, inventory_pool: editPool }),
    });
    if (res.ok) {
      setEditing(null);
      setMessage('Saved');
      await fetchData();
    } else {
      const d = await res.json();
      setMessage(d.error || 'Save failed');
    }
    setSaving(false);
  }

  const dotColor = healthLoading ? 'bg-gray-400' : dbHealth === 'ok' ? 'bg-green-500' : 'bg-red-600';
  const healthLabel = healthLoading ? 'Checking...' : dbHealth === 'ok' ? 'Database: Connected' : 'Database: Disconnected';
  const isSuccess = message && ['Saved', 'Part added'].includes(message);
  const inputCls = "input-themed p-2 rounded text-sm";

  return (
    <div className="py-8 max-w-[1200px] mx-auto">
      {message && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-lg text-sm font-medium z-[1000] shadow-lg ${isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}

      <div className="flex gap-2 items-center mb-6">
        <input
          type="text"
          placeholder="Search stock..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-themed w-full max-w-[400px] px-3 py-2 rounded-md text-sm"
        />
        {canEdit && !showAddForm && (
          <button onClick={() => setShowAddForm(true)} className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 whitespace-nowrap">Add Part</button>
        )}
        <button onClick={exportCSV} disabled={stock.length === 0} className="px-4 py-2 text-sm font-semibold bg-gray-700 text-white rounded-md hover:bg-gray-800 whitespace-nowrap disabled:opacity-50">Export CSV</button>
      </div>

      {canEdit && showAddForm && (
        <form onSubmit={addPart} className="rounded-lg p-4 mb-4 max-w-[500px]" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)', border: '1px solid var(--color-border)' }}>
          <div className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>New Part</div>
          <div className="grid gap-2">
            <input placeholder="Part No" value={newPart.part_no} onChange={(e) => setNewPart({ ...newPart, part_no: e.target.value })} required className={inputCls} />
            <div className="relative">
              <input placeholder="Description" value={newPart.description} onChange={(e) => { setNewPart({ ...newPart, description: e.target.value }); setDescOpen(true); }} onFocus={() => setDescOpen(true)} onBlur={() => setTimeout(() => { setDescOpen(false); if (newPart.description && !partsCatalog.some(c => c.name === newPart.description)) setNewPart(p => ({ ...p, description: '' })); }, 150)} autoComplete="off" className={inputCls + ' w-full'} />
              {descOpen && newPart.description.length >= 1 && (() => { const matches = partsCatalog.filter(c => c.name.toLowerCase().includes(newPart.description.toLowerCase())).slice(0, 8); if (!matches.length) return null; return (<ul className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto rounded shadow-lg text-sm border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>{matches.map(c => <li key={c.id} className="px-2 py-1.5 cursor-pointer hover:opacity-80" style={{ color: 'var(--color-text-primary)' }} onMouseDown={() => { setNewPart({ ...newPart, description: c.name }); setDescOpen(false); }}>{c.name}</li>)}</ul>); })()}
            </div>
            <input placeholder="Qty on Hand" type="number" value={newPart.qty_on_hand} onChange={(e) => setNewPart({ ...newPart, qty_on_hand: e.target.value })} className={inputCls} />
            <input placeholder="Location" value={newPart.location} onChange={(e) => setNewPart({ ...newPart, location: e.target.value })} className={inputCls} />
            <select value={newPart.inventory_pool} onChange={(e) => setNewPart({ ...newPart, inventory_pool: e.target.value })} className={inputCls}>
              <option value="">Select Inventory Pool</option>
              {programs.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={saving || !newPart.part_no.trim() || !newPart.description.trim() || !newPart.qty_on_hand || !newPart.location.trim() || !newPart.inventory_pool.trim()} className="px-4 py-1.5 text-sm font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Adding...' : 'Add'}</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-1.5 text-sm font-semibold bg-gray-500 text-white rounded-md hover:bg-gray-600">Cancel</button>
          </div>
        </form>
      )}

      {stockLoading && <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading stock levels...</div>}
      {stockError && <div className="text-center py-8 text-red-600 text-sm">{stockError}</div>}
      {!stockLoading && !stockError && stock.length === 0 && <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>No stock records found</div>}
      {!stockLoading && !stockError && stock.length > 0 && (
        <div className="overflow-x-auto mb-8">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ background: 'var(--color-surface-raised)' }}>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('part_no')}>Part No{sortIcon('part_no')}</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('description')}>Description{sortIcon('description')}</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('qty_on_hand')}>Qty on Hand{sortIcon('qty_on_hand')}</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('location')}>Location{sortIcon('location')}</th>
                <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('inventory_pool')}>Inventory Pool{sortIcon('inventory_pool')}</th>
                {canEdit && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}></th>}
              </tr>
            </thead>
            <tbody>
              {sortedStock.map((item, index) => (
                <tr key={`${item.part_no}-${index}`}>
                  {editing === item.part_no + '||' + (item.inventory_pool || '') ? (
                    <>
                      <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}><input value={editPartNo} onChange={(e) => setEditPartNo(e.target.value)} className="input-themed w-[120px] p-1 rounded text-sm" /></td>
                      <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}><input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="input-themed w-[180px] p-1 rounded text-sm" /></td>
                      <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}><input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)} className="input-themed w-[70px] p-1 rounded text-sm" /></td>
                      <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}><input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="input-themed w-[120px] p-1 rounded text-sm" /></td>
                      <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}><select value={editPool} onChange={(e) => setEditPool(e.target.value)} className="input-themed p-1 rounded text-sm">{programs.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></td>
                      <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <button onClick={() => saveEdit(item.part_no)} disabled={saving} className="mr-1 px-2 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">Save</button>
                        <button onClick={cancelEdit} className="px-2 py-0.5 text-xs bg-gray-500 text-white rounded hover:bg-gray-600">Cancel</button>
                        {userRole === 'manager' && <button onClick={() => setDeleteConfirm(item)} className="ml-1 px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700">Delete</button>}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{item.part_no}</td>
                      <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{item.description}</td>
                      <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{item.qty_on_hand}</td>
                      <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{item.location}</td>
                      <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{item.inventory_pool}</td>
                      {canEdit && <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}><button onClick={() => startEdit(item)} className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Edit</button></td>}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirm(null)}>
          <div className="rounded-lg shadow-xl p-6 w-full max-w-sm" style={{ background: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Confirm Delete</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Delete <strong>{deleteConfirm.part_no}</strong> ({deleteConfirm.description || 'no description'}) from inventory? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-1.5 text-sm rounded border border-slate-200 text-gray-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => deleteItem(deleteConfirm.part_no, deleteConfirm.inventory_pool)} disabled={saving} className="px-4 py-1.5 text-sm font-semibold rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
