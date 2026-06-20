'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '../components/workspace-provider.jsx';
import { useTimezone } from '@/lib/format-date.js';

const REQUEST_SOURCES = ['Service Desk', 'Technician', 'Leadership', 'PM', 'Direct', 'Savant'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Critical'];

function CaseCreateForm({ onCreated, usersById, teamsById }) {
  const [catalogs, setCatalogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [createPopup, setCreatePopup] = useState(null);

  useEffect(() => {
    if (!createPopup) return;
    const timer = setTimeout(() => { window.location.href = '/cases'; }, 4000);
    return () => clearTimeout(timer);
  }, [createPopup]);

  const [form, setForm] = useState({
    workflow_key: '',
    program: '',
    customer_name: '',
    requester_name: '',
    requester_email: '',
    requester_phone: '',
    poc_name: '',
    poc_email: '',
    poc_phone: '',
    poc_address: '',
    request_source: 'Service Desk',
    priority: 'Normal',
    facility: '',
    assigned_to_username: '',
    hisd_exception: false,
    rma_manufacturer: '',
    rma_product_id: '',
    rma_serial_number: '',
    rma_mac_address: '',
    rma_issue_description: '',
    rma_unserialized: false,
    refresh_manufacturer: '',
    refresh_device_type: '',
    refresh_serial_number: '',
    refresh_asset_tag: '',
    refresh_model: '',
    refresh_model_name: '',
    refresh_issue_description: '',
    refresh_warranty_end: '',
    refresh_adp: '',
    refresh_damage_excuse: '',
  });

  useEffect(() => {
    async function loadCatalogs() {
      try {
        const res = await fetch('/api/cases/catalogs');
        if (!res.ok) throw new Error('Failed to load catalogs');
        const { data } = await res.json();
        setCatalogs(data);
      } catch { setError('Unable to load form data'); }
      finally { setLoading(false); }
    }
    loadCatalogs();
  }, []);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const payload = {
      workflow_key: form.workflow_key,
      customer_name: form.customer_name,
      requester_name: form.requester_name,
      requester_email: form.requester_email,
      requester_phone: form.requester_phone || undefined,
      poc_name: form.poc_name || undefined,
      poc_email: form.poc_email || undefined,
      poc_phone: form.poc_phone || undefined,
      poc_address: form.poc_address || undefined,
      request_source: form.request_source,
      priority: form.priority,
      facility: form.facility || undefined,
      assigned_to_username: (form.assigned_to_username && form.assigned_to_username !== '__team__') ? form.assigned_to_username : undefined,
      hisd_exception: form.hisd_exception,
      program: form.program || undefined,
    };

    if (form.workflow_key === 'rma') {
      payload.rma = {
        manufacturer: form.rma_manufacturer,
        product_id: form.rma_product_id || undefined,
        serial_number: form.rma_serial_number || undefined,
        mac_address: form.rma_mac_address || undefined,
        issue_description: form.rma_issue_description || undefined,
        unserialized_no_mac_product: form.rma_unserialized,
      };
    }

    if (form.workflow_key === 'refresh') {
      payload.refresh = {
        manufacturer: form.refresh_manufacturer,
        device_type: form.refresh_device_type,
        serial_number: form.refresh_serial_number || undefined,
        asset_tag: form.refresh_asset_tag || undefined,
        model: form.refresh_model || undefined,
        model_name: form.refresh_model_name || undefined,
        warranty_end: form.refresh_warranty_end || undefined,
        adp: form.refresh_adp || undefined,
        issue_description: form.refresh_issue_description || undefined,
        damage_excuse: form.refresh_damage_excuse || undefined,
      };
    }

    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Case creation failed'); return; }
      setSuccess(`Created ${data.case_number}`);
      setCreatePopup({
        case_number: data.case_number,
        stage: data.stage,
        team: teamsById?.[data.owning_team_id] || '',
        assigned: data.assigned_to_user_id ? (usersById?.[data.assigned_to_user_id] || null) : null,
      });
      setForm((prev) => ({
        ...prev,
        customer_name: '', requester_name: '', requester_email: '', requester_phone: '',
        poc_name: '', poc_email: '', poc_phone: '', poc_address: '',
        facility: '', assigned_to_username: '',
        rma_manufacturer: '', rma_product_id: '', rma_serial_number: '',
        rma_mac_address: '', rma_issue_description: '', rma_unserialized: false,
        refresh_manufacturer: '', refresh_device_type: '', refresh_serial_number: '',
        refresh_asset_tag: '', refresh_model: '', refresh_model_name: '', refresh_warranty_end: '', refresh_adp: '', refresh_issue_description: '', refresh_damage_excuse: '',
        hisd_exception: false,
      }));
      if (onCreated) onCreated();
    } catch { setError('Network error'); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>Loading form...</div>;

  const isRma = form.workflow_key === 'rma';
  const isRefresh = form.workflow_key === 'refresh';

  return (
    <>
    {createPopup && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 text-center">
          <div className="text-green-600 text-3xl mb-2">✓</div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{createPopup.case_number}</h3>
          <p className="text-sm text-gray-700">Stage: <strong>{createPopup.stage}</strong></p>
          {createPopup.team && <p className="text-sm text-gray-700">Owning team: <strong>{createPopup.team}</strong></p>}
          {createPopup.assigned && <p className="text-sm text-gray-700">Assigned to: <strong>{createPopup.assigned}</strong></p>}
          {createPopup.assigned === null && <p className="text-sm text-gray-700">Assigned to: <strong>Unassigned</strong></p>}
        </div>
      </div>
    )}
    <form onSubmit={handleSubmit} className="space-y-4 max-w-[700px]">
      {error && <div className="px-3 py-2 bg-red-50 border border-red-300 rounded-md text-red-800 text-sm">{error}</div>}
      {success && <div className="px-3 py-2 bg-green-50 border border-green-300 rounded-md text-green-800 text-sm">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Workflow */}
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Workflow *</label>
          <select value={form.workflow_key} onChange={(e) => update('workflow_key', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" required>
            <option value="">Select workflow...</option>
            {catalogs?.workflows?.map((w) => <option key={w.workflow_key} value={w.workflow_key}>{w.label}</option>)}
          </select>
        </div>

        {/* Program - Refresh only */}
        {isRefresh && (
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Program</label>
            <select value={form.program} onChange={(e) => update('program', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm">
              <option value="">Select program...</option>
              {(catalogs?.programs || []).map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
        )}

        {/* Customer */}
        <div className="relative">
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Customer *</label>
          <input
            type="text"
            value={form.customer_name}
            onChange={(e) => { update('customer_name', e.target.value); update('_custOpen', true); }}
            onFocus={() => update('_custOpen', true)}
            placeholder="Search customer..."
            className="input-themed w-full px-3 py-2 rounded-md text-sm"
            required
            autoComplete="off"
          />
          {form._custOpen && form.customer_name.length >= 1 && (() => {
            const matches = (catalogs?.customers || []).filter((c) => c.name.toLowerCase().includes(form.customer_name.toLowerCase())).slice(0, 10);
            if (!matches.length) return null;
            return (
              <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-md shadow-lg text-sm" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                {matches.map((c) => (
                  <li key={c.id} className="px-3 py-2 cursor-pointer hover:brightness-125" style={{ color: 'var(--color-text-primary)' }} onMouseDown={() => { update('customer_name', c.name); update('_custOpen', false); }}>{c.name}</li>
                ))}
              </ul>
            );
          })()}
        </div>

        {/* Facility */}
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Facility{isRefresh ? ' *' : ''}</label>
          <input type="text" value={form.facility} onChange={(e) => update('facility', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" required={isRefresh} />
        </div>

        {/* Request Source */}
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Request Source *</label>
          <select value={form.request_source} onChange={(e) => update('request_source', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm">
            {REQUEST_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Priority</label>
          <select value={form.priority} onChange={(e) => update('priority', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm">
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Requester Name */}
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Requester Name *</label>
          <input type="text" value={form.requester_name} onChange={(e) => update('requester_name', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" required />
        </div>

        {/* Requester Email */}
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Requester Email *</label>
          <input type="email" value={form.requester_email} onChange={(e) => update('requester_email', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" required />
        </div>

        {/* Requester Phone */}
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Requester Phone</label>
          <input type="text" value={form.requester_phone} onChange={(e) => update('requester_phone', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" />
        </div>

      </div>

      {/* POC Section */}
      {!isRefresh && (
      <details className="border rounded-md p-3" style={{ borderColor: 'var(--color-border)' }}>
        <summary className="text-xs font-semibold cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>Point of Contact (optional)</summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>POC Name</label>
            <input type="text" value={form.poc_name} onChange={(e) => update('poc_name', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>POC Email</label>
            <input type="email" value={form.poc_email} onChange={(e) => update('poc_email', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>POC Phone</label>
            <input type="text" value={form.poc_phone} onChange={(e) => update('poc_phone', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>POC Address</label>
            <input type="text" value={form.poc_address} onChange={(e) => update('poc_address', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" />
          </div>
        </div>
      </details>
      )}

      {/* RMA Details */}
      {isRma && (
        <div className="border rounded-md p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
          <h4 className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>RMA Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Manufacturer *</label>
              <select value={form.rma_manufacturer} onChange={(e) => update('rma_manufacturer', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" required={isRma}>
                <option value="">Select manufacturer...</option>
                {(catalogs?.manufacturers || []).filter((m) => !m.workflow_key || m.workflow_key.split(',').includes('rma')).map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Product ID</label>
              <input type="text" value={form.rma_product_id} onChange={(e) => update('rma_product_id', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Serial Number</label>
              <input type="text" value={form.rma_serial_number} onChange={(e) => update('rma_serial_number', e.target.value.toUpperCase())} className="input-themed w-full px-3 py-2 rounded-md text-sm" disabled={form.rma_unserialized} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>MAC Address</label>
              <input type="text" value={form.rma_mac_address} onChange={(e) => update('rma_mac_address', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" disabled={form.rma_unserialized} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Issue Description</label>
            <textarea value={form.rma_issue_description} onChange={(e) => update('rma_issue_description', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" rows={3} />
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>
            <input type="checkbox" checked={form.rma_unserialized} onChange={(e) => update('rma_unserialized', e.target.checked)} />
            Unserialized / No MAC product
          </label>
        </div>
      )}

      {/* Refresh Details */}
      {isRefresh && (
        <div className="border rounded-md p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
          <h4 className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Asset / Issue Description</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Manufacturer *</label>
              <select value={form.refresh_manufacturer} onChange={(e) => update('refresh_manufacturer', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" required={isRefresh}>
                <option value="">Select manufacturer...</option>
                {(catalogs?.manufacturers || []).filter((m) => !m.workflow_key || m.workflow_key.split(',').includes('refresh')).map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Device Type *</label>
              <select value={form.refresh_device_type} onChange={(e) => update('refresh_device_type', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" required={isRefresh}>
                <option value="">Select device type...</option>
                {['Laptop', 'Chromebook', 'Tablet', 'Desktop', 'Dock', 'Monitor', 'Printer', 'Other'].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Serial Number *</label>
              <input type="text" value={form.refresh_serial_number} onChange={(e) => update('refresh_serial_number', e.target.value.toUpperCase())} className="input-themed w-full px-3 py-2 rounded-md text-sm" required={isRefresh} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Asset Tag</label>
              <input type="text" value={form.refresh_asset_tag} onChange={(e) => update('refresh_asset_tag', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Model Number</label>
              <input type="text" value={form.refresh_model} onChange={(e) => update('refresh_model', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Model Name</label>
              <input type="text" value={form.refresh_model_name} onChange={(e) => update('refresh_model_name', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Warranty End Date</label>
              <input type="date" value={form.refresh_warranty_end} onChange={(e) => update('refresh_warranty_end', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>ADP</label>
              <select value={form.refresh_adp} onChange={(e) => update('refresh_adp', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm">
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Issue Description *</label>
            <textarea value={form.refresh_issue_description} onChange={(e) => update('refresh_issue_description', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" rows={3} required={isRefresh} />
          </div>
          {form.refresh_adp === 'Yes' && (
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Damage Excuse</label>
            <textarea value={form.refresh_damage_excuse} onChange={(e) => update('refresh_damage_excuse', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" rows={3} />
          </div>
          )}
        </div>
      )}

      {/* Assignment */}
      <div className="max-w-[350px]">
        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Assign To *</label>
        <select value={form.assigned_to_username} onChange={(e) => update('assigned_to_username', e.target.value)} className="input-themed w-full px-3 py-2 rounded-md text-sm" required>
          <option value="">Select assignee...</option>
          {(() => {
            const wf = (catalogs?.workflows || []).find((w) => w.workflow_key === form.workflow_key);
            const teamId = wf?.assignment_team_id || wf?.owning_team_id;
            const members = teamId ? (catalogs?.membersByTeam?.[teamId] || []) : [];
            return (
              <>
                <option value="__team__">{wf?.assignment_team_label || wf?.owning_team_label || 'Team'} (Team Assignment)</option>
                <optgroup label="Individual">
                  {members.map((m) => <option key={m.upn} value={m.upn}>{m.display_name || m.upn}</option>)}
                </optgroup>
              </>
            );
          })()}
        </select>
      </div>

      <button type="submit" disabled={submitting} className="px-4 py-2 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
        {submitting ? 'Creating...' : 'Create Case'}
      </button>
    </form>
    </>
  );
}

export default function CasesClient() {
  const { activeWorkspace } = useWorkspace();
  const { fmt } = useTimezone();
  const router = useRouter();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [usersById, setUsersById] = useState({});
  const [teamsById, setTeamsById] = useState({});
  const [refLoading, setRefLoading] = useState(true);
  const [refError, setRefError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkWorkflow, setBulkWorkflow] = useState('refresh');
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [myCases, setMyCases] = useState([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myPage, setMyPage] = useState(1);
  const [myTotal, setMyTotal] = useState(0);
  const [myPages, setMyPages] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [myFilter, setMyFilter] = useState('all');
  const [mySortCol, setMySortCol] = useState('');
  const [mySortDir, setMySortDir] = useState('asc');
  const [myFilters, setMyFilters] = useState({ customer: '', workflow: '', stage: '', status: '' });
  const [teamCases, setTeamCases] = useState([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamPage, setTeamPage] = useState(1);
  const [teamTotal, setTeamTotal] = useState(0);
  const [teamPages, setTeamPages] = useState(0);
  const [sortBy, setSortBy] = useState('last_activity_at');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedCases, setSelectedCases] = useState(new Set());
  const [quoteCases, setQuoteCases] = useState(new Set());
  const [purchaseCases, setPurchaseCases] = useState(new Set());
  const [bulkOrderCases, setBulkOrderCases] = useState(new Set());
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [logisticsMembers, setLogisticsMembers] = useState([]);

  const isIntake = activeWorkspace === 'intake_administrators';
  const isRouteCoord = activeWorkspace === 'route_coordinators';
  const isOrderAdmin = activeWorkspace === 'order_administrators';
  const isQuoteAdmin = activeWorkspace === 'quote_administrators';
  const isComputerTech = activeWorkspace === 'computer_technicians';
  const [rcView, setRcView] = useState('ready');
  const [orderView, setOrderView] = useState('ordering');
  const [quoteView, setQuoteView] = useState('request');
  const [ctView, setCtView] = useState('team');
  const [ctStage, setCtStage] = useState('Diagnosing');
  const [myPageSize, setMyPageSize] = useState(50);
  const [teamPageSize, setTeamPageSize] = useState(50);
  const [filters, setFilters] = useState({ customer: '', workflow: '', manufacturer: '', model: '', model_name: '', defective_part: '', defective_part_number: '' });
  const [filterOptions, setFilterOptions] = useState({ customer: [], workflow: [], manufacturer: [], model: [], model_name: [], defective_part: [], defective_part_number: [] });

  useEffect(() => {
    async function fetchReferenceData() {
      setRefLoading(true);
      setRefError(null);
      try {
        const [refRes, meRes, catRes] = await Promise.all([
          fetch('/api/reference/lookups'),
          fetch('/api/auth/me'),
          fetch('/api/cases/catalogs'),
        ]);
        if (refRes.ok) {
          const result = await refRes.json();
          const { data } = result;
          if (data?.users) { const uMap = {}; data.users.forEach((u) => { uMap[u.id] = u.display_name || u.upn; }); setUsersById(uMap); }
          if (data?.teams) { const tMap = {}; data.teams.forEach((t) => { tMap[t.id] = t.label; }); setTeamsById(tMap); }
        }
        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUser(meData?.user || null);
        }
        if (catRes.ok) {
          const catData = await catRes.json();
          if (catData?.data?.membersByTeamKey?.logistics_technicians) setLogisticsMembers(catData.data.membersByTeamKey.logistics_technicians);
        }
      } catch { setRefError('Reference data unavailable. Showing raw IDs.'); }
      finally { setRefLoading(false); }
    }
    fetchReferenceData();
  }, []);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    if (activeWorkspace) params.set('team', activeWorkspace);
    const qs = params.toString() ? `?${params.toString()}` : '';
    try {
      const res = await fetch(`/api/cases${qs}`);
      if (!res.ok) throw new Error('Failed to load cases');
      const data = await res.json();
      setCases(data.data || []);
    } catch { setCases([]); setError('Unable to load cases. Please try again later.'); }
    finally { setLoading(false); }
  }, [searchTerm, activeWorkspace]);

  const fetchMyCases = useCallback(async () => {
    if (!isIntake) return;
    setMyLoading(true);
    const params = new URLSearchParams({ page: String(myPage), limit: String(myPageSize) });
    if (myFilter === 'mine' && currentUser?.username) params.set('created_by', currentUser.username);
    if (myFilters.customer) params.set('customer', myFilters.customer);
    if (myFilters.workflow) params.set('workflow', myFilters.workflow);
    if (myFilters.stage) params.set('stage', myFilters.stage);
    if (myFilters.status) params.set('status', myFilters.status);
    try {
      const res = await fetch(`/api/cases?${params.toString()}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setMyCases(data.data || []);
      setMyTotal(data.total || 0);
      setMyPages(data.pages || 0);
      if (data.data?.length) { try { sessionStorage.setItem('caseNavIds', JSON.stringify(data.data.map(c => c.id))); sessionStorage.setItem('caseNavBack', '/cases'); } catch {} }
    } catch { setMyCases([]); }
    finally { setMyLoading(false); }
  }, [isIntake, currentUser, myPage, myPageSize, myFilter, myFilters]);

  useEffect(() => { const timer = setTimeout(fetchCases, 300); return () => clearTimeout(timer); }, [fetchCases]);
  useEffect(() => { fetchMyCases(); }, [fetchMyCases]);

  useEffect(() => {
    if (!isOrderAdmin && !isQuoteAdmin) return;
    async function loadFilterOptions() {
      try {
        const params = new URLSearchParams({ limit: '0' });
        params.set('team', isOrderAdmin ? 'order_administrators' : 'quote_administrators');
        const res = await fetch(`/api/cases?${params.toString()}`);
        if (!res.ok) return;
        const { data } = await res.json();
        if (!data) return;
        const unique = (fn) => [...new Set(data.map(fn).filter(Boolean))].sort();
        const uniqueSplit = (fn) => [...new Set(data.flatMap(r => (fn(r) || '').split(',').map(s => s.trim())).filter(Boolean))].sort();
        setFilterOptions({
          customer: unique(r => r.customer_name),
          workflow: unique(r => r.workflow_key),
          manufacturer: unique(r => r.manufacturer),
          model: unique(r => r.model),
          model_name: unique(r => r.model_name),
          defective_part: [...uniqueSplit(r => r.defective_part), ...(isQuoteAdmin ? ['Pickup, Diagnosis, Repair & Delivery'] : [])].sort(),
          defective_part_number: [...uniqueSplit(r => r.defective_part_number), ...(isQuoteAdmin ? ['Service Fee'] : [])].sort(),
        });
      } catch {}
    }
    loadFilterOptions();
  }, [isOrderAdmin, isQuoteAdmin]);

  const fetchTeamCases = useCallback(async () => {
    if (isIntake || !activeWorkspace) return;
    setTeamLoading(true);
    const params = new URLSearchParams({ page: String(teamPage), limit: String(teamPageSize) });
    if (isRouteCoord) {
      if (rcView === 'ready') {
        params.set('team', 'route_coordinators');
        params.set('stage', 'Ready for Pickup,Ready for Delivery,Cancelled');
      } else if (rcView === 'scheduled') {
        params.set('team', 'logistics_technicians');
        params.set('stage', 'Pickup Scheduled,Delivery Scheduled,Cancelled');
      }
    } else if (isOrderAdmin) {
      params.set('team', 'order_administrators');
      params.set('stage', orderView === 'ordering' ? 'Ordering' : orderView === 'labor' ? 'Labor Claim' : 'Delivered');
    } else if (isQuoteAdmin) {
      params.set('team', 'quote_administrators');
      params.set('stage', quoteView === 'request' ? 'Quote Request' : quoteView === 'hold' ? 'Quote Request - Hold' : 'Quoted');
    } else if (isComputerTech && ctView === 'mine' && currentUser?.username) {
      params.set('team', 'computer_technicians');
      params.set('assigned_to', currentUser.username);
      params.set('stage', ctStage);
    } else if (isComputerTech) {
      params.set('team', 'computer_technicians');
      params.set('stage', ctStage);
    } else {
      params.set('team', activeWorkspace);
    }
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    if ((isOrderAdmin || isQuoteAdmin) && filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (!v.trim()) return;
        if (k === 'defective_part' && v === 'Pickup, Diagnosis, Repair & Delivery') { params.set('has_repair_success', 'true'); return; }
        if (k === 'defective_part_number' && v === 'Service Fee') { params.set('has_repair_success', 'true'); return; }
        params.set(k, v.trim());
      });
    }
    params.set('sort_by', sortBy);
    params.set('sort_dir', sortDir);
    try {
      const res = await fetch(`/api/cases?${params.toString()}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTeamCases(data.data || []);
      setTeamTotal(data.total || 0);
      setTeamPages(data.pages || 0);
      if (data.data?.length) { try { sessionStorage.setItem('caseNavIds', JSON.stringify(data.data.map(c => c.id))); sessionStorage.setItem('caseNavBack', '/cases'); } catch {} }
    } catch { setTeamCases([]); }
    finally { setTeamLoading(false); }
  }, [isIntake, isRouteCoord, isOrderAdmin, isQuoteAdmin, isComputerTech, rcView, orderView, quoteView, ctView, ctStage, activeWorkspace, teamPage, teamPageSize, searchTerm, currentUser, sortBy, sortDir, filters]);

  useEffect(() => { const timer = setTimeout(fetchTeamCases, 300); return () => clearTimeout(timer); }, [fetchTeamCases]);

  function resolveUser(userId) { if (!userId) return '-'; if (refLoading) return '...'; return usersById[userId] || userId; }
  function resolveTeam(teamId) { if (!teamId) return '-'; if (refLoading) return '...'; return teamsById[teamId] || teamId; }
  function toggleSort(col) { if (sortBy === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setSortBy(col); setSortDir('asc'); } setTeamPage(1); }
  function sortIcon(col) { if (sortBy !== col) return ''; return sortDir === 'asc' ? ' ▲' : ' ▼'; }

  return (
    <div className={`py-8 mx-auto ${isOrderAdmin || isQuoteAdmin ? 'max-w-full px-4' : 'max-w-[1200px]'}`}>

      {/* Header with create button for intake admins */}
      <div className="flex items-center justify-between mb-6">
        {!showCreate && (
          <input
            type="text"
            placeholder={isRouteCoord ? "Search cases by number, facility, customer, or resource..." : "Search cases by number, serial number, or customer..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-themed w-full max-w-[400px] px-3 py-2 rounded-md text-sm"
          />
        )}
        {isIntake && (
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
            >
              {showCreate ? 'Close Form' : '+ Create Case'}
            </button>
            <button
              onClick={() => { setBulkOpen(true); setBulkResult(null); setBulkFile(null); }}
              className="px-4 py-2 rounded-md text-sm font-semibold text-white bg-gray-700 hover:bg-gray-800 whitespace-nowrap"
            >
              Bulk Import
            </button>
          </div>
        )}
      </div>

      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Bulk Import Cases</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Workflow</label>
              <select value={bulkWorkflow} onChange={(e) => setBulkWorkflow(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm">
                <option value="refresh">Refresh</option>
                <option value="rma">RMA</option>
              </select>
            </div>
            <div className="mb-4">
              <button onClick={() => { window.location.href = `/api/cases/bulk-import?workflow=${bulkWorkflow}`; }} className="px-4 py-2 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700">⬇️ Download Template</button>
            </div>
            <hr className="my-4 border-slate-200" />
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload Completed Template</label>
              <input type="file" accept=".xlsx,.xls" onChange={(e) => setBulkFile(e.target.files[0] || null)} className="text-sm" />
            </div>
            {bulkResult && (
              <div className={`mb-4 px-3 py-2 rounded text-sm ${bulkResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {bulkResult.ok ? `✅ Created ${bulkResult.created} case(s)` : `❌ ${bulkResult.error}`}
                {bulkResult.errors?.length > 0 && <ul className="mt-1 text-xs">{bulkResult.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setBulkOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Close</button>
              <button onClick={async () => {
                if (!bulkFile) return;
                setBulkUploading(true); setBulkResult(null);
                const fd = new FormData(); fd.append('file', bulkFile); fd.append('workflow', bulkWorkflow);
                try {
                  const res = await fetch('/api/cases/bulk-import', { method: 'POST', body: fd });
                  const d = await res.json();
                  setBulkResult(res.ok ? { ok: true, ...d } : { ok: false, error: d.error || 'Import failed', errors: d.errors });
                  if (res.ok) { fetchCases(); fetchMyCases(); }
                } catch { setBulkResult({ ok: false, error: 'Network error' }); }
                finally { setBulkUploading(false); }
              }} disabled={!bulkFile || bulkUploading} className="px-4 py-2 text-sm font-semibold rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">{bulkUploading ? 'Importing...' : 'Import'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Case creation form */}
      {isIntake && showCreate && (
        <div className="mb-8 p-5 rounded-lg border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}>
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Create New Case</h3>
          <CaseCreateForm onCreated={() => { fetchCases(); fetchMyCases(); }} usersById={usersById} teamsById={teamsById} />
        </div>
      )}

      {/* My Created Cases — intake admins only, hidden when create form is open */}
      {isIntake && !showCreate && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Created Cases {myTotal > 0 && <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>({myTotal})</span>}</h3>
          </div>
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            {[['customer', 'Customer'], ['workflow', 'Workflow'], ['stage', 'Stage'], ['status', 'Status']].map(([key, label]) => (
              <select key={key} value={myFilters[key]} onChange={(e) => { setMyFilters(f => ({ ...f, [key]: e.target.value })); setMyPage(1); }} className="input-themed px-2 py-1 rounded text-xs">
                <option value="">{label}: All</option>
                {[...new Set(myCases.map(c => key === 'customer' ? c.customer_name : key === 'workflow' ? c.workflow_key : c[key]).filter(Boolean))].sort().map(v => <option key={v} value={v}>{key === 'workflow' ? (v === 'rma' ? 'RMA' : v.charAt(0).toUpperCase() + v.slice(1)) : v}</option>)}
              </select>
            ))}
            {Object.values(myFilters).some(v => v) && <button onClick={() => { setMyFilters({ customer: '', workflow: '', stage: '', status: '' }); setMyPage(1); }} className="px-2 py-1 rounded text-xs font-medium border hover:bg-red-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>✕ Clear</button>}
            <div className="ml-auto"><select value={myFilter} onChange={(e) => { setMyFilter(e.target.value); setMyPage(1); }} className="input-themed px-2 py-1 rounded text-xs" style={{ color: 'var(--color-text-primary)' }}><option value="all">All Cases</option><option value="mine">Created by Me</option></select></div>
          </div>
          {myLoading && <div className="text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>Loading...</div>}
          {!myLoading && myCases.length === 0 && <div className="text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>No cases created yet</div>}
          {!myLoading && myCases.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ background: 'var(--color-surface-raised)' }}>
                      <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => { setMySortCol(c => c === 'case_number' ? 'case_number' : 'case_number'); setMySortDir(d => mySortCol === 'case_number' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); setMySortCol('case_number'); }}>Case Number{mySortCol === 'case_number' ? (mySortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                      <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => { if (mySortCol === 'customer_name') setMySortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setMySortCol('customer_name'); setMySortDir('asc'); } }}>Customer{mySortCol === 'customer_name' ? (mySortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                      <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => { if (mySortCol === 'workflow_key') setMySortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setMySortCol('workflow_key'); setMySortDir('asc'); } }}>Workflow{mySortCol === 'workflow_key' ? (mySortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                      <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => { if (mySortCol === 'stage') setMySortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setMySortCol('stage'); setMySortDir('asc'); } }}>Stage{mySortCol === 'stage' ? (mySortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                      <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Serial Number</th>
                      <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => { if (mySortCol === 'status') setMySortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setMySortCol('status'); setMySortDir('asc'); } }}>Status{mySortCol === 'status' ? (mySortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                      <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => { if (mySortCol === 'priority') setMySortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setMySortCol('priority'); setMySortDir('asc'); } }}>Priority{mySortCol === 'priority' ? (mySortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                      <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => { if (mySortCol === 'last_activity_at') setMySortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setMySortCol('last_activity_at'); setMySortDir('asc'); } }}>Last Activity{mySortCol === 'last_activity_at' ? (mySortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...myCases].sort((a, b) => { if (!mySortCol) return 0; let av = a[mySortCol] || '', bv = b[mySortCol] || ''; av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); if (av < bv) return mySortDir === 'asc' ? -1 : 1; if (av > bv) return mySortDir === 'asc' ? 1 : -1; return 0; }).map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}><Link href={`/cases/${c.id}`} className="text-blue-600 underline">{c.case_number}</Link></td>
                        <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.customer_name}</td>
                        <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.workflow_key === 'rma' ? 'RMA' : c.workflow_key ? c.workflow_key.charAt(0).toUpperCase() + c.workflow_key.slice(1) : '-'}</td>
                        <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.stage}</td>
                        <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.serial_number || '-'}</td>
                        <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.status}</td>
                        <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.priority}</td>
                        <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.last_activity_at ? fmt(c.last_activity_at) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {myPages > 1 && (
                <div className="flex items-center gap-3 mt-3">
                  <button disabled={myPage <= 1} onClick={() => setMyPage(myPage - 1)} className="px-3 py-1 rounded text-xs font-medium border disabled:opacity-40" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>← Prev</button>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Page {myPage} of {myPages}</span>
                  <button disabled={myPage >= myPages} onClick={() => setMyPage(myPage + 1)} className="px-3 py-1 rounded text-xs font-medium border disabled:opacity-40" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Next →</button>
                </div>
              )}
              <div className="flex items-center mt-2" style={{ justifyContent: 'flex-end' }}>
                <label className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>Rows per page:
                  <select value={myPageSize} onChange={(e) => { setMyPageSize(Number(e.target.value)); setMyPage(1); }} className="input-themed px-1 py-0.5 rounded text-xs">
                    <option value={50}>50</option><option value={100}>100</option><option value={200}>200</option>
                  </select>
                </label>
              </div>
            </>
          )}
        </div>
      )}

      {/* Team case list for non-intake workspaces */}
      {!isIntake && (
        <div className="mb-8">
          {isRouteCoord && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <button onClick={() => { setRcView('ready'); setTeamPage(1); setSelectedCases(new Set()); }} className={`px-3 py-1.5 rounded text-xs font-semibold ${rcView === 'ready' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-gray-700 hover:bg-slate-50'}`}>Ready for Pickup / Delivery</button>
              <button onClick={() => { setRcView('scheduled'); setTeamPage(1); setSelectedCases(new Set()); }} className={`px-3 py-1.5 rounded text-xs font-semibold ${rcView === 'scheduled' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-gray-700 hover:bg-slate-50'}`}>Pickup / Delivery Scheduled</button>
            </div>
          )}
          {isOrderAdmin && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <button onClick={() => { setOrderView('ordering'); setTeamPage(1); }} className={`px-3 py-1.5 rounded text-xs font-semibold ${orderView === 'ordering' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-gray-700 hover:bg-slate-50'}`}>Ordering</button>
              <button onClick={() => { setOrderView('labor'); setTeamPage(1); }} className={`px-3 py-1.5 rounded text-xs font-semibold ${orderView === 'labor' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-gray-700 hover:bg-slate-50'}`}>Labor Claim</button>
              <button onClick={() => { setOrderView('review'); setTeamPage(1); }} className={`px-3 py-1.5 rounded text-xs font-semibold ${orderView === 'review' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-gray-700 hover:bg-slate-50'}`}>Review</button>
            </div>
          )}
          {isQuoteAdmin && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <button onClick={() => { setQuoteView('request'); setTeamPage(1); setQuoteCases(new Set()); }} className={`px-3 py-1.5 rounded text-xs font-semibold ${quoteView === 'request' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-gray-700 hover:bg-slate-50'}`}>Quote Request</button>
              <button onClick={() => { setQuoteView('hold'); setTeamPage(1); setQuoteCases(new Set()); }} className={`px-3 py-1.5 rounded text-xs font-semibold ${quoteView === 'hold' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-gray-700 hover:bg-slate-50'}`}>Quote Request - Hold</button>
              <button onClick={() => { setQuoteView('quoted'); setTeamPage(1); setQuoteCases(new Set()); }} className={`px-3 py-1.5 rounded text-xs font-semibold ${quoteView === 'quoted' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-gray-700 hover:bg-slate-50'}`}>Quoted</button>
            </div>
          )}
          {isComputerTech && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <button onClick={() => { setCtStage('Diagnosing'); setTeamPage(1); }} className={`px-3 py-1.5 rounded text-xs font-semibold ${ctStage === 'Diagnosing' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-gray-700 hover:bg-slate-50'}`}>Diagnosing</button>
              <button onClick={() => { setCtStage('Repairing'); setTeamPage(1); }} className={`px-3 py-1.5 rounded text-xs font-semibold ${ctStage === 'Repairing' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-gray-700 hover:bg-slate-50'}`}>Repairing</button>
              <button onClick={() => { setCtStage('Depot Repair'); setTeamPage(1); }} className={`px-3 py-1.5 rounded text-xs font-semibold ${ctStage === 'Depot Repair' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-gray-700 hover:bg-slate-50'}`}>Depot Repair</button>
            </div>
          )}
          {teamLoading && <div className="text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>Loading cases...</div>}
          {(isOrderAdmin || isQuoteAdmin) && (
            <div className="flex flex-wrap gap-2 mb-2 items-center">
              {[['customer', 'Customer'], ['workflow', 'Workflow'], ['manufacturer', 'Manufacturer'], ['model', 'Model Number'], ['model_name', 'Model Name'], ['defective_part', 'Part'], ['defective_part_number', 'Part Number']].map(([key, label]) => (
                <select key={key} value={filters[key]} onChange={(e) => { setFilters(f => ({ ...f, [key]: e.target.value })); setTeamPage(1); }} className="input-themed px-2 py-1 rounded text-xs">
                  <option value="">All {label}s</option>
                  {filterOptions[key].map(v => <option key={v} value={v}>{key === 'workflow' ? (v === 'rma' ? 'RMA' : v.charAt(0).toUpperCase() + v.slice(1)) : v}</option>)}
                </select>
              ))}
              {Object.values(filters).some(v => v) && <button onClick={() => { setFilters({ customer: '', workflow: '', manufacturer: '', model: '', model_name: '', defective_part: '', defective_part_number: '' }); setTeamPage(1); }} className="px-2 py-1 rounded text-xs font-medium border hover:bg-red-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>✕ Clear</button>}
            </div>
          )}
          {!teamLoading && teamCases.length === 0 && <div className="text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>No cases found</div>}
          {!teamLoading && teamCases.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{teamTotal} case{teamTotal !== 1 ? 's' : ''}{isRouteCoord && selectedCases.size > 0 ? ` · ${selectedCases.size} selected` : ''}{isQuoteAdmin && quoteCases.size > 0 ? ` · ${quoteCases.size} selected` : ''}{isQuoteAdmin && purchaseCases.size > 0 ? ` · ${purchaseCases.size} selected` : ''}{isQuoteAdmin && bulkOrderCases.size > 0 ? ` · ${bulkOrderCases.size} bulk order` : ''}</span>
                <div className="flex gap-2">
                {isRouteCoord && selectedCases.size > 0 && <button onClick={() => setBulkEditOpen(true)} className="px-3 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700">Edit Selected</button>}
                {isQuoteAdmin && quoteView === 'request' && quoteCases.size > 0 && <button onClick={() => { const selected = teamCases.filter(c => quoteCases.has(c.id)); const headers = ['Case Number','Customer','Serial Number','Manufacturer','Model Number','Model Name','Part(s)','Part Number(s)']; const rows = selected.map(c => [c.case_number||'',c.customer_name||'',c.serial_number||'',c.manufacturer||'',c.model||'',c.model_name||'',c.defective_part||'',c.defective_part_number||''].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')); const csv = [headers.join(','),...rows].join('\n'); const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.setAttribute('href',url); a.setAttribute('download','quote_export.csv'); a.style.display='none'; document.body.appendChild(a); a.click(); setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},500); setQuoteDialogOpen(true); }} className="px-3 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700">Create Quote</button>}
                {isQuoteAdmin && quoteView === 'quoted' && purchaseCases.size > 0 && <button onClick={() => setPurchaseDialogOpen(true)} className="px-3 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700">Add Purchase Info</button>}
                {isQuoteAdmin && bulkOrderCases.size > 0 && <button onClick={() => { const selected = teamCases.filter(c => bulkOrderCases.has(c.id)); const merged = {}; selected.forEach(c => { const names = (c.defective_part || '').split(',').map(s => s.trim()); const numbers = (c.defective_part_number || '').split(',').map(s => s.trim()); numbers.forEach((pn, i) => { if (!pn) return; const name = names[i] || names[0] || ''; if (merged[pn]) { merged[pn].quantity += 1; } else { merged[pn] = { part_name: name, part_number: pn, quantity: 1 }; } }); }); const lines = Object.values(merged).map(m => ({ part_name: m.part_name, part_number: m.part_number, quantity: String(m.quantity), cost: '', unit_price: '', quote: '', sales_order: '', vendor_order_number: '', vendor: '' })); if (lines.length === 0) return; localStorage.setItem('bulkOrderPrefill', JSON.stringify(lines)); localStorage.setItem('bulkOrderCaseIds', JSON.stringify(selected.map(c => c.id))); router.push('/bulk-orders'); }} className="px-3 py-1 rounded text-xs font-semibold bg-green-600 text-white hover:bg-green-700">Send to Bulk Orders</button>}
                </div>
                {isComputerTech && (
                  <select value={ctView} onChange={(e) => { setCtView(e.target.value); setTeamPage(1); }} className="input-themed px-2 py-1 rounded text-xs" style={{ color: 'var(--color-text-primary)' }}>
                    <option value="team">Team Cases</option>
                    <option value="mine">My Cases</option>
                  </select>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ background: 'var(--color-surface-raised)' }}>
                      <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('case_number')}>Case Number{sortIcon('case_number')}</th>
                      <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('customer_name')}>Customer{sortIcon('customer_name')}</th>
                      {isRouteCoord && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('facility')}>Facility{sortIcon('facility')}</th>}
                      {isRouteCoord && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('stage')}>Stage{sortIcon('stage')}</th>}
                      {isRouteCoord && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Serial Number</th>}
                      {!isRouteCoord && !isComputerTech && !isOrderAdmin && !isQuoteAdmin && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Assigned To</th>}
                      {!isRouteCoord && !isComputerTech && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('workflow_key')}>Workflow{sortIcon('workflow_key')}</th>}
                      {isComputerTech && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Serial Number</th>}
                      {isComputerTech && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Model Name</th>}
                      {(isOrderAdmin || isQuoteAdmin) && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Serial Number</th>}
                      {(isOrderAdmin || isQuoteAdmin) && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('manufacturer')}>Manufacturer{sortIcon('manufacturer')}</th>}
                      {(isOrderAdmin || isQuoteAdmin) && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('model')}>Model Number{sortIcon('model')}</th>}
                      {(isOrderAdmin || isQuoteAdmin) && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('model_name')}>Model Name{sortIcon('model_name')}</th>}
                      {(isOrderAdmin || isQuoteAdmin) && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Warranty End</th>}
                      {(isOrderAdmin || isQuoteAdmin) && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>ADP</th>}
                      {(isOrderAdmin || isQuoteAdmin) && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Issue Description</th>}
                      {(isOrderAdmin || isQuoteAdmin) && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Diagnostic Note</th>}
                      {(isOrderAdmin || isQuoteAdmin) && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('defective_part')}>Part{sortIcon('defective_part')}</th>}
                      {(isOrderAdmin || isQuoteAdmin) && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('defective_part_number')}>Part Number{sortIcon('defective_part_number')}</th>}
                      {isOrderAdmin && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Condition</th>}
                      {isQuoteAdmin && quoteView === 'request' && <th className="px-4 py-3 border-b-2 text-center whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}><span className="block text-xs font-semibold mb-1">Quote</span><input type="checkbox" checked={teamCases.length > 0 && teamCases.every(c => quoteCases.has(c.id))} onChange={(e) => { if (e.target.checked) { setQuoteCases(new Set(teamCases.map(c => c.id))); } else { setQuoteCases(new Set()); } }} /></th>}
                      {isQuoteAdmin && quoteView === 'quoted' && <th className="px-4 py-3 border-b-2 text-center whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}><span className="block text-xs font-semibold mb-1">Purchase</span><input type="checkbox" checked={teamCases.length > 0 && teamCases.every(c => purchaseCases.has(c.id))} onChange={(e) => { if (e.target.checked) { setPurchaseCases(new Set(teamCases.map(c => c.id))); } else { setPurchaseCases(new Set()); } }} /></th>}
                      {isQuoteAdmin && <th className="px-4 py-3 border-b-2 text-center whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}><span className="block text-xs font-semibold mb-1">Bulk Order</span><input type="checkbox" checked={teamCases.length > 0 && teamCases.every(c => bulkOrderCases.has(c.id))} onChange={(e) => { if (e.target.checked) { setBulkOrderCases(new Set(teamCases.map(c => c.id))); } else { setBulkOrderCases(new Set()); } }} /></th>}
                      {!isRouteCoord && !isComputerTech && !isOrderAdmin && !isQuoteAdmin && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('stage')}>Stage{sortIcon('stage')}</th>}
                      {!isRouteCoord && !isComputerTech && !isOrderAdmin && !isQuoteAdmin && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Serial Number</th>}
                      {!isRouteCoord && !isComputerTech && !isOrderAdmin && !isQuoteAdmin && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('status')}>Status{sortIcon('status')}</th>}
                      {!isRouteCoord && !isOrderAdmin && !isQuoteAdmin && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('priority')}>Priority{sortIcon('priority')}</th>}
                      {!isOrderAdmin && !isQuoteAdmin && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('last_activity_at')}>Last Activity{sortIcon('last_activity_at')}</th>}
                      {isRouteCoord && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>Failures</th>}
                      {isRouteCoord && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('scheduled_date')}>Scheduled Date{sortIcon('scheduled_date')}</th>}
                      {isRouteCoord && <th className="font-semibold text-left px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer select-none" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }} onClick={() => toggleSort('resource')}>Resource{sortIcon('resource')}</th>}
                      {isRouteCoord && <th className="px-4 py-3 border-b-2 w-8" style={{ borderColor: 'var(--color-border)' }}><input type="checkbox" checked={teamCases.length > 0 && teamCases.every(c => selectedCases.has(c.id))} onChange={(e) => { if (e.target.checked) { setSelectedCases(new Set(teamCases.map(c => c.id))); } else { setSelectedCases(new Set()); } }} /></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {teamCases.map((c) => (
                      <tr key={c.id} style={(isQuoteAdmin && c.diagnostic_note?.startsWith('Additional Part Request:')) ? { outline: '2px solid #ef4444', outlineOffset: '-1px' } : undefined}>
                        <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}><Link href={`/cases/${c.id}`} className="text-blue-600 underline">{c.case_number}</Link></td>
                        <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.customer_name}</td>
                        {isRouteCoord && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.facility || '-'}</td>}
                        {isRouteCoord && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.stage === 'Cancelled' ? (c.scheduled_delivery_date ? 'Cancelled (Delivery Scheduled)' : 'Cancelled (Ready for Delivery)') : (c.stage || '-')}</td>}
                        {isRouteCoord && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.serial_number || '-'}</td>}
                        {!isRouteCoord && !isComputerTech && !isOrderAdmin && !isQuoteAdmin && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{resolveUser(c.assigned_to_user_id)}</td>}
                        {!isRouteCoord && !isComputerTech && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.workflow_key === 'rma' ? 'RMA' : c.workflow_key ? c.workflow_key.charAt(0).toUpperCase() + c.workflow_key.slice(1) : '-'}</td>}
                        {isComputerTech && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.serial_number || '-'}</td>}
                        {isComputerTech && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.model_name || '-'}</td>}
                        {(isOrderAdmin || isQuoteAdmin) && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.serial_number || '-'}</td>}
                        {(isOrderAdmin || isQuoteAdmin) && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.manufacturer || '-'}</td>}
                        {(isOrderAdmin || isQuoteAdmin) && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.model || '-'}</td>}
                        {(isOrderAdmin || isQuoteAdmin) && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.model_name || '-'}</td>}
                        {(isOrderAdmin || isQuoteAdmin) && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.warranty_end || '-'}</td>}
                        {(isOrderAdmin || isQuoteAdmin) && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.adp || '-'}</td>}
                        {(isOrderAdmin || isQuoteAdmin) && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{isQuoteAdmin && quoteView === 'request' && c.has_repair_success ? 'N/A' : (c.issue_description || '-')}</td>}
                        {(isOrderAdmin || isQuoteAdmin) && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{isQuoteAdmin && quoteView === 'request' && c.has_repair_success ? 'N/A' : (c.diagnostic_note || '-')}</td>}
                        {(isOrderAdmin || isQuoteAdmin) && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{isQuoteAdmin && quoteView === 'request' && c.has_repair_success ? 'Pickup, Diagnosis, Repair & Delivery' : (c.defective_part || '-')}</td>}
                        {(isOrderAdmin || isQuoteAdmin) && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{isQuoteAdmin && quoteView === 'request' && c.has_repair_success ? 'Service Fee' : (c.defective_part_number || '-')}</td>}
                        {isOrderAdmin && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.defective_part_condition || '-'}</td>}
                        {isQuoteAdmin && quoteView === 'request' && <td className="px-4 py-3 border-b text-center" style={{ borderColor: 'var(--color-border)' }}><input type="checkbox" checked={quoteCases.has(c.id)} onChange={(e) => { const next = new Set(quoteCases); if (e.target.checked) next.add(c.id); else next.delete(c.id); setQuoteCases(next); }} /></td>}
                        {isQuoteAdmin && quoteView === 'quoted' && <td className="px-4 py-3 border-b text-center" style={{ borderColor: 'var(--color-border)' }}><input type="checkbox" checked={purchaseCases.has(c.id)} onChange={(e) => { const next = new Set(purchaseCases); if (e.target.checked) next.add(c.id); else next.delete(c.id); setPurchaseCases(next); }} /></td>}
                        {isQuoteAdmin && <td className="px-4 py-3 border-b text-center" style={{ borderColor: 'var(--color-border)' }}><input type="checkbox" checked={bulkOrderCases.has(c.id)} onChange={(e) => { const next = new Set(bulkOrderCases); if (e.target.checked) next.add(c.id); else next.delete(c.id); setBulkOrderCases(next); }} /></td>}
                        {!isRouteCoord && !isComputerTech && !isOrderAdmin && !isQuoteAdmin && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.stage}</td>}
                        {!isRouteCoord && !isComputerTech && !isOrderAdmin && !isQuoteAdmin && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.serial_number || '-'}</td>}
                        {!isRouteCoord && !isComputerTech && !isOrderAdmin && !isQuoteAdmin && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.status}</td>}
                        {!isRouteCoord && !isOrderAdmin && !isQuoteAdmin && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.priority}</td>}
                        {!isOrderAdmin && !isQuoteAdmin && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.last_activity_at ? fmt(c.last_activity_at) : '-'}</td>}
                        {isRouteCoord && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{(c.stage === 'Ready for Delivery' || c.stage === 'Delivery Scheduled' || c.stage === 'Cancelled') ? (c.delivery_failure_count || 0) : (c.pickup_failure_count || 0)}</td>}
                        {isRouteCoord && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.stage === 'Ready for Delivery' || c.stage === 'Cancelled' ? (c.scheduled_delivery_date || '-') : (c.scheduled_pickup_date || '-')}</td>}
                        {isRouteCoord && <td className="px-4 py-3 border-b" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>{c.stage === 'Ready for Delivery' || c.stage === 'Cancelled' ? (c.delivery_resource || '-') : (c.pickup_resource || '-')}</td>}
                        {isRouteCoord && <td className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}><input type="checkbox" checked={selectedCases.has(c.id)} onChange={(e) => { const next = new Set(selectedCases); if (e.target.checked) next.add(c.id); else next.delete(c.id); setSelectedCases(next); }} /></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {teamPages > 1 && (
                <div className="flex items-center gap-3 mt-3">
                  <button disabled={teamPage <= 1} onClick={() => setTeamPage(teamPage - 1)} className="px-3 py-1 rounded text-xs font-medium border disabled:opacity-40" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>← Prev</button>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Page {teamPage} of {teamPages}</span>
                  <button disabled={teamPage >= teamPages} onClick={() => setTeamPage(teamPage + 1)} className="px-3 py-1 rounded text-xs font-medium border disabled:opacity-40" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>Next →</button>
                </div>
              )}
              <div className="flex items-center mt-2" style={{ justifyContent: 'flex-end' }}>
                <label className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>Rows per page:
                  <select value={teamPageSize} onChange={(e) => { setTeamPageSize(Number(e.target.value)); setTeamPage(1); }} className="input-themed px-1 py-0.5 rounded text-xs">
                    <option value={50}>50</option><option value={100}>100</option><option value={200}>200</option>
                  </select>
                </label>
              </div>
            </>
          )}
        </div>
      )}

      {/* Bulk Edit Modal */}
      {bulkEditOpen && <BulkEditModal caseIds={[...selectedCases]} cases={teamCases} logisticsMembers={logisticsMembers} onClose={() => setBulkEditOpen(false)} onSaved={() => { setBulkEditOpen(false); setSelectedCases(new Set()); fetchTeamCases(); }} />}
      {quoteDialogOpen && <QuoteDialog cases={teamCases.filter(c => quoteCases.has(c.id))} onClose={() => setQuoteDialogOpen(false)} onSaved={() => { setQuoteDialogOpen(false); setQuoteCases(new Set()); fetchTeamCases(); }} />}
      {purchaseDialogOpen && <PurchaseDialog cases={teamCases.filter(c => purchaseCases.has(c.id))} onClose={() => setPurchaseDialogOpen(false)} onSaved={() => { setPurchaseDialogOpen(false); setPurchaseCases(new Set()); fetchTeamCases(); }} />}
    </div>
  );
}

function BulkEditModal({ caseIds, cases, logisticsMembers, onClose, onSaved }) {
  const [form, setForm] = useState({ date: '', resource: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [customTeams, setCustomTeams] = useState([]);

  useEffect(() => { fetch('/api/logistics-teams').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setCustomTeams(d.data); }).catch(() => {}); }, []);

  function update(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Group case IDs by stage to determine which fields to update
      const pickupIds = caseIds.filter(id => { const c = cases.find(x => x.id === id); return c?.stage !== 'Ready for Delivery' && c?.stage !== 'Cancelled'; });
      const deliveryIds = caseIds.filter(id => { const c = cases.find(x => x.id === id); return c?.stage === 'Ready for Delivery' || c?.stage === 'Cancelled'; });

      const requests = [];
      if (pickupIds.length) {
        requests.push(fetch('/api/cases/bulk-logistics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case_ids: pickupIds, scheduled_pickup_date: form.date, pickup_resource: form.resource }) }));
      }
      if (deliveryIds.length) {
        requests.push(fetch('/api/cases/bulk-logistics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case_ids: deliveryIds, scheduled_delivery_date: form.date, delivery_resource: form.resource }) }));
      }
      const results = await Promise.all(requests);
      if (results.some(r => !r.ok)) { setError('Some updates failed'); return; }
      onSaved();
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-gray-800 mb-4">Bulk Update — {caseIds.length} case{caseIds.length !== 1 ? 's' : ''}</h3>
        {error && <div className="text-xs text-red-600 mb-3">{error}</div>}
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Scheduled Date</label>
            <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Resource</label>
            <select value={form.resource} onChange={(e) => update('resource', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
              <option value="">Select resource...</option>
              {customTeams.length > 0 && <optgroup label="Custom Teams">{customTeams.map((t) => <option key={t.id} value={`[Team] ${t.name}`}>{t.name}</option>)}</optgroup>}
              <optgroup label="Individual">{(logisticsMembers || []).map((m) => <option key={m.upn} value={m.display_name || m.upn}>{m.display_name || m.upn}</option>)}</optgroup>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm rounded border border-slate-200 text-gray-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-1.5 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">{saving ? 'Saving...' : 'Update'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuoteDialog({ cases, onClose, onSaved }) {
  const [quoteNumber, setQuoteNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const isSpringISD = cases.some(c => c.program === 'Refresh - Spring ISD');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!quoteNumber.trim()) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/cases/order-details', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_ids: cases.map(c => c.id), quote_number: quoteNumber.trim(), po: isSpringISD && poNumber.trim() ? poNumber.trim() : undefined })
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to save'); setSaving(false); return; }
      onSaved();
    } catch { setError('Network error'); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="rounded-lg shadow-xl p-6 w-full max-w-md" style={{ background: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Create Quote</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>{cases.length} case{cases.length !== 1 ? 's' : ''} selected</p>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Use the downloaded CSV to upload and generate quote and then enter quote number.</p>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Quote Number *</label>
          <input type="text" value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value.toUpperCase())} required className="input-themed w-full px-3 py-2 rounded-md text-sm mb-4" placeholder="Enter quote number..." />
          {isSpringISD && (<>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>PO Number</label>
            <input type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value.toUpperCase())} className="input-themed w-full px-3 py-2 rounded-md text-sm mb-4" placeholder="Enter PO number..." />
          </>)}
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm rounded border border-slate-200 text-gray-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-1.5 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">{saving ? 'Saving...' : 'Add Quote Number'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PurchaseDialog({ cases, onClose, onSaved }) {
  const [form, setForm] = useState({ po: '', vendor: '', vendor_order_number: '', quote_number: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);

  useEffect(() => {
    const ids = cases.map(c => c.id).join(',');
    fetch(`/api/cases/order-details/quotes?case_ids=${ids}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.data) { setQuotes(d.data); if (d.data.length === 1) setForm(f => ({ ...f, quote_number: d.data[0] })); }
    }).catch(() => {}).finally(() => setLoadingQuotes(false));
  }, [cases]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.po.trim()) return;
    if (quotes.length > 1 && !form.quote_number) { setError('Please select a quote'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/cases/purchase-info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_ids: cases.map(c => c.id), po: form.po.trim(), vendor: form.vendor.trim(), vendor_order_number: form.vendor_order_number.trim(), quote_number: form.quote_number || quotes[0] || null })
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to save'); setSaving(false); return; }
      onSaved();
    } catch { setError('Network error'); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="rounded-lg shadow-xl p-6 w-full max-w-md" style={{ background: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Add Purchase Info</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>{cases.length} case{cases.length !== 1 ? 's' : ''} selected</p>
        {loadingQuotes ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p> : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {quotes.length > 1 && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Quote *</label>
            <select value={form.quote_number} onChange={(e) => setForm(f => ({ ...f, quote_number: e.target.value }))} required className="input-themed w-full px-3 py-2 rounded-md text-sm">
              <option value="">Select quote...</option>
              {quotes.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>PO *</label>
            <input type="text" value={form.po} onChange={(e) => setForm(f => ({ ...f, po: e.target.value }))} required className="input-themed w-full px-3 py-2 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Vendor</label>
            <input type="text" value={form.vendor} onChange={(e) => setForm(f => ({ ...f, vendor: e.target.value }))} className="input-themed w-full px-3 py-2 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Vendor Order Number</label>
            <input type="text" value={form.vendor_order_number} onChange={(e) => setForm(f => ({ ...f, vendor_order_number: e.target.value }))} className="input-themed w-full px-3 py-2 rounded-md text-sm" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm rounded border border-slate-200 text-gray-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-1.5 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
