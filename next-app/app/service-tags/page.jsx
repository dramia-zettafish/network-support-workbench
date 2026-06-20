'use client';

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

// Avery 61501: 7/8" x 2-5/8", 33 labels per sheet (3 columns x 11 rows)
// From PDF template: Top/Bottom margin: 0.6875", Side margin: 0.1875", Label: 0.875" x 2.625", H-gap: 0.125", No vertical gap
const LABEL_STYLES = `
@media print {
  @page { margin: 0.6875in 0.1875in; size: letter; }
  body * { visibility: hidden; }
  #print-labels, #print-labels * { visibility: visible; }
  #print-labels { position: absolute; top: 0; left: 0; width: 100%; }
  .label-grid { display: grid; grid-template-columns: repeat(3, 2.625in); gap: 0in 0.125in; }
  .label-cell { width: 2.625in; height: 0.875in; overflow: hidden; padding: 0.04in 0.1in; box-sizing: border-box; display: flex; flex-direction: row; align-items: center; gap: 0.08in; }
  .label-qr { width: 0.52in; height: 0.52in; flex-shrink: 0; }
  .label-qr img { width: 100%; height: 100%; }
  .label-text { flex: 1; overflow: hidden; }
  .label-text p { margin: 0; font-size: 9.5pt; line-height: 1.1; font-family: Arial, sans-serif; color: #000 !important; text-align: right; white-space: nowrap; overflow: hidden; }
  .no-print { display: none !important; }
}
`;

function QRLabel({ caseNumber, src }) {
  return (
    <div className="label-qr">
      {src && <img src={src} alt={caseNumber} />}
    </div>
  );
}

