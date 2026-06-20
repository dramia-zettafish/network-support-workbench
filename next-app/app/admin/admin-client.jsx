'use client';
// @approved-write-client
import { useState, useEffect, useCallback } from 'react';

const ROLES = ['manager', 'supervisor', 'admin'];
const thCls = "font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap text-sm";
const tdCls = "px-4 py-3 border-b text-sm";
const btnCls = "px-5 py-2 rounded-md text-sm font-semibold";
const btnPrimary = `${btnCls} btn-primary`;
const btnDanger = `${btnCls} bg-red-600 text-white hover:bg-red-700`;
const btnSmall = "px-3 py-1 text-xs font-semibold rounded-md";
const btnSmallPrimary = `${btnSmall} bg-blue-600 text-white hover:bg-blue-700`;
const btnSmallDanger = `${btnSmall} bg-red-600 text-white hover:bg-red-700`;
const btnNeutral = `${btnCls} btn-neutral`;
const inputCls = "input-themed px-3 py-2 rounded-md text-sm";

export default function AdminClient() {
  const [tab, setTab] = useState('users');
  const [msg, setMsg] = useState('');
  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000); }

  return (
    <div className="py-8">
      {msg && <div className="fixed bottom-6 right-6 px-5 py-3 rounded-lg text-sm font-medium z-[1000] shadow-lg bg-blue-100 text-blue-800">{msg}</div>}
      <div className="flex gap-2 flex-wrap mb-6">
        {['users', 'templates', 'customers', 'manufacturers', 'defective-parts', 'inventory', 'carriers', 'programs'].map((t) => (
          <button key={t} className={tab === t ? btnPrimary : btnNeutral} onClick={() => setTab(t)}>
            {t === 'defective-parts' ? 'Defective Parts' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'users' && <UsersTab flash={flash} />}
      {tab === 'templates' && <TemplatesTab flash={flash} />}
      {tab === 'customers' && <CustomersTab flash={flash} />}
      {tab === 'manufacturers' && <ManufacturersTab flash={flash} />}
      {tab === 'defective-parts' && <DefectivePartsTab flash={flash} />}
      {tab === 'inventory' && <InventoryTab flash={flash} />}
      {tab === 'carriers' && <CarriersTab flash={flash} />}
      {tab === 'programs' && <ProgramsTab flash={flash} />}
    </div>
  );
}

function UsersTab({ flash }) {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: '', display_name: '', email: '', role: 'admin', timezone: 'America/Chicago', teams: [] });
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [pwUser, setPwUser] = useState('');
  const [pw, setPw] = useState('');

  const fetchUsers = useCallback(async () => { setLoading(true); const res = await fetch('/api/admin/users'); if (res.ok) { const d = await res.json(); setUsers(d.data || []); } setLoading(false); }, []);
  const fetchTeams = useCallback(async () => { const res = await fetch('/api/admin/teams'); if (res.ok) { const d = await res.json(); setTeams(d.data || []); } }, []);
  useEffect(() => { fetchUsers(); fetchTeams(); }, [fetchUsers, fetchTeams]);

  async function handleSave(e) {
    e.preventDefault();
    const method = editing ? 'PATCH' : 'POST';
    const payload = editing ? { ...form, username: editing } : form;
    const res = await fetch('/api/admin/users', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { flash(editing ? 'User updated' : 'User created'); setEditing(null); setShowModal(false); resetForm(); await fetchUsers(); }
    else { const d = await res.json().catch(() => ({})); flash(d.error || 'Error'); }
  }

  async function handleDelete(username) {
    if (!confirm(`Delete user "${username}"?`)) return;
    const res = await fetch(`/api/admin/users?username=${encodeURIComponent(username)}`, { method: 'DELETE' });
    if (res.ok) { flash('User deleted'); await fetchUsers(); } else { const d = await res.json().catch(() => ({})); flash(d.error || 'Delete failed'); }
  }

  async function handleSetPassword(e) {
    e.preventDefault();
    const res = await fetch(`/api/admin/users/${encodeURIComponent(pwUser)}/password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (res.ok) { flash('Password set'); setPw(''); setPwUser(''); } else { const d = await res.json(); flash(d.error || 'Error'); }
  }

  function startEdit(u) { setEditing(u.username); setForm({ username: u.username, display_name: u.display_name || '', email: u.email || '', role: u.role, timezone: u.timezone || 'America/Chicago', teams: u.teams || [] }); setShowModal(true); }
  function resetForm() { setForm({ username: '', display_name: '', email: '', role: 'admin', timezone: 'America/Chicago', teams: [] }); }
  function toggleTeam(label) { setForm((f) => ({ ...f, teams: f.teams.includes(label) ? f.teams.filter((t) => t !== label) : [...f.teams, label] })); }

  return (
    <>
      <button className={`${btnPrimary} mb-4`} onClick={() => { setEditing(null); resetForm(); setShowModal(true); }}>Add User</button>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]" onClick={() => setShowModal(false)}>
          <div className="rounded-lg p-6 min-w-[360px] max-w-[500px] shadow-2xl" style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{editing ? 'Edit User' : 'Add User'}</h3>
            <form onSubmit={handleSave} className="flex flex-col gap-2">
              <label className="text-sm flex flex-col gap-0.5">Username<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required className={inputCls} /></label>
              <label className="text-sm flex flex-col gap-0.5">Display Name<input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className={inputCls} /></label>
              <label className="text-sm flex flex-col gap-0.5">Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></label>
              <label className="text-sm flex flex-col gap-0.5">Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
              <label className="text-sm flex flex-col gap-0.5">Timezone<select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={inputCls}>{['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu','America/Phoenix','UTC'].map((tz) => <option key={tz} value={tz}>{tz}</option>)}</select></label>
              {teams.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm">Teams</span>
                  <div className="flex gap-1 flex-wrap">
                    {teams.map((t) => (<label key={t.key} className="text-xs cursor-pointer"><input type="checkbox" checked={form.teams.includes(t.label)} onChange={() => toggleTeam(t.label)} /> {t.label}</label>))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <button type="submit" className={btnPrimary}>{editing ? 'Update' : 'Create'}</button>
                <button type="button" className={btnNeutral} onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {loading ? <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Loading...</div> : (
        <div className="overflow-x-auto mb-8">
          <table className="w-full border-collapse text-sm">
            <thead><tr style={{ background: 'var(--color-surface-raised)' }}><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Username</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Display Name</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Role</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Timezone</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Teams</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Actions</th></tr></thead>
            <tbody>{users.map((u) => (
              <tr key={u.username}>
                <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{u.username}</td><td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{u.display_name}</td><td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{u.role}</td><td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{u.timezone || 'America/Chicago'}</td><td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{(u.teams || []).join(', ')}</td>
                <td className={tdCls} style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(u)} className={btnSmallPrimary}>Edit</button>
                    <button onClick={() => handleDelete(u.username)} className={btnSmallDanger}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <h3 className="text-lg font-semibold mt-6 mb-2">Set Password</h3>
      <form onSubmit={handleSetPassword} className="flex gap-2 items-end flex-wrap">
        <select value={pwUser} onChange={(e) => setPwUser(e.target.value)} required className={inputCls}><option value="">Select user...</option>{users.map((u) => <option key={u.username} value={u.username}>{u.username}</option>)}</select>
        <input type="password" placeholder="New password (≥8, letter+digit)" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} className={inputCls} />
        <button type="submit" className={btnPrimary}>Set Password</button>
      </form>
    </>
  );
}

function TemplatesTab({ flash }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState({ recipient_template: '', cc_template: '', subject_template: '', body_template: '' });

  const fetchTemplates = useCallback(async () => { const res = await fetch('/api/admin/templates'); if (res.ok) { const d = await res.json(); setTemplates(d.data || []); } }, []);
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
  useEffect(() => { const t = templates.find((t) => t.template_key === selected); if (t) setForm({ recipient_template: t.recipient_template || '', cc_template: t.cc_template || '', subject_template: t.subject_template || '', body_template: t.body_template || '' }); }, [selected, templates]);
  useEffect(() => { if (templates.length && !selected) setSelected(templates[0].template_key); }, [templates, selected]);

  async function handleSave() { if (!selected) return; const res = await fetch(`/api/admin/templates/${encodeURIComponent(selected)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); if (res.ok) { flash('Template saved'); await fetchTemplates(); } else flash('Save failed'); }
  async function handleReset() { if (!selected || !confirm('Restore this template to its default content?')) return; const res = await fetch(`/api/admin/templates/${encodeURIComponent(selected)}`, { method: 'DELETE' }); if (res.ok) { flash('Template restored to default'); await fetchTemplates(); } else flash('Reset failed'); }

  const current = templates.find((t) => t.template_key === selected);

  return (
    <div className="flex flex-col gap-3">
      <select value={selected} onChange={(e) => setSelected(e.target.value)} className={`${inputCls} max-w-[300px]`}>{templates.map((t) => <option key={t.template_key} value={t.template_key}>{t.label || t.template_key}</option>)}</select>
      {current && <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>{current.description}</p>}
      <label className="text-sm">Recipient<input value={form.recipient_template} onChange={(e) => setForm({ ...form, recipient_template: e.target.value })} className={`${inputCls} w-full`} /></label>
      <label className="text-sm">CC<input value={form.cc_template} onChange={(e) => setForm({ ...form, cc_template: e.target.value })} className={`${inputCls} w-full`} /></label>
      <label className="text-sm">Subject<input value={form.subject_template} onChange={(e) => setForm({ ...form, subject_template: e.target.value })} className={`${inputCls} w-full`} /></label>
      <label className="text-sm">Body<textarea rows={8} value={form.body_template} onChange={(e) => setForm({ ...form, body_template: e.target.value })} className={`${inputCls} w-full font-mono`} /></label>
      <div className="flex gap-2">
        <button onClick={handleSave} className={btnPrimary}>Save Template</button>
        <button onClick={handleReset} className={btnDanger}>Reset to Default</button>
      </div>
    </div>
  );
}

function CustomersTab({ flash }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [newName, setNewName] = useState('');
  const limit = 100;

  const fetchCustomers = useCallback(async (o = 0) => { const params = new URLSearchParams({ limit, offset: o }); if (search) params.set('search', search); const res = await fetch(`/api/admin/customers?${params}`); if (res.ok) { const d = await res.json(); setCustomers(d.items || []); setTotal(d.total || 0); setOffset(o); } }, [search]);
  useEffect(() => { fetchCustomers(0); }, [fetchCustomers]);

  async function handleAdd(e) { e.preventDefault(); if (!newName.trim()) return; const res = await fetch('/api/admin/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }) }); if (res.ok) { flash('Customer added'); setNewName(''); await fetchCustomers(offset); } else { const d = await res.json(); flash(d.error || 'Error'); } }
  async function handleSave(id, name) { const res = await fetch(`/api/admin/customers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); if (res.ok) { flash('Customer updated'); await fetchCustomers(offset); } else flash('Update failed'); }
  async function handleDelete(id, name) { if (!confirm(`Delete "${name}"?`)) return; const res = await fetch(`/api/admin/customers/${id}`, { method: 'DELETE' }); if (res.ok) { flash('Customer deleted'); await fetchCustomers(offset); } }

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchCustomers(0)} className={inputCls} />
        <button className={btnNeutral} onClick={() => fetchCustomers(0)}>Search</button>
      </div>
      <form onSubmit={handleAdd} className="flex gap-2 mb-3">
        <input placeholder="New customer name" value={newName} onChange={(e) => setNewName(e.target.value)} required className={inputCls} />
        <button type="submit" className={btnPrimary}>Add</button>
      </form>
      <div className="overflow-x-auto mb-4">
        <table className="w-full border-collapse text-sm">
          <thead><tr style={{ background: 'var(--color-surface-raised)' }}><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Name</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Status</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Updated</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Actions</th></tr></thead>
          <tbody>{customers.map((c) => <CatalogRow key={c.id} item={c} onSave={handleSave} onDelete={handleDelete} />)}</tbody>
        </table>
      </div>
      <div className="flex gap-2 items-center text-sm">
        <button className={btnNeutral} disabled={offset <= 0} onClick={() => fetchCustomers(offset - limit)}>Prev</button>
        <span style={{ color: 'var(--color-text-muted)' }}>Showing {total > 0 ? offset + 1 : 0}–{Math.min(offset + customers.length, total)} of {total}</span>
        <button className={btnNeutral} disabled={offset + customers.length >= total} onClick={() => fetchCustomers(offset + limit)}>Next</button>
      </div>
    </div>
  );
}

function ManufacturersTab({ flash }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newWf, setNewWf] = useState(new Set());
  const [workflows, setWorkflows] = useState([]);

  const fetchData = useCallback(async () => { const params = search ? `?search=${encodeURIComponent(search)}` : ''; const res = await fetch(`/api/admin/manufacturers${params}`); if (res.ok) { const d = await res.json(); setItems(d.data || []); } }, [search]);
  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetch('/api/cases/catalogs').then(r => r.ok ? r.json() : null).then(d => { if (d?.data?.workflows) setWorkflows(d.data.workflows); }).catch(() => {}); }, []);

  async function handleAdd(e) { e.preventDefault(); if (!newName.trim()) return; const res = await fetch('/api/admin/manufacturers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim(), workflow_key: [...newWf].join(',') || null }) }); if (res.ok) { flash('Manufacturer added'); setNewName(''); setNewWf(new Set()); await fetchData(); } else { const d = await res.json(); flash(d.error || 'Error'); } }
  async function handleSave(id, name, workflow_key) { const res = await fetch(`/api/admin/manufacturers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, workflow_key }) }); if (res.ok) { flash('Manufacturer updated'); await fetchData(); } else flash('Failed'); }
  async function handleDelete(id, name) { if (!confirm(`Delete "${name}"?`)) return; const res = await fetch(`/api/admin/manufacturers/${id}`, { method: 'DELETE' }); if (res.ok) { flash('Manufacturer deleted'); await fetchData(); } }

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <input placeholder="Search manufacturers..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchData()} className={inputCls} />
        <button className={btnNeutral} onClick={fetchData}>Search</button>
      </div>
      <form onSubmit={handleAdd} className="flex gap-2 mb-3 flex-wrap items-center">
        <input placeholder="New manufacturer name" value={newName} onChange={(e) => setNewName(e.target.value)} required className={inputCls} />
        {workflows.map((w) => <label key={w.workflow_key} className="flex items-center gap-1 text-xs whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}><input type="checkbox" checked={newWf.has(w.workflow_key)} onChange={() => setNewWf(prev => { const next = new Set(prev); if (next.has(w.workflow_key)) next.delete(w.workflow_key); else next.add(w.workflow_key); return next; })} />{w.label}</label>)}
        <button type="submit" className={btnPrimary}>Add</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead><tr style={{ background: 'var(--color-surface-raised)' }}><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Name</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Workflow</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Status</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Actions</th></tr></thead>
          <tbody>{items.map((m) => <ManufacturerRow key={m.id} item={m} workflows={workflows} onSave={handleSave} onDelete={handleDelete} />)}</tbody>
        </table>
      </div>
    </div>
  );
}

function ManufacturerRow({ item, workflows, onSave, onDelete }) {
  const [name, setName] = useState(item.name);
  const [wfSet, setWfSet] = useState(new Set((item.workflow_key || '').split(',').map(s => s.trim()).filter(Boolean)));
  function toggleWf(key) { setWfSet(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }
  return (
    <tr>
      <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}><input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} w-full`} /></td>
      <td className={tdCls} style={{ borderColor: 'var(--color-border)' }}><div className="flex flex-wrap gap-2">{workflows.map((w) => <label key={w.workflow_key} className="flex items-center gap-1 text-xs whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}><input type="checkbox" checked={wfSet.has(w.workflow_key)} onChange={() => toggleWf(w.workflow_key)} />{w.label}</label>)}</div></td>
      <td className={tdCls} style={{ borderColor: 'var(--color-border)' }}><span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">{item.validation_status || 'approved'}</span></td>
      <td className={tdCls} style={{ borderColor: 'var(--color-border)' }}><div className="flex gap-1"><button onClick={() => onSave(item.id, name, [...wfSet].join(','))} className={btnSmallPrimary}>Save</button><button onClick={() => onDelete(item.id, name)} className={btnSmallDanger}>Delete</button></div></td>
    </tr>
  );
}

function DefectivePartsTab({ flash }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');

  const fetchData = useCallback(async () => { const params = search ? `?search=${encodeURIComponent(search)}` : ''; const res = await fetch(`/api/admin/defective-parts${params}`); if (res.ok) { const d = await res.json(); setItems(d.data || []); } }, [search]);
  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAdd(e) { e.preventDefault(); if (!newName.trim()) return; const res = await fetch('/api/admin/defective-parts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }) }); if (res.ok) { flash('Part added'); setNewName(''); await fetchData(); } else { const d = await res.json(); flash(d.error || 'Error'); } }
  async function handleSave(id, name) { const res = await fetch(`/api/admin/defective-parts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); if (res.ok) { flash('Part updated'); await fetchData(); } else flash('Failed'); }
  async function handleDelete(id, name) { if (!confirm(`Delete "${name}"?`)) return; const res = await fetch(`/api/admin/defective-parts/${id}`, { method: 'DELETE' }); if (res.ok) { flash('Part deleted'); await fetchData(); } }

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <input placeholder="Search parts..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchData()} className={inputCls} />
        <button className={btnNeutral} onClick={fetchData}>Search</button>
      </div>
      <form onSubmit={handleAdd} className="flex gap-2 mb-3">
        <input placeholder="New part name" value={newName} onChange={(e) => setNewName(e.target.value)} required className={inputCls} />
        <button type="submit" className={btnPrimary}>Add</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead><tr style={{ background: 'var(--color-surface-raised)' }}><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Name</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Actions</th></tr></thead>
          <tbody>{items.map((m) => <CatalogRow key={m.id} item={m} onSave={handleSave} onDelete={handleDelete} />)}</tbody>
        </table>
      </div>
    </div>
  );
}

