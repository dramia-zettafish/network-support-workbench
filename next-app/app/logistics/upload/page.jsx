'use client';
// @approved-write-client
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LogisticsUploadPage() {
  const [writesEnabled, setWritesEnabled] = useState(false);
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/write-safety/status').then((r) => r.json()).then((d) => setWritesEnabled(d.writesEnabled)).catch(() => setWritesEnabled(false));
    fetch('/api/logistics/workbook/status').then((r) => r.json()).then((d) => setStatus(d)).catch(() => {});
  }, []);

  async function handleUpload(e) {
    e.preventDefault();
    setError(null); setResult(null);
    const file = e.target.elements.file?.files?.[0];
    if (!file) { setError('Please select a file'); return; }
    if (!file.name.endsWith('.xlsx')) { setError('Only .xlsx files are accepted'); return; }
    setUploading(true);
    const formData = new FormData(); formData.append('file', file);
    try {
      const res = await fetch('/api/logistics/workbook/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Upload failed');
      else { setResult(data); setStatus({ active: true, ...data }); }
    } catch (err) { setError('Upload failed: ' + err.message); }
    finally { setUploading(false); }
  }

  return (
    <main>
      <div className="max-w-[1200px] mx-auto px-8">
        <p className="mb-4"><Link href="/logistics" className="text-blue-600">← Back to Logistics</Link></p>
        {!writesEnabled && (
          <div className="flex items-center gap-3 px-6 py-4 bg-red-50 border border-red-200 rounded-md text-red-800 font-medium mb-4">
            <span>⚠️</span> Writes are disabled. Set WRITES_ENABLED=true to upload workbooks.
          </div>
        )}
        {status?.active && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Current Active Workbook</h2>
            <ul className="list-none p-0"><li className="py-1 text-sm">File: {status.filename}</li><li className="py-1 text-sm">Uploaded: {status.uploadedAt}</li><li className="py-1 text-sm">Rows: {status.rowCount}</li></ul>
          </div>
        )}
        <form onSubmit={handleUpload} className="mt-6">
          <div className="mb-4">
            <label htmlFor="file" className="block font-semibold mb-2">Select .xlsx workbook:</label>
            <input type="file" id="file" name="file" accept=".xlsx" disabled={!writesEnabled || uploading} />
          </div>
          <button type="submit" disabled={!writesEnabled || uploading} className={`px-6 py-2 font-semibold rounded text-white ${writesEnabled ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}>
            {uploading ? 'Uploading...' : 'Upload Workbook'}
          </button>
        </form>
        {error && <div className="flex items-center gap-3 px-6 py-4 mt-4 bg-red-50 border border-red-200 rounded-md text-red-800 font-medium"><span>❌</span> {error}</div>}
        {result && <div className="flex items-center gap-3 px-6 py-4 mt-4 bg-green-50 border border-green-200 rounded-md text-green-800 font-medium"><span>✅</span> Uploaded {result.filename} — {result.rowCount} rows parsed.{result.warnings?.length > 0 && ` (${result.warnings.length} warning(s))`}</div>}
      </div>
    </main>
  );
}
