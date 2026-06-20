'use client';

/**
 * Data Management — workbook progress, download compiled output.
 * @approved-write-client
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTimezone } from '@/lib/format-date.js';

export default function DataManagementPage() {
  const { fmt } = useTimezone();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const downloadInFlightRef = useRef(false);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [writesEnabled, setWritesEnabled] = useState(false);
  const [writeSafetyReason, setWriteSafetyReason] = useState('');
  const [pickupFile, setPickupFile] = useState(null);
  const [pickupImporting, setPickupImporting] = useState(false);
  const [pickupImportResult, setPickupImportResult] = useState(null);

  useEffect(() => { fetch('/api/data-management/refresh-team-export').then(r => r.json()).then(d => { if (d.teams?.length) { setTeams(d.teams); setSelectedTeam(d.teams[0].id); } }).catch(() => {}); }, []);
  useEffect(() => {
    fetch('/api/write-safety/status')
      .then((r) => r.json())
      .then((d) => {
        setWritesEnabled(d.writesEnabled === true);
        setWriteSafetyReason(d.reason || '');
      })
      .catch(() => {
        setWritesEnabled(false);
        setWriteSafetyReason('Unable to verify write status.');
      });
  }, []);

  const loadData = useCallback(() => {
    return fetch('/api/data-management/workbook')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const downloadResponse = async (res, fallbackFilename) => {
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename="([^"]+)"/i);
    const filename = filenameMatch?.[1] || fallbackFilename;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    if (downloadInFlightRef.current || !data?.pendingRecordCount) return;

    downloadInFlightRef.current = true;
    setDownloading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/data-management/workbook/download');

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Download failed.');
      }

      await downloadResponse(res, 'compiled-workbook.xlsx');
      await loadData();

      setMessage({
        type: 'success',
        text: 'Workbook downloaded. Use Download Again from the history table if you need the same file again.'
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Download failed.' });
      loadData();
    } finally {
      downloadInFlightRef.current = false;
      setDownloading(false);
    }
  };

  const handlePickupImport = async (event) => {
    event.preventDefault();
    if (!pickupFile || pickupImporting) return;

    setPickupImporting(true);
    setPickupImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', pickupFile);

      const res = await fetch('/api/data-management/refresh-pickup-results', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(result.error || 'Pickup results import failed.');
      setPickupImportResult({ type: 'success', data: result });
    } catch (err) {
      setPickupImportResult({ type: 'error', text: err.message || 'Pickup results import failed.' });
    } finally {
      setPickupImporting(false);
    }
  };

  const thCls = 'text-left px-3 py-2 font-semibold text-sm';
  const thStyle = { color: 'var(--color-text-secondary)' };
  const tdCls = 'px-3 py-2 text-sm';
  const tdStyle = { color: 'var(--color-text-muted)' };

  const statusBadge = (technician) => {
    if (technician.submissionStatus === 'submitted') {
      return <span className="text-blue-700 font-semibold">Submitted</span>;
    }

    if (technician.submissionStatus === 'finished') {
      return <span className="text-green-700 font-semibold">Finished</span>;
    }

    return <span className="text-amber-600">Pending</span>;
  };

  const downloadFailuresCsv = (skippedRows) => {
    const headers = ['Row Number', 'Case Number', 'Serial Number', 'Asset Tag', 'Scanned Value', 'Reason'];
    const csvRows = [headers.join(',')];
    for (const row of skippedRows) {
      csvRows.push(headers.map((h) => {
        const key = h === 'Row Number' ? 'rowNumber' : h === 'Case Number' ? 'caseNumber' : h === 'Serial Number' ? 'serialNumber' : h === 'Asset Tag' ? 'assetTag' : h === 'Scanned Value' ? 'scannedValue' : 'reason';
        const val = String(row[key] ?? '');
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pickup-import-failures.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const renderPickupImportResult = () => {
    if (!pickupImportResult) return null;

    if (pickupImportResult.type === 'error') {
      return (
        <div className="mt-4 px-4 py-3 rounded border text-sm bg-red-50 border-red-200 text-red-800">
          {pickupImportResult.text}
        </div>
      );
    }

    const result = pickupImportResult.data || {};
    const ignored = result.ignored || {};
    const allSkippedRows = result.skippedRows || [];
    const skippedRows = allSkippedRows.slice(0, 8);

    return (
      <div className="mt-4 px-4 py-3 rounded border text-sm bg-green-50 border-green-200 text-green-800">
        <p className="font-semibold">
          {result.message || `Imported ${result.updated || 0} case(s) to Diagnosing.`}
        </p>
        <p className="mt-1">
          Picked up rows: {result.pickedUpRows || 0}. Already processed: {result.alreadyProcessed || 0}. Skipped: {result.skipped || 0}.
        </p>
        <p className="mt-1 text-green-700">
          Ignored rows - pending: {ignored.pending || 0}, needs review: {ignored.needsReview || 0}, unknown: {ignored.unknown || 0}, not on list: {ignored.notOnList || 0}.
        </p>
        {skippedRows.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-green-900">
            {skippedRows.map((row, index) => (
              <li key={`${row.caseNumber || row.rowNumber || index}-${index}`}>
                {row.caseNumber || `Row ${row.rowNumber}`}: {row.reason}
              </li>
            ))}
          </ul>
        )}
        {allSkippedRows.length > 0 && (
          <button
            onClick={() => downloadFailuresCsv(allSkippedRows)}
            className="mt-3 px-3 py-1.5 text-xs font-semibold rounded border bg-white border-green-300 text-green-800 hover:bg-green-100 cursor-pointer"
          >
            ⬇️ Download Failures CSV ({allSkippedRows.length} row{allSkippedRows.length !== 1 ? 's' : ''})
          </button>
        )}
      </div>
    );
  };

  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8">
        {loading && <p>Loading...</p>}

        {!loading && !data?.workbook && (
          <p style={{ color: 'var(--color-text-muted)' }}>
            No active workbook. Upload one from Route Coordination.
          </p>
        )}

        {!loading && data?.workbook && (
          <>
            <div className="px-4 py-3 mb-6 rounded-lg" style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5a8e)', color: '#fff' }}>
              <h2 className="text-lg font-bold">Dynamics Integration</h2>
            </div>

            {message && (
              <div
                className={`px-4 py-3 mb-4 rounded border text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="mb-6">
              <h2
                className="text-lg font-semibold mb-3"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Workbook Status
              </h2>
              <ul className="list-none p-0">
                <li className="py-1 text-sm">
                  📄 <strong>File:</strong> {data.workbook.filename}
                </li>
                <li className="py-1 text-sm">
                  🕐 <strong>Uploaded:</strong> {fmt(data.workbook.uploadedAt)}
                </li>
                <li className="py-1 text-sm">
                  📊 <strong>Cycle:</strong> {data.workbook.cycleVersion}
                </li>
                <li className="py-1 text-sm">
                  📝 <strong>Pending Records:</strong> {data.pendingRecordCount}
                </li>
                {data.lastUpdatedAt && (
                  <li className="py-1 text-sm">
                    🔄 <strong>Last Updated:</strong> {fmt(data.lastUpdatedAt)}
                  </li>
                )}
              </ul>
            </div>

            <div className="mb-6">
              <h2
                className="text-lg font-semibold mb-3"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Technician Progress
              </h2>
              {data.technicians?.length > 0 ? (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ background: 'var(--color-surface-raised)' }}>
                      <th className={thCls} style={thStyle}>Technician</th>
                      <th className={thCls} style={thStyle}>In Workbook</th>
                      <th className={thCls} style={thStyle}>Status</th>
                      <th className={thCls} style={thStyle}>Rows</th>
                      <th className={thCls} style={thStyle}>Last Submission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.technicians.map((t) => (
                      <tr
                        key={t.userId}
                        className={t.disabled ? 'opacity-50' : ''}
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                      >
                        <td className={tdCls} style={tdStyle}>
                          {t.displayName || t.username}
                        </td>
                        <td className={tdCls} style={tdStyle}>
                          {t.presentInActiveWorkbook ? '✅' : '—'}
                        </td>
                        <td className={tdCls} style={tdStyle}>
                          {statusBadge(t)}
                        </td>
                        <td className={tdCls} style={tdStyle}>
                          {t.lastSubmissionCount || '—'}
                        </td>
                        <td className={tdCls} style={tdStyle}>
                          {t.lastSubmissionAt ? fmt(t.lastSubmissionAt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: 'var(--color-text-muted)' }}>
                  No logistics technicians configured.
                </p>
              )}
            </div>

            <div
              className="mb-6 p-4 rounded-md"
              style={{
                background: 'var(--color-surface-raised)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--color-border)'
              }}
            >
              <h2
                className="text-lg font-semibold mb-3"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Download
              </h2>
              <button
                onClick={handleDownload}
                disabled={downloading || data.pendingRecordCount === 0}
                className={`px-4 py-2 text-sm font-semibold rounded ${
                  !downloading && data.pendingRecordCount > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                }`}
                style={downloading || data.pendingRecordCount === 0 ? { background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' } : undefined}
              >
                {downloading
                  ? 'Downloading...'
                  : `Download Compiled Workbook (${data.pendingRecordCount} records)`}
              </button>
              {data.pendingRecordCount === 0 && (
                <p
                  className="text-xs mt-2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  No new submissions since last download.
                </p>
              )}
            </div>

            {data.previousDownloads?.length > 0 && (
              <div className="mb-6">
                <h2
                  className="text-lg font-semibold mb-3"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Download History
                </h2>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ background: 'var(--color-surface-raised)' }}>
                      <th className={thCls} style={thStyle}>Filename</th>
                      <th className={thCls} style={thStyle}>Records</th>
                      <th className={thCls} style={thStyle}>Downloaded By</th>
                      <th className={thCls} style={thStyle}>Date</th>
                      <th className={`${thCls} text-right`} style={thStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.previousDownloads.map((d) => (
                      <tr
                        key={d.id}
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                      >
                        <td className={tdCls} style={tdStyle}>
                          {d.filename}
                        </td>
                        <td className={tdCls} style={tdStyle}>
                          {d.recordCount}
                        </td>
                        <td className={tdCls} style={tdStyle}>
                          {d.downloadedByDisplayName || '—'}
                        </td>
                        <td className={tdCls} style={tdStyle}>
                          {fmt(d.downloadedAt)}
                        </td>
                        <td className={`${tdCls} text-right`} style={tdStyle}>
                          <a
                            href={`/api/data-management/workbook/downloads/${d.id}`}
                            className="inline-block px-3 py-1.5 rounded text-xs font-semibold border"
                            style={{
                              background: 'var(--color-surface)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text)'
                            }}
                          >
                            Download Again
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <div className="mt-10 pt-8" style={{ borderTop: '2px solid var(--color-border)' }}>
          <div className="px-4 py-3 mb-6 rounded-lg" style={{ background: 'linear-gradient(135deg, #1e5a3a, #2d8e5a)', color: '#fff' }}>
            <h2 className="text-lg font-bold">EU Support</h2>
          </div>
        </div>

        {teams.length > 0 && (
          <div className="p-4 rounded-md" style={{ background: 'var(--color-surface-raised)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)' }}>
            <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>Refresh Logistics Team Assignments</h2>
            <div className="flex gap-3 items-center flex-wrap">
              <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="px-3 py-2 border rounded-md text-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={() => { window.location.href = `/api/data-management/refresh-team-export?team_id=${encodeURIComponent(selectedTeam)}`; }} disabled={!selectedTeam} className="px-4 py-2 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700">⬇️ Download CSV</button>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Exports pickup scheduled cases assigned to the selected team for today's date.</p>
          </div>
        )}

        <div
          className="mt-8 p-4 rounded-md"
          style={{
            background: 'var(--color-surface-raised)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--color-border)'
          }}
        >
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Import Refresh Pickup Scanner Results
          </h2>
          <form onSubmit={handlePickupImport} className="flex gap-3 items-center flex-wrap">
            <input
              type="file"
              accept=".csv,.xlsx,.json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json"
              onChange={(e) => {
                setPickupFile(e.target.files?.[0] || null);
                setPickupImportResult(null);
              }}
              className="input-themed px-3 py-2 rounded-md text-sm file:mr-3 file:px-3 file:py-1 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white file:cursor-pointer"
            />
            <button
              type="submit"
              disabled={!writesEnabled || !pickupFile || pickupImporting}
              className={`px-4 py-2 text-sm font-semibold rounded ${
                writesEnabled && pickupFile && !pickupImporting
                  ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              style={!writesEnabled || !pickupFile || pickupImporting ? { background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' } : undefined}
            >
              {pickupImporting ? 'Importing...' : 'Import Results'}
            </button>
          </form>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Upload the scanner results Excel, CSV, or JSON export. Picked-up device rows are moved to Diagnosing.
          </p>
          {!writesEnabled && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-warning)' }}>
              {writeSafetyReason || 'Write operations are disabled.'}
            </p>
          )}
          {renderPickupImportResult()}
        </div>
      </div>
    </main>
  );
}
