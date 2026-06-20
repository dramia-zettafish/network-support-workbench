'use client';

const RMA_FIELDS = [
  { key: 'manufacturer', label: 'Manufacturer', type: 'input' },
  { key: 'product_id', label: 'Product ID', type: 'input' },
  { key: 'serial_number', label: 'Serial Number', type: 'input' },
  { key: 'mac_address', label: 'MAC Address', type: 'input' },
  { key: 'issue_description', label: 'Issue Description', type: 'textarea' },
  { key: 'rma_status', label: 'RMA Status', type: 'select' },
  { key: 'rma_number', label: 'RMA Number', type: 'input' },
  { key: 'entitlement_status', label: 'Entitlement Status', type: 'select' },
  { key: 'vendor_sr_number', label: 'Vendor SR Number', type: 'input' },
  { key: 'replacement_ship_to', label: 'Replacement Ship To', type: 'input' },
  { key: 'replacement_ship_date', label: 'Replacement Ship Date', type: 'input' },
  { key: 'inbound_shipping_carrier', label: 'Inbound Shipping Carrier', type: 'input' },
  { key: 'inbound_tracking', label: 'Inbound Tracking', type: 'input' },
  { key: 'outbound_shipping_carrier', label: 'Outbound Shipping Carrier', type: 'input' },
  { key: 'outbound_tracking', label: 'Outbound Tracking', type: 'input' },
  { key: 'return_required', label: 'Return Required', type: 'select' },
];

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50 text-gray-500 disabled:opacity-70";

export default function RmaFormDisabled({ rma }) {
  const val = (key) => (rma && rma[key] != null ? String(rma[key]) : '');

  return (
    <section aria-label="RMA Details (read-only)">
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        {RMA_FIELDS.map(({ key, label, type }) => (
          <div key={key} className={type === 'textarea' ? 'col-span-2 max-sm:col-span-1' : ''}>
            <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor={`rma-${key}`}>{label}</label>
            {type === 'textarea' ? (
              <textarea id={`rma-${key}`} className={`${inputCls} resize-y`} value={val(key)} disabled readOnly rows={3} placeholder="—" />
            ) : type === 'select' ? (
              <select id={`rma-${key}`} className={inputCls} value={val(key)} disabled><option value="">{val(key) || '—'}</option>{val(key) && <option value={val(key)}>{val(key)}</option>}</select>
            ) : (
              <input id={`rma-${key}`} className={inputCls} type="text" value={val(key)} disabled readOnly placeholder="—" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
