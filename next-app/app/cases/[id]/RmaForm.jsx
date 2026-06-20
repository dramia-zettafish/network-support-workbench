'use client';

import { useState, useEffect, useCallback } from 'react';

const RMA_STATUS_OPTIONS = ['', 'Pending', 'Approved', 'Denied', 'Shipped', 'Received', 'Completed', 'Cancelled'];
const ENTITLEMENT_STATUS_OPTIONS = ['Pending', 'Entitled', 'Denied', 'Product End of Life', 'Not Required'];

const RMA_FIELDS = [
  { key: 'manufacturer', label: 'Manufacturer', type: 'input' },
  { key: 'product_id', label: 'Product ID', type: 'input' },
  { key: 'serial_number', label: 'Serial Number', type: 'input' },
  { key: 'mac_address', label: 'MAC Address', type: 'input' },
  { key: 'issue_description', label: 'Issue Description', type: 'textarea' },
  { key: 'rma_status', label: 'RMA Status', type: 'select', options: RMA_STATUS_OPTIONS },
  { key: 'rma_number', label: 'RMA Number', type: 'input' },
  { key: 'entitlement_status', label: 'Entitlement Status', type: 'select', options: ENTITLEMENT_STATUS_OPTIONS },
  { key: 'vendor_sr_number', label: 'Vendor SR Number', type: 'input' },
  { key: 'replacement_ship_to', label: 'Replacement Ship To', type: 'input' },
  { key: 'replacement_ship_date', label: 'Replacement Ship Date', type: 'date' },
  { key: 'inbound_shipping_carrier', label: 'Inbound Shipping Carrier', type: 'input' },
  { key: 'inbound_tracking', label: 'Inbound Tracking', type: 'input' },
  { key: 'outbound_shipping_carrier', label: 'Outbound Shipping Carrier', type: 'input' },
  { key: 'outbound_tracking', label: 'Outbound Tracking', type: 'input' },
  { key: 'return_required', label: 'Return Required', type: 'checkbox' },
];

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-gray-500 disabled:opacity-70";

export default function RmaForm({ rma, caseId, onSaved }) {
  const [writesEnabled, setWritesEnabled] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [noChange, setNoChange] = useState(false);

  useEffect(() => { let c = false; fetch('/api/write-safety/status').then((r) => r.ok ? r.json() : null).then((d) => { if (!c && d) setWritesEnabled(d.writesEnabled === true); }).catch(() => {}); return () => { c = true; }; }, []);

  useEffect(() => {
    if (rma) {
      const initial = {};
      RMA_FIELDS.forEach(({ key, type }) => {
        const dataKey = key === 'replacement_ship_date' ? 'replacement_ship_promised_at' : key;
        const rawValue = rma[dataKey];
        if (type === 'checkbox') initial[key] = rawValue === 1 || rawValue === '1' || rawValue === true;
        else if (type === 'date' && rawValue) initial[key] = String(rawValue).slice(0, 10);
        else initial[key] = rawValue != null ? String(rawValue) : '';
      });
      setFormData(initial);
    }
  }, [rma]);

  const handleChange = useCallback((key, value) => { setSaveSuccess(false); setSaveError(null); setNoChange(false); setFieldErrors((p) => { if (!p[key]) return p; const n = { ...p }; delete n[key]; return n; }); setFormData((p) => ({ ...p, [key]: value })); }, []);

  const handleSave = useCallback(async () => {
    if (!writesEnabled || saving) return;
    const payload = {};
    RMA_FIELDS.forEach(({ key, type }) => {
      const dataKey = key === 'replacement_ship_date' ? 'replacement_ship_promised_at' : key;
      if (type === 'checkbox') { const orig = rma && (rma[dataKey] === 1 || rma[dataKey] === '1' || rma[dataKey] === true); if (formData[key] !== orig) payload[key] = !!formData[key]; }
      else { const rawOrig = rma && rma[dataKey] != null ? String(rma[dataKey]) : ''; const orig = type === 'date' && rawOrig ? rawOrig.slice(0, 10) : rawOrig; if ((formData[key] || '') !== orig) payload[key] = formData[key] || ''; }
    });
    if (!Object.keys(payload).length) { setNoChange(true); return; }
    setSaving(true); setSaveError(null); setSaveSuccess(false); setNoChange(false); setFieldErrors({});
    try {
      const res = await fetch(`/api/cases/${caseId}/rma`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { if (data.code === 'VALIDATION_ERROR' && data.fieldErrors) { setFieldErrors(data.fieldErrors); setSaveError('Please fix the errors below.'); } else setSaveError(data.error || `Save failed (${res.status})`); return; }
      if (data.changedCount === 0) { setNoChange(true); return; }
      setSaveSuccess(true); if (onSaved) onSaved();
    } catch { setSaveError('Network error. Please try again.'); }
    finally { setSaving(false); }
  }, [writesEnabled, saving, formData, rma, caseId, onSaved]);

  const disabled = !writesEnabled;
  const val = (key) => formData[key] ?? '';

  return (
    <section aria-label={disabled ? 'RMA Details (read-only)' : 'RMA Details'}>
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        {RMA_FIELDS.map(({ key, label, type, options }) => (
          <div key={key} className={type === 'textarea' ? 'col-span-2 max-sm:col-span-1' : ''}>
            <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor={`rma-${key}`}>{label}</label>
            {type === 'textarea' ? (
              <textarea id={`rma-${key}`} className={`${inputCls} resize-y`} value={val(key)} disabled={disabled} readOnly={disabled} rows={3} placeholder="—" onChange={(e) => handleChange(key, e.target.value)} />
            ) : type === 'select' ? (
              <select id={`rma-${key}`} className={inputCls} value={val(key)} disabled={disabled} onChange={(e) => handleChange(key, e.target.value)}>{options.map((opt) => <option key={opt} value={opt}>{opt || '—'}</option>)}</select>
            ) : type === 'date' ? (
              <input id={`rma-${key}`} className={inputCls} type="date" value={val(key)} disabled={disabled} readOnly={disabled} onChange={(e) => handleChange(key, e.target.value)} />
            ) : type === 'checkbox' ? (
              <input id={`rma-${key}`} type="checkbox" checked={!!formData[key]} disabled={disabled} onChange={(e) => handleChange(key, e.target.checked)} className="mt-1" />
            ) : (
              <input id={`rma-${key}`} className={inputCls} type="text" value={val(key)} disabled={disabled} readOnly={disabled} placeholder="—" onChange={(e) => handleChange(key, e.target.value)} />
            )}
            {fieldErrors[key] && <span className="block text-xs text-red-600 mt-0.5" role="alert">{fieldErrors[key]}</span>}
          </div>
        ))}
      </div>
      {saveError && <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-800" role="alert">{saveError}</div>}
      {noChange && <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800" role="status">No changes to save.</div>}
      {saveSuccess && <div className="mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-800" role="status">Changes saved successfully.</div>}
      <div className="mt-4">
        <button type="button" disabled={disabled || saving} onClick={handleSave} className="px-5 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </section>
  );
}