function CarriersTab({ flash }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');

  const fetchData = useCallback(async () => { const params = search ? `?search=${encodeURIComponent(search)}` : ''; const res = await fetch(`/api/admin/carriers${params}`); if (res.ok) { const d = await res.json(); setItems(d.data || []); } }, [search]);
  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAdd(e) { e.preventDefault(); if (!newName.trim()) return; const res = await fetch('/api/admin/carriers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }) }); if (res.ok) { flash('Carrier added'); setNewName(''); await fetchData(); } else { const d = await res.json(); flash(d.error || 'Error'); } }
  async function handleSave(id, name) { const res = await fetch(`/api/admin/carriers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); if (res.ok) { flash('Carrier updated'); await fetchData(); } else flash('Failed'); }
  async function handleDelete(id, name) { if (!confirm(`Delete "${name}"?`)) return; const res = await fetch(`/api/admin/carriers/${id}`, { method: 'DELETE' }); if (res.ok) { flash('Carrier deleted'); await fetchData(); } }

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <input placeholder="Search carriers..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchData()} className={inputCls} />
        <button className={btnNeutral} onClick={fetchData}>Search</button>
      </div>
      <form onSubmit={handleAdd} className="flex gap-2 mb-3">
        <input placeholder="New carrier name" value={newName} onChange={(e) => setNewName(e.target.value)} required className={inputCls} />
        <button type="submit" className={btnPrimary}>Add</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead><tr style={{ background: 'var(--color-surface-raised)' }}><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Name</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Actions</th></tr></thead>
          <tbody>{items.map((c) => <CarrierRow key={c.id} item={c} onSave={handleSave} onDelete={handleDelete} />)}</tbody>
        </table>
      </div>
    </div>
  );
}

function CarrierRow({ item, onSave, onDelete }) {
  const [name, setName] = useState(item.name);
  return (
    <tr>
      <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}><input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} w-full`} /></td>
      <td className={tdCls} style={{ borderColor: 'var(--color-border)' }}><div className="flex gap-1"><button onClick={() => onSave(item.id, name)} className={btnSmallPrimary}>Save</button><button onClick={() => onDelete(item.id, name)} className={btnSmallDanger}>Delete</button></div></td>
    </tr>
  );
}

function CatalogRow({ item, onSave, onDelete }) {
  const [name, setName] = useState(item.name);
  return (
    <tr>
      <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}><input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} w-full`} /></td>
      <td className={tdCls} style={{ borderColor: 'var(--color-border)' }}><span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">{item.validation_status || 'approved'}</span></td>
      <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{item.updated_at || item.created_at || ''}</td>
      <td className={tdCls} style={{ borderColor: 'var(--color-border)' }}><div className="flex gap-1"><button onClick={() => onSave(item.id, name)} className={btnSmallPrimary}>Save</button><button onClick={() => onDelete(item.id, name)} className={btnSmallDanger}>Delete</button></div></td>
    </tr>
  );
}

function ProgramsTab({ flash }) {
  const [items, setItems] = useState([]);
  const [newName, setNewName] = useState('');

  const fetchData = useCallback(async () => { const res = await fetch('/api/admin/programs'); if (res.ok) { const d = await res.json(); setItems(d.data || []); } }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAdd(e) { e.preventDefault(); if (!newName.trim()) return; const res = await fetch('/api/admin/programs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }) }); if (res.ok) { flash('Program added'); setNewName(''); await fetchData(); } else { const d = await res.json(); flash(d.error || 'Error'); } }
  async function handleSave(id, name, is_active, service_fee) { const res = await fetch('/api/admin/programs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name, is_active, service_fee }) }); if (res.ok) { flash('Program updated'); await fetchData(); } else flash('Failed'); }
  async function handleDelete(id, name) { if (!confirm(`Delete "${name}"?`)) return; const res = await fetch('/api/admin/programs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); if (res.ok) { flash('Program deleted'); await fetchData(); } }

  return (
    <div>
      <form onSubmit={handleAdd} className="flex gap-2 mb-3">
        <input placeholder="New program name" value={newName} onChange={(e) => setNewName(e.target.value)} required className={inputCls} />
        <button type="submit" className={btnPrimary}>Add</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead><tr style={{ background: 'var(--color-surface-raised)' }}><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Name</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Service Fee</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Active</th><th className={thCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Actions</th></tr></thead>
          <tbody>{items.map((p) => <ProgramRow key={p.id} item={p} onSave={handleSave} onDelete={handleDelete} />)}</tbody>
        </table>
      </div>
    </div>
  );
}

function ProgramRow({ item, onSave, onDelete }) {
  const [name, setName] = useState(item.name);
  const [active, setActive] = useState(item.is_active);
  const [serviceFee, setServiceFee] = useState(item.service_fee || '');
  return (
    <tr>
      <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}><input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} w-full`} /></td>
      <td className={tdCls} style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}><div className="flex items-center gap-0.5"><span className="text-sm text-gray-500">$</span><input value={serviceFee} onChange={(e) => setServiceFee(e.target.value)} placeholder="0.00" className={`${inputCls} w-20`} /></div></td>
      <td className={tdCls} style={{ borderColor: 'var(--color-border)' }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /></td>
      <td className={tdCls} style={{ borderColor: 'var(--color-border)' }}><div className="flex gap-1"><button onClick={() => onSave(item.id, name, active, serviceFee)} className={btnSmallPrimary}>Save</button><button onClick={() => onDelete(item.id, name)} className={btnSmallDanger}>Delete</button></div></td>
    </tr>
  );
}