function LabelGrid({ cases, qrMap }) {
  if (!cases.length) return null;
  return (
    <div id="print-labels">
      <div className="label-grid">
        {cases.map((c, i) => (
          <div key={i} className="label-cell">
            {c ? (
              <>
                <QRLabel caseNumber={c.case_number} src={qrMap[c.case_number]} />
                <div className="label-text">
                  <p style={{ fontWeight: 'bold' }}>{c.case_number}</p>
                  <p>{c.customer_name}</p>
                  <p>{c.facility || ''}</p>
                  <p style={{ fontWeight: 'bold' }}>{c.serial_number || ''}</p>
                  <p>{c.asset_tag || ''}</p>
                </div>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function IndividualServiceTags({ qrMap, onGenerateQR }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [grid, setGrid] = useState(Array(33).fill(null)); // 11 rows x 3 cols
  const [dragItem, setDragItem] = useState(null);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/service-tags/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const d = await res.json();
        setSearchResults(d.data || []);
        if (d.data?.length) await onGenerateQR(d.data);
      }
    } catch {} finally { setSearching(false); }
  }

  function handleDragStart(e, caseData) {
    setDragItem(caseData);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(e, cellIndex) {
    e.preventDefault();
    if (dragItem) {
      const newGrid = [...grid];
      newGrid[cellIndex] = dragItem;
      setGrid(newGrid);
      setSearchResults(prev => prev.filter(c => c.case_number !== dragItem.case_number));
      setDragItem(null);
    }
  }

  function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }

  function clearCell(idx) {
    const newGrid = [...grid];
    const removed = newGrid[idx];
    newGrid[idx] = null;
    setGrid(newGrid);
    if (removed) setSearchResults(prev => [...prev, removed]);
  }

  function clearGrid() { setGrid(Array(33).fill(null)); }

  function handlePrint() {
    const printEl = document.getElementById('print-labels');
    if (printEl) printEl.remove();
    // Build the 33-cell array for printing (nulls become empty cells)
    const printContainer = document.createElement('div');
    printContainer.id = 'print-labels';
    printContainer.innerHTML = `<div class="label-grid">${grid.map(c => {
      if (!c) return '<div class="label-cell"></div>';
      const qr = qrMap[c.case_number] || '';
      return `<div class="label-cell">
        <div class="label-qr">${qr ? `<img src="${qr}" alt="${c.case_number}">` : ''}</div>
        <div class="label-text">
          <p style="font-weight:bold">${c.case_number}</p>
          <p>${c.customer_name}</p>
          <p>${c.facility || ''}</p>
          <p style="font-weight:bold">${c.serial_number || ''}</p>
          <p>${c.asset_tag || ''}</p>
        </div>
      </div>`;
    }).join('')}</div>`;
    document.body.appendChild(printContainer);
    const origTitle = document.title;
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    document.title = `EU Support Service Tags - Individual - ${date}`;
    setTimeout(() => { window.print(); document.title = origTitle; printContainer.remove(); }, 100);
  }

  const hasLabels = grid.some(c => c !== null);

  return (
    <section className="rounded-lg p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Individual Service Tags</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Search by serial number, case number, or intake crate, then drag results onto the grid to position labels on the sheet.</p>

      {/* Search */}
      <div className="flex gap-3 items-center mb-4">
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Search serial #, case #, or crate..." className="px-3 py-2 text-sm border rounded w-64" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }} />
        <button onClick={handleSearch} disabled={searching || !searchQuery.trim()} className="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {searching ? 'Searching...' : 'Search'}
        </button>
        {hasLabels && (
          <>
            <button onClick={handlePrint} className="px-4 py-2 text-sm font-medium rounded bg-green-600 text-white hover:bg-green-700">Print Tags</button>
            <button onClick={clearGrid} className="px-4 py-2 text-sm font-medium rounded bg-red-600 text-white hover:bg-red-700">Clear Grid</button>
          </>
        )}
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Drag results to grid positions below:</p>
          <div className="flex flex-wrap gap-2">
            {searchResults.map((c, i) => (
              <div key={i} draggable onDragStart={(e) => handleDragStart(e, c)} className="px-3 py-1.5 text-xs rounded border cursor-grab active:cursor-grabbing" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
                <span className="font-bold">{c.case_number}</span> — {c.serial_number || 'No S/N'}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 11x3 Grid */}
      <div className="overflow-auto">
        <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(3, 1fr)', gap: '2px', maxWidth: '600px' }}>
          {/* Header */}
          <div className="text-xs font-medium text-center p-1" style={{ color: 'var(--color-text-muted)' }}></div>
          <div className="text-xs font-medium text-center p-1" style={{ color: 'var(--color-text-muted)' }}>Col 1</div>
          <div className="text-xs font-medium text-center p-1" style={{ color: 'var(--color-text-muted)' }}>Col 2</div>
          <div className="text-xs font-medium text-center p-1" style={{ color: 'var(--color-text-muted)' }}>Col 3</div>
          {/* Rows */}
          {Array.from({ length: 11 }).map((_, row) => {
            const rowCells = Array.from({ length: 3 }).map((_, col) => {
              const idx = row * 3 + col;
              const cell = grid[idx];
              return (
                <div key={idx} onDrop={(e) => handleDrop(e, idx)} onDragOver={handleDragOver}
                  className="border rounded p-1 text-xs min-h-[40px] flex items-center justify-center relative"
                  style={{ borderColor: cell ? 'var(--color-primary, #2563eb)' : 'var(--color-border)', background: cell ? 'rgba(37,99,235,0.05)' : 'var(--color-bg)' }}>
                  {cell ? (
                    <>
                      <span className="truncate">{cell.case_number}</span>
                      <button onClick={() => clearCell(idx)} className="absolute top-0 right-0 w-4 h-4 text-xs leading-none text-red-500 hover:text-red-700">×</button>
                    </>
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                  )}
                </div>
              );
            });
            return (
              <div key={row} className="contents">
                <div className="text-xs font-medium flex items-center justify-center p-1" style={{ color: 'var(--color-text-muted)' }}>{row + 1}</div>
                {rowCells}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function ServiceTagsPage() {
  const [allCases, setAllCases] = useState([]);
  const [crateCases, setCrateCases] = useState([]);
  const [crateInput, setCrateInput] = useState('');
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadingCrate, setLoadingCrate] = useState(false);
  const [printMode, setPrintMode] = useState(null);
  const [qrMap, setQrMap] = useState({});

  async function generateQRCodes(cases) {
    const map = {};
    await Promise.all(cases.map(async (c) => {
      if (!map[c.case_number]) {
        map[c.case_number] = await QRCode.toDataURL(c.case_number, { width: 128, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
      }
    }));
    setQrMap(prev => ({ ...prev, ...map }));
    return map;
  }

  async function loadAllPickupScheduled() {
    setLoadingAll(true);
    try {
      const res = await fetch('/api/service-tags');
      if (res.ok) { const d = await res.json(); setAllCases(d.data || []); await generateQRCodes(d.data || []); }
    } catch {} finally { setLoadingAll(false); }
  }

  async function loadByCrate() {
    if (!crateInput.trim()) return;
    setLoadingCrate(true);
    try {
      const res = await fetch(`/api/service-tags?crate=${encodeURIComponent(crateInput.trim())}`);
      if (res.ok) { const d = await res.json(); setCrateCases(d.data || []); await generateQRCodes(d.data || []); }
    } catch {} finally { setLoadingCrate(false); }
  }

  function handlePrint(mode) {
    setPrintMode(mode);
    const origTitle = document.title;
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    document.title = `EU Support Service Tags - ${date}`;
    setTimeout(() => { window.print(); document.title = origTitle; setPrintMode(null); }, 100);
  }

  const printCases = printMode === 'all' ? allCases : printMode === 'crate' ? crateCases : [];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LABEL_STYLES }} />
      <div className="no-print p-6 max-w-4xl mx-auto space-y-8">

        {/* Section 1: All Pickup Scheduled */}
        <section className="rounded-lg p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Service Tags for Pickup Scheduled Cases</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Generate service tag labels for all cases currently in Pickup Scheduled stage.</p>
          <div className="flex gap-3 items-center">
            <button onClick={loadAllPickupScheduled} disabled={loadingAll} className="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {loadingAll ? 'Loading...' : 'Load Cases'}
            </button>
            {allCases.length > 0 && (
              <button onClick={() => handlePrint('all')} className="px-4 py-2 text-sm font-medium rounded bg-green-600 text-white hover:bg-green-700">
                Print Labels ({allCases.length})
              </button>
            )}
          </div>
          {allCases.length > 0 && (
            <div className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="font-medium mb-2">{allCases.length} case(s) ready for printing</p>
              <div className="max-h-48 overflow-auto rounded border" style={{ borderColor: 'var(--color-border)' }}>
                <table className="w-full text-xs">
                  <thead><tr className="border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}><th className="px-2 py-1 text-left">Case #</th><th className="px-2 py-1 text-left">Customer</th><th className="px-2 py-1 text-left">Facility</th><th className="px-2 py-1 text-left">Serial #</th></tr></thead>
                  <tbody>{allCases.map((c, i) => <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}><td className="px-2 py-1">{c.case_number}</td><td className="px-2 py-1">{c.customer_name}</td><td className="px-2 py-1">{c.facility || '-'}</td><td className="px-2 py-1">{c.serial_number || '-'}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Section 2: By Intake Crate */}
        <section className="rounded-lg p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Service Tags by Intake Crate</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Enter crate number(s) to generate labels for cases in those crates. Separate multiple crates with commas.</p>
          <div className="flex gap-3 items-center">
            <input value={crateInput} onChange={(e) => setCrateInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadByCrate()} placeholder="e.g. C1, C2, C3" className="px-3 py-2 text-sm border rounded w-64" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }} />
            <button onClick={loadByCrate} disabled={loadingCrate || !crateInput.trim()} className="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {loadingCrate ? 'Loading...' : 'Search'}
            </button>
            {crateCases.length > 0 && (
              <button onClick={() => handlePrint('crate')} className="px-4 py-2 text-sm font-medium rounded bg-green-600 text-white hover:bg-green-700">
                Print Labels ({crateCases.length})
              </button>
            )}
          </div>
          {crateCases.length > 0 && (
            <div className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="font-medium mb-2">{crateCases.length} case(s) found</p>
              <div className="max-h-48 overflow-auto rounded border" style={{ borderColor: 'var(--color-border)' }}>
                <table className="w-full text-xs">
                  <thead><tr className="border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}><th className="px-2 py-1 text-left">Case #</th><th className="px-2 py-1 text-left">Customer</th><th className="px-2 py-1 text-left">Facility</th><th className="px-2 py-1 text-left">Serial #</th><th className="px-2 py-1 text-left">Crate</th></tr></thead>
                  <tbody>{crateCases.map((c, i) => <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}><td className="px-2 py-1">{c.case_number}</td><td className="px-2 py-1">{c.customer_name}</td><td className="px-2 py-1">{c.facility || '-'}</td><td className="px-2 py-1">{c.serial_number || '-'}</td><td className="px-2 py-1">{c.intake_crate || '-'}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Individual Service Tags */}
        <IndividualServiceTags qrMap={qrMap} onGenerateQR={generateQRCodes} />
      </div>

      {/* Hidden print area for bulk modes */}
      {printMode && <div style={{ visibility: 'hidden', height: 0, overflow: 'hidden' }}><LabelGrid cases={printCases} qrMap={qrMap} /></div>}
    </>
  );
}