function InventoryTab({ flash }) {
  const [wipeScope, setWipeScope] = useState('inventory');

  async function handleWipe() { if (!confirm(`Wipe inventory (scope: ${wipeScope})? This cannot be undone.`)) return; const res = await fetch('/api/admin/inventory/wipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: wipeScope }) }); if (res.ok) flash('Inventory wiped'); else flash('Wipe failed'); }
  async function handleImport(e) { e.preventDefault(); const fileInput = e.target.querySelector('input[type="file"]'); if (!fileInput.files[0]) return; const fd = new FormData(); fd.append('file', fileInput.files[0]); const res = await fetch('/api/admin/inventory/import', { method: 'POST', body: fd }); if (res.ok) { const d = await res.json(); flash(`Imported ${d.imported} rows`); } else { const d = await res.json(); flash(d.error || 'Import failed'); } fileInput.value = ''; }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold mb-2">Wipe Inventory</h3>
        <div className="flex gap-2 items-center">
          <select value={wipeScope} onChange={(e) => setWipeScope(e.target.value)} className={inputCls}>
            <option value="inventory">Delete all rows</option>
            <option value="counts">Zero out quantities</option>
            <option value="all">Delete inventory + catalog</option>
          </select>
          <button onClick={handleWipe} className={btnDanger}>Wipe</button>
        </div>
      </div>
      <div>
        <h3 className="text-base font-semibold mb-2">Import CSV</h3>
        <form onSubmit={handleImport} className="flex gap-2 items-center">
          <input type="file" accept=".csv" required />
          <button type="submit" className={btnPrimary}>Import</button>
        </form>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>CSV columns: part_no, description, available (or qty), location</p>
      </div>
    </div>
  );
}
