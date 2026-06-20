'use client';
/**
 * @approved-write-client Gated by /api/write-safety/status check
 */
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import WriteDisabledNotice from '@/app/components/WriteDisabledNotice';
import RmaForm from './RmaForm';
import { useTimezone } from '@/lib/format-date.js';

const ACTIVITY_NOTE_TYPES = ['SystemEvent', 'Field Update'];

export default function CaseDetailClient({ id }) {
  const { fmt } = useTimezone();
  const [loading, setLoading] = useState(true);
  const [navIds, setNavIds] = useState([]);

  useEffect(() => { try { const ids = JSON.parse(sessionStorage.getItem('caseNavIds') || '[]'); setNavIds(ids); } catch {} }, []);
  const navIdx = navIds.indexOf(id);
  const prevId = navIdx > 0 ? navIds[navIdx - 1] : null;
  const nextId = navIdx >= 0 && navIdx < navIds.length - 1 ? navIds[navIdx + 1] : null;
  const [backPath, setBackPath] = useState('/cases');
  useEffect(() => { try { setBackPath(sessionStorage.getItem('caseNavBack') || '/cases'); } catch {} }, []);
  const [error, setError] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [relatedData, setRelatedData] = useState(null);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [relatedError, setRelatedError] = useState(null);
  const [usersById, setUsersById] = useState({});
  const [usersList, setUsersList] = useState([]);
  const [teamsById, setTeamsById] = useState({});
  const [teamsKeyById, setTeamsKeyById] = useState({});
  const [refLoading, setRefLoading] = useState(true);
  const [refError, setRefError] = useState(null);
  const [notifType, setNotifType] = useState('');
  const [notifPreview, setNotifPreview] = useState(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState(null);
  const [notifWritesEnabled, setNotifWritesEnabled] = useState(true);
  const [notifSending, setNotifSending] = useState(false);
  const [notifSendError, setNotifSendError] = useState(null);
  const [notifSendSuccess, setNotifSendSuccess] = useState(null);
  const [notifConfirm, setNotifConfirm] = useState(false);
  const [wfActionRunning, setWfActionRunning] = useState(null);
  const [wfActionError, setWfActionError] = useState(null);
  const [wfActionSuccess, setWfActionSuccess] = useState(null);
  const [wfActionConfirm, setWfActionConfirm] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userTeams, setUserTeams] = useState([]);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [reassignPopup, setReassignPopup] = useState(false);
  const [reassignJustification, setReassignJustification] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [reassignResult, setReassignResult] = useState(null);
  const [approvedReassignment, setApprovedReassignment] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [mgmtOpen, setMgmtOpen] = useState(false);
  const [mgmtAction, setMgmtAction] = useState(null);
  const [mgmtValue, setMgmtValue] = useState('');
  const [mgmtSaving, setMgmtSaving] = useState(false);
  const [mgmtError, setMgmtError] = useState(null);
  const [editData, setEditData] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [defectiveParts, setDefectiveParts] = useState([]);
  const [reseatedParts, setReseatedParts] = useState([]);
  const [assetLocation, setAssetLocation] = useState(null);
  const [locationKey, setLocationKey] = useState(0);
  const [depotRepair, setDepotRepair] = useState(null);
  const [advancingStage, setAdvancingStage] = useState(false);
  const [advanceError, setAdvanceError] = useState(null);
  const [advanceSuccess, setAdvanceSuccess] = useState(null);
  const [cancelPopup, setCancelPopup] = useState(false);
  const [managingNotes, setManagingNotes] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLocation, setCancelLocation] = useState({ rack: '', shelf: '', crate: '' });

  useEffect(() => { fetch('/api/auth/me').then((r) => r.ok ? r.json() : null).then((j) => { if (j?.user) { setUserRole(j.user.role); setUserTeams(j.user.teams || []); setUserId(j.user.id); setUserName(j.user.username || ''); } }).catch(() => {}); }, []);

  async function handleDeleteCase() {
    setDeleting(true); setDeleteError(null);
    try {
      const r = await fetch(`/api/cases/${id}`, { method: 'DELETE' });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setDeleteError(j.error || 'Delete failed'); return; }
      window.location.href = backPath;
    } catch { setDeleteError('Delete failed'); } finally { setDeleting(false); }
  }

  useEffect(() => { fetch('/api/reference/lookups').then((r) => r.ok ? r.json() : null).then((result) => { if (result?.data?.users) { const m = {}; result.data.users.forEach((u) => { m[u.id] = u.display_name; }); setUsersById(m); setUsersList(result.data.users); } if (result?.data?.teams) { const m = {}; const k = {}; result.data.teams.forEach((t) => { m[t.id] = t.label; k[t.id] = t.key; }); setTeamsById(m); setTeamsKeyById(k); } }).catch(() => setRefError('Reference data unavailable.')).finally(() => setRefLoading(false)); }, []);
  useEffect(() => { fetch('/api/write-safety/status').then((r) => r.ok ? r.json() : null).then((j) => { if (j) setNotifWritesEnabled(j.writesEnabled); }).catch(() => {}); }, []);
  useEffect(() => { fetch(`/api/cases/${id}`).then((r) => { if (r.status === 404) { setNotFound(true); return null; } if (!r.ok) throw new Error(); return r.json(); }).then((j) => { if (j) setCaseData(j.data); }).catch(() => setError('Unable to load case details.')).finally(() => setLoading(false)); }, [id]);
  useEffect(() => { if (!caseData) return; fetch(`/api/cases/${id}/related`).then((r) => r.ok ? r.json() : null).then((j) => { if (j) setRelatedData(j.data); else setRelatedError('Unable to load related data.'); }).catch(() => setRelatedError('Unable to load related data.')).finally(() => setRelatedLoading(false)); }, [caseData, id]);
  useEffect(() => { if (caseData?.stage === 'Diagnosing' || caseData?.stage === 'Repairing') { fetch(`/api/cases/${id}/defective-parts`).then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setDefectiveParts(d.data); }); fetch(`/api/cases/${id}/reseated-parts`).then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setReseatedParts(d.data); }); fetch(`/api/cases/${id}/notes`).then(r => r.ok ? r.json() : null).then(d => { if (d?.data) { const loc = d.data.find(n => n.note_type === 'AssetLocation'); if (loc?.body) { try { setAssetLocation(JSON.parse(loc.body)); } catch {} } } }); fetch(`/api/cases/${id}/depot-repair`).then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setDepotRepair(d.data); }); } }, [caseData, id]);
  useEffect(() => { if (!caseData || !userId) return; fetch(`/api/case-reassignment?status=approved&my=true`).then(r => r.ok ? r.json() : null).then(d => { if (d?.data) { const match = d.data.find(r => r.case_id === caseData.id && r.requested_by === userId); if (match) setApprovedReassignment(match); } }).catch(() => {}); }, [caseData, userId]);

  function formatDate(v) { return fmt(v); }
  function resolveUser(uid) { if (!uid) return 'Unassigned'; if (refLoading) return '...'; return usersById[uid] || uid; }
  function resolveTeam(tid) { if (!tid) return '-'; if (refLoading) return '...'; return teamsById[tid] || tid; }

  async function handlePreviewNotification() {
    if (!notifType) return; setNotifLoading(true); setNotifError(null); setNotifPreview(null); setNotifSendSuccess(null); setNotifSendError(null); setNotifConfirm(false);
    try { const r = await fetch(`/api/cases/${id}/notifications?type=${encodeURIComponent(notifType)}`); if (!r.ok) { const j = await r.json().catch(() => ({})); setNotifError(j.error || `Error ${r.status}`); return; } const j = await r.json(); setNotifPreview(j.data); } catch { setNotifError('Unable to load notification preview.'); } finally { setNotifLoading(false); }
  }

  async function handleSendNotification() {
    setNotifSending(true); setNotifSendError(null); setNotifSendSuccess(null);
    try { const r = await fetch(`/api/cases/${id}/notifications/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: notifType }) }); const j = await r.json().catch(() => ({})); if (!r.ok) { setNotifSendError(j.error || `Send failed`); return; } setNotifSendSuccess(j.message || 'Sent'); setNotifConfirm(false); fetch(`/api/cases/${id}/related`).then((r) => r.ok ? r.json() : null).then((j) => { if (j) setRelatedData(j.data); }); } catch { setNotifSendError('Unable to send.'); } finally { setNotifSending(false); }
  }

  async function handleWorkflowAction(action) {
    setWfActionRunning(action); setWfActionError(null); setWfActionSuccess(null); setWfActionConfirm(null);
    try { const r = await fetch(`/api/cases/${id}/rma/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); const j = await r.json().catch(() => ({})); if (!r.ok) { setWfActionError(j.error || 'Action failed'); return; } let msg = j.message || 'Action completed'; if (j.recommendedNotificationType) msg += ` — Recommended: ${j.recommendedNotificationType}`; setWfActionSuccess(msg); fetch(`/api/cases/${id}/related`).then((r) => r.ok ? r.json() : null).then((j) => { if (j) setRelatedData(j.data); }); } catch { setWfActionError('Unable to execute.'); } finally { setWfActionRunning(null); }
  }

  const fieldCls = "mb-0";
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5";
  const valueCls = "text-sm text-gray-800";

  const caseFields = caseData ? [
    ['Case Number', caseData.case_number], ['Customer Name', caseData.customer_name],
    ['Assigned To', resolveUser(caseData.assigned_to_user_id)], ['Created By', resolveUser(caseData.created_by_user_id)], ['Owning Team', resolveTeam(caseData.owning_team_id)],
    ['Requester Name', caseData.requester_name], ['Requester Email', caseData.requester_email], ['Requester Phone', caseData.requester_phone], ['Request Source', caseData.request_source],
    ['Workflow', caseData.workflow_key === 'rma' ? 'RMA' : caseData.workflow_key ? caseData.workflow_key.charAt(0).toUpperCase() + caseData.workflow_key.slice(1) : '-'], ['Stage', caseData.stage], ['Status', caseData.status], ['Priority', caseData.priority], ['Facility', caseData.facility],
    ...(caseData.workflow_key === 'refresh' && caseData.program ? [['Program', caseData.program]] : []),
    ...(caseData.workflow_key !== 'refresh' ? [['POC Name', caseData.poc_name], ['POC Email', caseData.poc_email], ['POC Phone', caseData.poc_phone]] : []),
    ['Last Activity', formatDate(caseData.last_activity_at)], ['Created At', formatDate(caseData.created_at)], ['Updated At', formatDate(caseData.updated_at)], ['Closed At', formatDate(caseData.closed_at)],
  ] : [];

  // Non-manager/supervisor users can only edit cases owned by their team (or if they have an approved reassignment)
  const isManagerOrSupervisor = userRole === 'manager' || userRole === 'supervisor';
  const owningTeamKey = caseData ? teamsKeyById[caseData.owning_team_id] : null;
  const editLocked = !isManagerOrSupervisor && owningTeamKey && !userTeams.includes(owningTeamKey) && !approvedReassignment;

  return (
    <div className="py-4">

      {advanceSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 text-center">
            <div className="text-green-600 text-3xl mb-2">✓</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{caseData?.case_number}</h3>
            <p className="text-sm text-gray-700">Stage changed to <strong>{advanceSuccess.stage}</strong></p>
            {advanceSuccess.team && <p className="text-sm text-gray-700">Owning team changed to <strong>{advanceSuccess.team?.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</strong></p>}
            {advanceSuccess.assigned && <p className="text-sm text-gray-700">Assigned to <strong>{advanceSuccess.assigned}</strong></p>}
            {advanceSuccess.assigned === null && <p className="text-sm text-gray-700">Assigned to <strong>Unassigned</strong></p>}
          </div>
        </div>
      )}

      {loading && <div className="text-center py-8 text-gray-500">Loading case details...</div>}
      {error && <div className="text-center py-8 text-red-600">{error}</div>}
      {!loading && notFound && <div className="text-center py-8 text-gray-500">Case not found.</div>}

      <div className="flex items-center gap-3 mb-4">
        <Link href={backPath} className="text-blue-600 text-sm font-medium hover:underline">← {backPath === '/my-workspace' ? 'Back to My Workspace' : 'Back to Cases'}</Link>
        {prevId && <Link href={`/cases/${prevId}`} className="text-blue-600 text-sm font-medium hover:underline">◀</Link>}
        {nextId && <Link href={`/cases/${nextId}`} className="text-blue-600 text-sm font-medium hover:underline">▶</Link>}
      </div>

      {!loading && !error && !notFound && caseData && (
        <>
        <div className="mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 mb-1">{caseData.case_number}</h1>
            {(userRole === 'manager' || userRole === 'supervisor') && (
              <div className="relative">
                <button onClick={() => setMgmtOpen(!mgmtOpen)} className="px-3 py-1 text-xs font-semibold bg-gray-700 text-white rounded hover:bg-gray-800">Management Tools</button>
                {mgmtOpen && (
                  <>
                  <div className="fixed inset-0 z-[9]" onClick={() => setMgmtOpen(false)}></div>
                  <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-[180px]">
                    <button onClick={() => { setMgmtOpen(false); setMgmtAction('edit'); setMgmtError(null); setEditData({ ...caseData, assigned_to_username: usersList.find(u => u.id === caseData.assigned_to_user_id)?.upn || '', refresh: relatedData?.refresh || null, rma: relatedData?.rma || null }); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Edit Request Details</button>
                    <button onClick={() => { setMgmtOpen(false); setMgmtAction('stage'); setMgmtValue(caseData?.stage || ''); setMgmtError(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Change Stage</button>
                    <button onClick={() => { setMgmtOpen(false); setMgmtAction('assign'); setMgmtValue(''); setMgmtError(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Assign</button>
                    <button onClick={() => { setMgmtOpen(false); setMgmtAction('team'); setMgmtValue(''); setMgmtError(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Change Owning Team</button>
                    <button onClick={() => { setMgmtOpen(false); setMgmtAction('audit'); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Audit Log</button>
                    {userRole === 'manager' && <button onClick={() => { setMgmtOpen(false); setDeleteConfirm(true); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 border-t border-gray-100">Delete Case</button>}
                  </div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
            <span><span className="font-semibold">Customer:</span> {caseData.customer_name || '-'}</span>
            {relatedData?.refresh?.model_name && <span><span className="font-semibold">Model:</span> {relatedData.refresh.model_name}</span>}
            {relatedData?.refresh?.serial_number && <span><span className="font-semibold">S/N:</span> {relatedData.refresh.serial_number}</span>}
            {relatedData?.rma?.serial_number && !relatedData?.refresh && <span><span className="font-semibold">S/N:</span> {relatedData.rma.serial_number}</span>}
          </div>
          <div className="text-sm text-gray-600 mt-1"><span className="font-semibold">Stage:</span> {caseData.stage}</div>
          {deleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
                <h2 className="text-lg font-bold text-gray-900 mb-2">Delete Case</h2>
                <p className="text-sm text-gray-600 mb-4">Are you sure you want to permanently delete <strong>{caseData.case_number}</strong>? This action cannot be undone.</p>
                {deleteError && <p className="text-sm text-red-600 mb-3">{deleteError}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setDeleteConfirm(false)} disabled={deleting} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                  <button onClick={handleDeleteCase} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
                </div>
              </div>
            </div>
          )}
          {reassignPopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <h2 className="text-lg font-bold text-gray-900 mb-2">Case Owned by Another Team</h2>
                <p className="text-sm text-gray-600 mb-4">This case is owned by <strong>{resolveTeam(caseData.owning_team_id)}</strong> and cannot be edited. If you need to make an edit to the case, click the button below to notify a supervisor. A supervisor will review your request and reassign the case to you if deemed appropriate.</p>
                {reassignResult ? (
                  <div className="mb-4">
                    <p className={`text-sm ${reassignResult.ok ? 'text-green-600' : 'text-red-600'}`}>{reassignResult.message}</p>
                    <div className="flex justify-end mt-3"><button onClick={() => { setReassignPopup(false); window.location.href = backPath; }} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Close</button></div>
                  </div>
                ) : (
                  <>
                    <textarea value={reassignJustification} onChange={(e) => setReassignJustification(e.target.value)} placeholder="Enter your justification for editing this case..." className="w-full border border-gray-300 rounded p-2 text-sm mb-3 h-24 resize-none" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setReassignPopup(false); window.location.href = backPath; }} disabled={reassignSubmitting} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                      <button disabled={!reassignJustification.trim() || reassignSubmitting} onClick={async () => {
                        setReassignSubmitting(true);
                        try {
                          const res = await fetch('/api/case-reassignment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case_id: caseData.id, case_number: caseData.case_number, owning_team_id: caseData.owning_team_id, justification: reassignJustification }) });
                          const j = await res.json();
                          if (j.pending) setReassignResult({ ok: true, message: 'You already have a pending request for this case.' });
                          else if (j.ok) setReassignResult({ ok: true, message: 'Your request has been submitted. A supervisor will review it shortly.' });
                          else setReassignResult({ ok: false, message: j.error || 'Failed to submit request.' });
                        } catch { setReassignResult({ ok: false, message: 'Failed to submit request.' }); }
                        finally { setReassignSubmitting(false); }
                      }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{reassignSubmitting ? 'Submitting...' : 'Notify Supervisor'}</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {mgmtAction && mgmtAction !== 'edit' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
                <h2 className="text-lg font-bold text-gray-900 mb-3">{mgmtAction === 'stage' ? 'Change Stage' : mgmtAction === 'assign' ? 'Assign Case' : 'Change Owning Team'}</h2>
                {mgmtError && <p className="text-sm text-red-600 mb-2">{mgmtError}</p>}
                {mgmtAction === 'stage' && (
                  <select value={mgmtValue} onChange={(e) => setMgmtValue(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm mb-4">
                    <option value="">Select stage...</option>
                    {['Intake','Diagnosing','Ordering','Quote Request','Quote Request - Hold','Quoted','Part Distribution','Repairing','Labor Claim','Depot Repair','Ready for Pickup','Pickup Scheduled','Ready for Delivery','Delivery Scheduled','Delivered','Completed','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {mgmtAction === 'assign' && (
                  <select value={mgmtValue} onChange={(e) => setMgmtValue(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm mb-4">
                    <option value="">Select user...</option>
                    <option value="__unassign__">— No Assignee —</option>
                    {usersList.map((u) => <option key={u.id} value={u.upn}>{u.display_name || u.upn}</option>)}
                  </select>
                )}
                {mgmtAction === 'team' && (
                  <select value={mgmtValue} onChange={(e) => setMgmtValue(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm mb-4">
                    <option value="">Select team...</option>
                    {Object.entries(teamsById).map(([tid, label]) => <option key={tid} value={tid}>{label}</option>)}
                  </select>
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setMgmtAction(null)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                  <button disabled={!mgmtValue.trim() || mgmtSaving} onClick={async () => {
                    if (mgmtAction === 'stage' && mgmtValue.trim() === 'Cancelled') { setMgmtAction(null); setCancelPopup(true); return; }
                    setMgmtSaving(true); setMgmtError(null);
                    const payload = {};
                    if (mgmtAction === 'stage') payload.advance_stage = mgmtValue.trim();
                    if (mgmtAction === 'assign') payload.assign_username = mgmtValue.trim() === '__unassign__' ? '__unassign__' : mgmtValue.trim();
                    if (mgmtAction === 'team') payload.owning_team_id = parseInt(mgmtValue);
                    if (!payload.advance_stage) payload.advance_stage = caseData.stage;
                    const label = mgmtAction === 'stage' ? mgmtValue.trim() : mgmtAction === 'assign' ? (mgmtValue.trim() === '__unassign__' ? 'Unassigned' : (usersList.find(u => u.upn === mgmtValue)?.display_name || mgmtValue)) : (teamsById[mgmtValue] || mgmtValue);
                    try {
                      const res = await fetch(`/api/cases/${id}/logistics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                      if (!res.ok) { const d = await res.json(); setMgmtError(d.error || 'Failed'); return; }
                      const updated = await fetch(`/api/cases/${id}`).then(r => r.json()).catch(() => null);
                      const newTeamLabel = updated?.data?.owning_team_id ? (teamsById[updated.data.owning_team_id] || '') : '';
                      setMgmtAction(null);
                      setAdvanceSuccess({
                        stage: updated?.data?.stage || payload.advance_stage,
                        team: mgmtAction === 'assign' ? '' : newTeamLabel,
                        assigned: mgmtAction === 'assign' ? (mgmtValue.trim() === '__unassign__' ? null : label) : undefined,
                      });
                      setTimeout(() => { window.location.reload(); }, 3000);
                    } catch { setMgmtError('Network error'); }
                    finally { setMgmtSaving(false); }
                  }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{mgmtSaving ? 'Saving...' : 'Apply'}</button>
                </div>
              </div>
            </div>
          )}
          {mgmtAction === 'edit' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMgmtAction(null)}>
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Edit Case: {caseData.case_number}</h2>
                {mgmtError && <p className="text-sm text-red-600 mb-3">{mgmtError}</p>}
                <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                  {[
                    { key: 'title', label: 'Title' },
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'facility', label: 'Facility' },
                    { key: 'requester_name', label: 'Requester Name' },
                    { key: 'requester_email', label: 'Requester Email' },
                    { key: 'requester_phone', label: 'Requester Phone' },
                    { key: 'poc_name', label: 'POC Name' },
                    { key: 'poc_email', label: 'POC Email' },
                    { key: 'poc_phone', label: 'POC Phone' },
                    { key: 'poc_address', label: 'POC Address' },
                    { key: 'request_source', label: 'Request Source', type: 'select', options: ['Service Desk', 'Technician', 'Leadership', 'PM', 'Direct', 'Savant'] },
                    { key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Normal', 'High', 'Critical'] },
                    { key: 'program', label: 'Program' },
                    { key: 'assigned_to_username', label: 'Assigned To', type: 'select', options: usersList.map(u => u.upn), labels: usersList.reduce((m, u) => { m[u.upn] = u.display_name || u.upn; return m; }, {}) },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-0.5">{f.label}</label>
                      {f.type === 'select' ? (
                        <select value={editData[f.key] || ''} onChange={e => setEditData(d => ({ ...d, [f.key]: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
                          <option value="">—</option>
                          {f.options.map(o => <option key={o} value={o}>{f.labels?.[o] || o}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={editData[f.key] || ''} onChange={e => setEditData(d => ({ ...d, [f.key]: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                      )}
                    </div>
                  ))}
                  <div className="col-span-2 max-sm:col-span-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-0.5">Description</label>
                    <textarea value={editData.description || ''} onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm min-h-[60px] resize-y" />
                  </div>
                </div>

                {caseData.workflow_key === 'refresh' && editData.refresh && (
                  <>
                    <h3 className="text-sm font-bold text-gray-800 mt-4 mb-2">Refresh Details</h3>
                    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                      {['manufacturer', 'device_type', 'serial_number', 'asset_tag', 'model', 'model_name', 'warranty_end', 'adp', 'damage_excuse'].map(k => (
                        <div key={k}>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-0.5">{k.replace(/_/g, ' ')}</label>
                          <input type="text" value={editData.refresh[k] || ''} onChange={e => setEditData(d => ({ ...d, refresh: { ...d.refresh, [k]: e.target.value } }))} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                        </div>
                      ))}
                      <div className="col-span-2 max-sm:col-span-1">
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-0.5">Issue Description</label>
                        <textarea value={editData.refresh?.issue_description || ''} onChange={e => setEditData(d => ({ ...d, refresh: { ...d.refresh, issue_description: e.target.value } }))} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm min-h-[50px] resize-y" />
                      </div>
                    </div>
                  </>
                )}

                {caseData.workflow_key === 'rma' && editData.rma && (
                  <>
                    <h3 className="text-sm font-bold text-gray-800 mt-4 mb-2">RMA Details</h3>
                    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                      {['manufacturer', 'product_id', 'serial_number', 'mac_address'].map(k => (
                        <div key={k}>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-0.5">{k.replace(/_/g, ' ')}</label>
                          <input type="text" value={editData.rma[k] || ''} onChange={e => setEditData(d => ({ ...d, rma: { ...d.rma, [k]: e.target.value } }))} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                        </div>
                      ))}
                      <div className="col-span-2 max-sm:col-span-1">
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-0.5">Issue Description</label>
                        <textarea value={editData.rma?.issue_description || ''} onChange={e => setEditData(d => ({ ...d, rma: { ...d.rma, issue_description: e.target.value } }))} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm min-h-[50px] resize-y" />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setMgmtAction(null)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                  <button disabled={editSaving} onClick={async () => {
                    setEditSaving(true); setMgmtError(null);
                    try {
                      const payload = {};
                      const caseFields = ['title', 'description', 'customer_name', 'facility', 'requester_name', 'requester_email', 'requester_phone', 'poc_name', 'poc_email', 'poc_phone', 'poc_address', 'request_source', 'priority', 'program'];
                      for (const f of caseFields) { if ((editData[f] || '') !== (caseData[f] || '')) payload[f] = editData[f] || ''; }
                      const origUpn = usersList.find(u => u.id === caseData.assigned_to_user_id)?.upn || '';
                      if ((editData.assigned_to_username || '') !== origUpn) payload.assigned_to_username = editData.assigned_to_username || '';
                      if (editData.refresh) {
                        const origRefresh = relatedData?.refresh || {};
                        for (const f of ['manufacturer', 'device_type', 'serial_number', 'asset_tag', 'model', 'model_name', 'warranty_end', 'adp', 'issue_description', 'damage_excuse']) {
                          if ((editData.refresh[f] || '') !== (origRefresh[f] || '')) payload[`refresh_${f}`] = editData.refresh[f] || '';
                        }
                      }
                      if (editData.rma) {
                        const origRma = relatedData?.rma || {};
                        for (const f of ['manufacturer', 'product_id', 'serial_number', 'mac_address', 'issue_description']) {
                          if ((editData.rma[f] || '') !== (origRma[f] || '')) payload[`rma_${f}`] = editData.rma[f] || '';
                        }
                      }
                      if (Object.keys(payload).length === 0) { setMgmtAction(null); return; }
                      const res = await fetch(`/api/cases/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                      if (!res.ok) { const d = await res.json().catch(() => ({})); setMgmtError(d.error || 'Save failed'); return; }
                      window.location.reload();
                    } catch { setMgmtError('Network error'); }
                    finally { setEditSaving(false); }
                  }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{editSaving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
        {mgmtAction === 'audit' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMgmtAction(null)}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Audit Log: {caseData.case_number}</h2>
              <AuditLogContent caseId={id} />
              <div className="flex justify-end mt-4"><button onClick={() => setMgmtAction(null)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Close</button></div>
            </div>
          </div>
        )}
        {cancelPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Cancel Case</h2>
              {mgmtError && <p className="text-sm text-red-600 mb-2">{mgmtError}</p>}
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cancellation Reason *</label>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Enter reason for cancellation..." className="w-full px-3 py-2 border border-slate-200 rounded text-sm mb-4" rows={3} required />
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">No Repair Return Location</label>
              <div className="flex items-center gap-2 mb-4">
                <input placeholder="Scan..." className="w-24 px-2 py-1.5 border border-dashed border-blue-300 rounded text-sm bg-blue-50" onInput={(e) => { const v = e.target.value; const m = v.match(/rack[:\s]*(\S+)[,\s]+shelf[:\s]*(\S+)/i); if (m) { setCancelLocation({ rack: m[1], shelf: m[2], crate: '' }); e.target.value = ''; } else if (/^[A-Za-z]\d{3,}$/.test(v.trim())) { setCancelLocation({ rack: '', shelf: '', crate: v.trim().toUpperCase() }); e.target.value = ''; } }} />
                <label className="text-xs text-gray-500">Rack</label>
                <input value={cancelLocation.rack} onChange={(e) => setCancelLocation(p => ({ ...p, rack: e.target.value, crate: '' }))} disabled={!!cancelLocation.crate} className="w-14 px-2 py-1.5 border border-slate-200 rounded text-sm text-center disabled:bg-slate-100" maxLength={5} />
                <label className="text-xs text-gray-500">Shelf</label>
                <input value={cancelLocation.shelf} onChange={(e) => setCancelLocation(p => ({ ...p, shelf: e.target.value, crate: '' }))} disabled={!!cancelLocation.crate} className="w-14 px-2 py-1.5 border border-slate-200 rounded text-sm text-center disabled:bg-slate-100" maxLength={5} />
                <span className="text-xs text-gray-400">or</span>
                <label className="text-xs text-gray-500">Crate</label>
                <input value={cancelLocation.crate} onChange={(e) => setCancelLocation(p => ({ ...p, crate: e.target.value, rack: '', shelf: '' }))} disabled={!!(cancelLocation.rack || cancelLocation.shelf)} className="w-14 px-2 py-1.5 border border-slate-200 rounded text-sm text-center disabled:bg-slate-100" maxLength={5} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setCancelPopup(false); setCancelReason(''); setCancelLocation({ rack: '', shelf: '', crate: '' }); }} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                <button disabled={!cancelReason.trim() || (!(cancelLocation.rack.trim() && cancelLocation.shelf.trim()) && !cancelLocation.crate.trim()) || mgmtSaving} onClick={async () => {
                  setMgmtSaving(true); setMgmtError(null);
                  try {
                    // 1. Advance stage to Cancelled (or Cancelled with route_coordinators for BER)
                    const isBER = cancelReason.trim() === 'System Board BER' || cancelReason.trim() === '>2 defective/damaged parts BER';
                    const advanceBody = isBER ? { advance_stage: 'Cancelled', owning_team_key: 'route_coordinators' } : { advance_stage: 'Cancelled' };
                    const res = await fetch(`/api/cases/${id}/logistics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(advanceBody) });
                    if (!res.ok) { const d = await res.json(); setMgmtError(d.error || 'Failed'); return; }
                    // 2. Add Cancellation note
                    await fetch(`/api/cases/${id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note_type: 'Cancellation', text: cancelReason.trim() }) });
                    // 3. Save No Repair Return location to AssetLocation
                    const loc = cancelLocation;
                    const locValid = (loc.rack.trim() && loc.shelf.trim()) || loc.crate.trim();
                    if (locValid) {
                      const locRes = await fetch(`/api/cases/${id}/notes`).then(r => r.ok ? r.json() : null);
                      const existing = locRes?.data?.find(n => n.note_type === 'AssetLocation');
                      let payload = { awaiting_part: { rack: '', shelf: '', crate: '' }, repaired: { rack: '', shelf: '', crate: '' }, no_repair_return: loc };
                      if (existing?.body) { try { const p = JSON.parse(existing.body); payload = { ...payload, awaiting_part: p.awaiting_part || payload.awaiting_part, repaired: p.repaired || payload.repaired }; } catch {} }
                      await fetch(`/api/cases/${id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note_type: 'AssetLocation', text: JSON.stringify(payload), replace: true }) });
                    }
                    setCancelPopup(false);
                    const updated = await fetch(`/api/cases/${id}`).then(r => r.json()).catch(() => null);
                    const newTeamLabel = updated?.data?.owning_team_id ? (teamsById[updated.data.owning_team_id] || (isBER ? 'route coordinators' : '')) : '';
                    const assignedLabel = updated?.data?.assigned_to_user_id ? (usersById[updated.data.assigned_to_user_id] || null) : null;
                    setAdvanceSuccess({ stage: 'Cancelled', team: newTeamLabel, assigned: assignedLabel });
                    setTimeout(() => { window.location.href = backPath; }, 3000);
                  } catch { setMgmtError('Network error'); }
                  finally { setMgmtSaving(false); }
                }} className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">{mgmtSaving ? 'Saving...' : 'Confirm Cancellation'}</button>
              </div>
            </div>
          </div>
        )}
        <details className="bg-white border border-slate-200 rounded-lg mb-6">
          <summary className="px-5 py-3 cursor-pointer text-sm font-bold text-gray-800 bg-slate-50 border-b border-slate-200 rounded-t-lg">Request Details</summary>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
              {caseFields.map(([label, value]) => (
                <div key={label} className={fieldCls}><span className={labelCls}>{label}</span><span className={valueCls}>{value || '-'}</span></div>
              ))}
            </div>
            {refError && <div className="mt-4 px-3 py-2 bg-amber-50 border border-amber-300 rounded text-sm text-amber-800">{refError} Showing raw IDs.</div>}
          </div>
        </details>
        </>
      )}

      {!loading && !error && !notFound && caseData && (
        <div className="flex flex-col gap-6">
          {relatedLoading && <div className="text-center py-4 text-gray-500 text-sm">Loading related data...</div>}
          {relatedError && <div className="text-center py-4 text-red-600 text-sm">{relatedError}</div>}

          {!relatedLoading && !relatedError && relatedData && (
            <>
              {/* RMA Details — only for RMA workflow */}
              {caseData.workflow_key === 'rma' && (
              <Panel title="RMA Details">
                {relatedData.rma ? <RmaForm rma={relatedData.rma} caseId={id} onSaved={() => { fetch(`/api/cases/${id}/related`).then((r) => r.ok ? r.json() : null).then((j) => { if (j) setRelatedData(j.data); }); }} /> : <div className="text-center py-4 text-gray-500 text-sm">No RMA data associated with this case</div>}
              </Panel>
              )}

              {/* Asset/Issue Description — only for Refresh workflow */}
              {caseData.workflow_key === 'refresh' && (
              <Panel title="Asset / Issue Description">
                {relatedData.refresh ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div><span className="font-semibold text-gray-600">Manufacturer:</span> <span>{relatedData.refresh.manufacturer || '-'}</span></div>
                    <div><span className="font-semibold text-gray-600">Device Type:</span> <span>{relatedData.refresh.device_type || '-'}</span></div>
                    <div><span className="font-semibold text-gray-600">Serial Number:</span> <span>{relatedData.refresh.serial_number || '-'}</span></div>
                    <div><span className="font-semibold text-gray-600">Asset Tag:</span> <span>{relatedData.refresh.asset_tag || '-'}</span></div>
                    <div><span className="font-semibold text-gray-600">Model Number:</span> <span>{relatedData.refresh.model || '-'}</span></div>
                    <div><span className="font-semibold text-gray-600">Model Name:</span> <span>{relatedData.refresh.model_name || '-'}</span></div>
                    <div><span className="font-semibold text-gray-600">Warranty End Date:</span> <span>{relatedData.refresh.warranty_end ? new Date(relatedData.refresh.warranty_end).toLocaleDateString() : '-'}</span></div>
                    <div><span className="font-semibold text-gray-600">ADP:</span> <span>{relatedData.refresh.adp || '-'}</span></div>
                    <div className="col-span-2"><span className="font-semibold text-gray-600">Issue Description:</span> <span>{relatedData.refresh.issue_description || '-'}</span></div>
                    <div className="col-span-2"><span className="font-semibold text-gray-600">Damage Excuse:</span> <span>{relatedData.refresh.damage_excuse || '-'}</span></div>
                  </div>
                ) : <div className="text-center py-4 text-gray-500 text-sm">No refresh data associated with this case</div>}
              </Panel>
              )}

              {/* Logistics — refresh workflow, post-intake */}
              {caseData.workflow_key === 'refresh' && caseData.stage !== 'Intake' && (
              <Panel title="Logistics">
                <LogisticsPanel caseId={id} stage={caseData.stage} />
              </Panel>
              )}

              {/* Notifications */}
              {relatedData.rma && (
                <Panel title="Notifications" badge="Manual Send Only">
                  <div className="flex gap-2 flex-wrap items-center mb-4">
                    <select value={notifType} onChange={(e) => { setNotifType(e.target.value); setNotifSendSuccess(null); setNotifSendError(null); setNotifConfirm(false); }} className="px-3 py-2 border border-slate-200 rounded-md text-sm" aria-label="Notification type">
                      <option value="">Select notification type…</option>
                      <option value="manufacturer_engaged">Manufacturer Engaged</option>
                      <option value="manufacturer_case_opened">Manufacturer Case Opened</option>
                      <option value="rma_approved_eta">RMA Approved – ETA</option>
                      <option value="inbound_tracking_available">Inbound Tracking Available</option>
                      <option value="rma_denied">RMA Denied</option>
                    </select>
                    <button onClick={handlePreviewNotification} disabled={!notifType || notifLoading} className="px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed">{notifLoading ? 'Loading…' : 'Preview Notification'}</button>
                  </div>
                  {notifError && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-800 mb-3">{notifError}</div>}
                  {notifPreview && (
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-3 inline-block">⚠ Preview Only — Not Sent</div>
                      {notifPreview.warnings?.length > 0 && <div className="mb-3">{notifPreview.warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 mb-1">⚠ {w}</div>)}</div>}
                      <div className="text-sm mb-1"><span className="font-semibold text-gray-600 mr-2">To:</span>{notifPreview.to.join(', ') || '—'}</div>
                      <div className="text-sm mb-1"><span className="font-semibold text-gray-600 mr-2">CC:</span>{notifPreview.cc.join(', ') || '—'}</div>
                      <div className="text-sm mb-1"><span className="font-semibold text-gray-600 mr-2">Subject:</span>{notifPreview.subject}</div>
                      <div className="mt-2"><span className="font-semibold text-gray-600 text-sm">Body:</span><pre className="mt-1 p-3 bg-white border border-slate-200 rounded text-xs whitespace-pre-wrap font-mono">{notifPreview.body}</pre></div>
                      <div className="mt-4 pt-3 border-t border-slate-200">
                        {!notifConfirm && !notifSendSuccess && <button onClick={() => setNotifConfirm(true)} disabled={notifSending} className="px-4 py-2 text-sm font-semibold rounded-md bg-green-600 text-white hover:bg-green-700">Send Manually</button>}
                        {notifConfirm && !notifSendSuccess && (
                          <div className="flex gap-2 items-center flex-wrap">
                            <span className="text-sm text-gray-700">Send to {notifPreview.to.join(', ')}?</span>
                            <button onClick={handleSendNotification} disabled={notifSending} className="px-4 py-2 text-sm font-semibold rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">{notifSending ? 'Sending…' : 'Confirm Send'}</button>
                            <button onClick={() => setNotifConfirm(false)} disabled={notifSending} className="px-4 py-2 text-sm font-semibold rounded-md bg-gray-500 text-white hover:bg-gray-600">Cancel</button>
                          </div>
                        )}
                        {notifSendSuccess && <div className="text-sm text-green-700 font-medium">✓ {notifSendSuccess}</div>}
                        {notifSendError && <div className="text-sm text-red-700 font-medium">{notifSendError}</div>}
                      </div>
                    </div>
                  )}
                </Panel>
              )}

              {/* Workflow Actions */}
              {relatedData.rma && (
                <Panel title="Workflow Actions" badge="Actions Enabled">
                  <div className="px-3 py-2 rounded text-sm mb-4 bg-blue-50 border border-blue-200 text-blue-800">
                    Actions record manual workflow events only. No email is sent automatically.
                  </div>
                  {wfActionSuccess && <div className="text-sm text-green-700 font-medium mb-3">✓ {wfActionSuccess}</div>}
                  {wfActionError && <div className="text-sm text-red-700 font-medium mb-3">{wfActionError}</div>}
                  <div className="flex flex-col gap-3">
                    {[
                      { action: 'manufacturer_engaged', label: 'Manufacturer Engaged', prereqs: [{ key: 'manufacturer', met: !!relatedData.rma.manufacturer }] },
                      { action: 'manufacturer_case_opened', label: 'Manufacturer Case Opened', prereqs: [{ key: 'manufacturer', met: !!relatedData.rma.manufacturer }, { key: 'vendor_sr_number', met: !!relatedData.rma.vendor_sr_number }] },
                      { action: 'rma_approved_eta_established', label: 'RMA Approved / ETA Established', prereqs: [{ key: 'rma_number', met: !!relatedData.rma.rma_number }, { key: 'replacement_ship_promised_at', met: !!relatedData.rma.replacement_ship_promised_at }, { key: 'product_id', met: !!relatedData.rma.product_id }] },
                      { action: 'inbound_tracking_available', label: 'Inbound Tracking Available', prereqs: [{ key: 'inbound_tracking', met: !!relatedData.rma.inbound_tracking }] },
                      { action: 'rma_denied', label: 'RMA Denied', prereqs: [{ key: 'denial indicated', met: (relatedData.rma.rma_status || '').toLowerCase() === 'denied' || (relatedData.rma.entitlement_status || '').toLowerCase() === 'denied' }] },
                      { action: 'rma_completed', label: 'RMA Completed', prereqs: [{ key: 'rma_status=Completed', met: (relatedData.rma.rma_status || '').toLowerCase() === 'completed' }] },
                    ].map(({ action, label, prereqs }) => {
                      const allMet = prereqs.every((p) => p.met);
                      const missingList = prereqs.filter((p) => !p.met).map((p) => p.key);
                      const isRunning = wfActionRunning === action;
                      const isConfirming = wfActionConfirm === action;
                      const disabled = !allMet || !!wfActionRunning;
                      return (
                        <div key={action} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                          <div><span className="text-sm font-medium text-gray-800">{label}</span>{allMet ? <span className="ml-2 text-xs text-green-600 font-semibold">✓ Ready</span> : <span className="ml-2 text-xs text-amber-600">Missing: {missingList.join(', ')}</span>}</div>
                          <div className="flex gap-1">
                            {!isConfirming && <button disabled={disabled} onClick={() => { setWfActionConfirm(action); setWfActionError(null); setWfActionSuccess(null); }} className="px-3 py-1 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">{isRunning ? 'Running…' : 'Record Action'}</button>}
                            {isConfirming && <><button disabled={!!wfActionRunning} onClick={() => handleWorkflowAction(action)} className="px-3 py-1 text-xs font-semibold rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">{isRunning ? 'Running…' : 'Confirm'}</button><button disabled={!!wfActionRunning} onClick={() => setWfActionConfirm(null)} className="px-3 py-1 text-xs font-semibold rounded-md bg-gray-500 text-white hover:bg-gray-600">Cancel</button></>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              )}

              {/* Activity / Timeline */}
              <Panel title="Activity / Timeline" headerAction={isManagerOrSupervisor ? <button onClick={() => setManagingNotes(!managingNotes)} className={`px-2 py-0.5 text-xs rounded ${managingNotes ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>{managingNotes ? 'Done' : 'Manage'}</button> : null}>
                {(() => { const notes = (relatedData.notes || []).filter((n) => ACTIVITY_NOTE_TYPES.includes(n.note_type)); if (!notes.length) return <div className="text-center py-4 text-gray-500 text-sm">No activity records</div>; return notes.map((note) => <TimelineEntry key={note.id} note={note} formatDate={formatDate} managing={managingNotes} onDelete={isManagerOrSupervisor ? async (noteId) => { await fetch(`/api/cases/${id}/notes?note_id=${noteId}`, { method: 'DELETE' }); setRelatedData(prev => ({ ...prev, notes: prev.notes.filter(n => n.id !== noteId) })); } : null} />); })()}
              </Panel>

              {/* Notes */}
              <Panel title="Notes" headerAction={isManagerOrSupervisor ? <button onClick={() => setManagingNotes(!managingNotes)} className={`px-2 py-0.5 text-xs rounded ${managingNotes ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>{managingNotes ? 'Done' : 'Manage'}</button> : null}>
                <AddNoteForm caseId={id} workflowKey={caseData.workflow_key} editLocked={editLocked} onEditBlocked={() => { setReassignPopup(true); setReassignResult(null); setReassignJustification(''); }} onAdded={() => { fetch(`/api/cases/${id}/related`).then((r) => r.ok ? r.json() : null).then((j) => { if (j) setRelatedData(j.data); }); }} onClearAwaitingPart={async () => { const cleared = { awaiting_part: { rack: '', shelf: '', crate: '' }, repaired: assetLocation?.repaired || { rack: '', shelf: '', crate: '' } }; setAssetLocation(cleared); await fetch(`/api/cases/${id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note_type: 'AssetLocation', text: JSON.stringify(cleared), replace: true }) }); setLocationKey(k => k + 1); }} />
                {(() => { const notes = (relatedData.notes || []).filter((n) => !ACTIVITY_NOTE_TYPES.includes(n.note_type) && n.note_type !== 'AssetLocation'); if (!notes.length) return <div className="text-center py-4 text-gray-500 text-sm">No notes</div>; return notes.map((note) => <TimelineEntry key={note.id} note={note} formatDate={formatDate} managing={managingNotes} onDelete={isManagerOrSupervisor ? async (noteId) => { await fetch(`/api/cases/${id}/notes?note_id=${noteId}`, { method: 'DELETE' }); setRelatedData(prev => ({ ...prev, notes: prev.notes.filter(n => n.id !== noteId) })); } : null} />); })()}
              </Panel>

              {/* Diagnostic outcome-driven panels for refresh workflow */}
              {caseData.workflow_key === 'refresh' && (
                <DiagnosticOutcomePanels key={locationKey} caseId={id} caseStage={caseData.stage} program={caseData.program} notes={relatedData.notes || []} editLocked={editLocked} isManager={isManagerOrSupervisor} onRequestAccess={() => { setReassignPopup(true); setReassignResult(null); setReassignJustification(''); }} owningTeamLabel={resolveTeam(caseData.owning_team_id)} onAssetLocationSaved={(data) => { setAssetLocation(data); fetch(`/api/cases/${id}/defective-parts`).then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setDefectiveParts(d.data); }); fetch(`/api/cases/${id}/reseated-parts`).then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setReseatedParts(d.data); }); }} onDepotSaved={(data) => setDepotRepair(data)} onPartsChanged={(parts) => { setDefectiveParts(parts); if (caseData.program === 'Refresh - Spring ISD') { if (parts.some(p => (p.part_name || '').toLowerCase().includes('system board'))) { setCancelReason('System Board BER'); setCancelPopup(true); } else if (parts.length > 2) { setCancelReason('>2 defective/damaged parts BER'); setCancelPopup(true); } } }} warrantyEnd={relatedData?.refresh?.warranty_end} />
              )}

              {caseData.workflow_key !== 'refresh' && (
              <Panel title="Requirements">
                {relatedData.requirements?.length > 0 ? relatedData.requirements.map((req) => (
                  <div key={req.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                    <span className={`text-sm ${req.is_present ? 'text-green-600' : 'text-gray-400'}`}>{req.is_present ? '✓' : '○'}</span>
                    <span className="text-sm text-gray-700">{req.label}</span>
                    {req.is_required && <span className="text-xs text-red-600 font-semibold ml-auto">Required</span>}
                  </div>
                )) : <div className="text-center py-4 text-gray-500 text-sm">No requirements defined</div>}
              </Panel>
              )}
            </>
          )}
        </div>
      )}

      {caseData?.stage === 'Diagnosing' && (() => {
        const hasNoIssue = (relatedData?.notes || []).some(n => n.note_type === 'Diagnostic' && n.body?.startsWith('[No Issue Found]'));
        const repairedFilled = assetLocation?.repaired && ((assetLocation.repaired.rack?.trim() && assetLocation.repaired.shelf?.trim()) || assetLocation.repaired.crate?.trim());
        const awaitingFilled = assetLocation?.awaiting_part && ((assetLocation.awaiting_part.rack?.trim() && assetLocation.awaiting_part.shelf?.trim()) || assetLocation.awaiting_part.crate?.trim());
        const partsReady = defectiveParts.length > 0 && awaitingFilled;
        const reseatReady = reseatedParts.length > 0 && repairedFilled;
        const depotReady = depotRepair?.manufacturer_case_number?.trim() && depotRepair?.engagement_date?.trim();
        const hasAdditionalPartRequest = (relatedData?.notes || []).some(n => n.note_type === 'Additional Part Request' && n.body?.startsWith('[Part(s) Required]'));
        const additionalPartReady = hasAdditionalPartRequest && awaitingFilled;
        const isBERCandidate = (caseData.program || '') === 'Refresh - Spring ISD' && defectiveParts.some(p => (p.part_name || '').toLowerCase().includes('system board'));
        const isMultiBER = (caseData.program || '') === 'Refresh - Spring ISD' && defectiveParts.length > 2;
        const showButton = partsReady || additionalPartReady || reseatReady || (hasNoIssue && repairedFilled) || depotReady || isBERCandidate || isMultiBER;
        if (!showButton) return null;
        const allInStock = partsReady && defectiveParts.every(p => p.stock_status === 'In Stock');
        const anyOutOfStock = partsReady && defectiveParts.some(p => p.stock_status !== 'In Stock');
        const program = caseData.program || '';
        const warrantyEnd = relatedData?.refresh?.warranty_end;
        const warrantyExpired = warrantyEnd ? new Date(warrantyEnd) < new Date() : false;

        let nextStage, nextTeam;
        if (depotReady) { nextStage = 'Depot Repair'; nextTeam = 'computer_technicians'; }
        else if (hasNoIssue && repairedFilled) { nextStage = 'Ready for Delivery'; nextTeam = 'route_coordinators'; }
        else if (reseatReady) {
          if (warrantyEnd && new Date(warrantyEnd) >= new Date()) { nextStage = 'Labor Claim'; nextTeam = 'order_administrators'; }
          else { nextStage = 'Ready for Delivery'; nextTeam = 'route_coordinators'; }
        }
        else if (hasAdditionalPartRequest) {
          const warrantyValid = warrantyEnd && new Date(warrantyEnd) >= new Date();
          if (warrantyValid) { nextStage = 'Ordering'; nextTeam = 'order_administrators'; }
          else { nextStage = 'Quote Request'; nextTeam = 'quote_administrators'; }
        } else if (program === 'Refresh - Spring ISD') {
          const hasSystemBoard = defectiveParts.some(p => (p.part_name || '').toLowerCase().includes('system board'));
          if (hasSystemBoard) { nextStage = '__BER_CANCEL__'; nextTeam = 'route_coordinators'; }
          else if (defectiveParts.length > 2) { nextStage = '__BER_CANCEL_MULTI__'; nextTeam = 'route_coordinators'; }
          else if (defectiveParts.length === 2) { nextStage = 'Quote Request - Hold'; nextTeam = 'quote_administrators'; }
          else if (allInStock) { nextStage = 'Part Distribution'; nextTeam = 'parts_administrators'; }
          else { nextStage = 'Quote Request'; nextTeam = 'quote_administrators'; }
        } else if (program === 'Operations') {
          if (warrantyExpired) { nextStage = 'Quote Request'; nextTeam = 'quote_administrators'; }
          else if (anyOutOfStock) { nextStage = 'Ordering'; nextTeam = 'order_administrators'; }
          else { nextStage = 'Part Distribution'; nextTeam = 'parts_administrators'; }
        } else {
          nextStage = allInStock ? 'Part Distribution' : 'Ordering';
          nextTeam = allInStock ? 'parts_administrators' : 'order_administrators';
        }

        const diagType = depotReady ? 'Sending to Depot' : (hasNoIssue && repairedFilled) ? 'No Issue Found' : reseatReady ? 'Reseat Fix' : 'Part(s) Required';
        return (
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg" ref={el => { if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' }); }}>
            {advanceError && <p className="text-sm text-red-600 mb-2">{advanceError}</p>}
            <button onClick={async () => {
              if (nextStage === '__BER_CANCEL__') { setCancelReason('System Board BER'); setCancelPopup(true); return; }
              if (nextStage === '__BER_CANCEL_MULTI__') { setCancelReason('>2 defective/damaged parts BER'); setCancelPopup(true); return; }
              if (warrantyEnd && new Date(warrantyEnd) >= new Date()) {
                const missingFailureId = defectiveParts.filter(p => (p.condition === 'Defective' || p.condition === 'Damaged') && !p.failure_id);
                if (missingFailureId.length > 0) { setAdvanceError('Failure ID is required for all defective/damaged parts while unit is under warranty.'); return; }
              }
              setAdvancingStage(true); setAdvanceError(null);
              try {
                const res = await fetch(`/api/cases/${id}/logistics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ advance_stage: nextStage, owning_team_key: nextTeam, activity_note: `diagnostics complete:${diagType}`, assign_to_self: depotReady }) });
                if (!res.ok) { const d = await res.json(); setAdvanceError(d.error || 'Failed'); return; }
                setAdvanceSuccess({ stage: nextStage, team: nextTeam?.replace(/_/g, ' ') }); setTimeout(() => { window.location.href = '/cases'; }, 3000);
              } catch { setAdvanceError('Network error'); }
              finally { setAdvancingStage(false); }
            }} disabled={advancingStage} className="px-5 py-2 text-sm font-semibold rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">{advancingStage ? 'Advancing...' : 'Next Stage'}</button>
          </div>
        );
      })()}

      {caseData?.stage === 'Repairing' && (() => {
        const hasRepairSuccess = (relatedData?.notes || []).some(n => n.note_type === 'Repair' && n.body?.startsWith('[Repair Successful]'));
        const repairedFilled = assetLocation?.repaired && ((assetLocation.repaired.rack?.trim() && assetLocation.repaired.shelf?.trim()) || assetLocation.repaired.crate?.trim());
        const awaitingFilled = assetLocation?.awaiting_part && ((assetLocation.awaiting_part.rack?.trim() && assetLocation.awaiting_part.shelf?.trim()) || assetLocation.awaiting_part.crate?.trim());
        const depotReady = depotRepair?.manufacturer_case_number?.trim() && depotRepair?.engagement_date?.trim();
        const repairReady = hasRepairSuccess && repairedFilled;
        const hasAdditionalPartRequest = (relatedData?.notes || []).some(n => n.note_type === 'Additional Part Request' && n.body?.startsWith('[Part(s) Required]'));
        const additionalPartReady = hasAdditionalPartRequest && awaitingFilled;
        if (!repairReady && !depotReady && !additionalPartReady) return null;
        const warrantyEnd = relatedData?.refresh?.warranty_end;
        const warrantyExpired = warrantyEnd ? new Date(warrantyEnd) < new Date() : false;
        let nextStage, nextTeam, note, assignSelf = false;
        if (additionalPartReady && !repairReady) {
          const warrantyValid = warrantyEnd && new Date(warrantyEnd) >= new Date();
          if (warrantyValid) { nextStage = 'Ordering'; nextTeam = 'order_administrators'; }
          else { nextStage = 'Quote Request'; nextTeam = 'quote_administrators'; }
          note = 'additional part required';
        } else if (depotReady && !repairReady) { nextStage = 'Depot Repair'; nextTeam = 'computer_technicians'; note = 'sent to depot'; assignSelf = true; }
        else { nextStage = 'Ready for Delivery'; nextTeam = 'route_coordinators'; note = 'repair complete'; }
        return (
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg" ref={el => { if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' }); }}>
            {advanceError && <p className="text-sm text-red-600 mb-2">{advanceError}</p>}
            <button onClick={async () => {
              if (warrantyEnd && new Date(warrantyEnd) >= new Date()) {
                const missingFailureId = defectiveParts.filter(p => (p.condition === 'Defective' || p.condition === 'Damaged') && !p.failure_id);
                if (missingFailureId.length > 0) { setAdvanceError('Failure ID is required for all defective/damaged parts while unit is under warranty.'); return; }
              }
              setAdvancingStage(true); setAdvanceError(null);
              try {
                // Check if service fee needs a quote
                if (hasRepairSuccess && !assignSelf) {
                  const odRes = await fetch(`/api/cases/${id}/order-details`);
                  if (odRes.ok) {
                    const odData = await odRes.json();
                    const sfRecord = (odData.data || []).find(d => d.detail_type === 'service_fee');
                    const caseRes = await fetch(`/api/cases/${id}`);
                    const caseJson = caseRes.ok ? await caseRes.json() : null;
                    const progRes = await fetch('/api/admin/programs');
                    const progJson = progRes.ok ? await progRes.json() : null;
                    const prog = (progJson?.data || []).find(p => p.name === caseJson?.data?.program);
                    if (prog?.service_fee && (!sfRecord || !sfRecord.quote_number)) {
                      nextStage = 'Quote Request'; nextTeam = 'quote_administrators';
                    }
                  }
                }
                const res = await fetch(`/api/cases/${id}/logistics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ advance_stage: nextStage, owning_team_key: nextTeam, activity_note: note, assign_to_self: assignSelf }) });
                if (!res.ok) { const d = await res.json(); setAdvanceError(d.error || 'Failed'); return; }
                setAdvanceSuccess({ stage: nextStage, team: nextTeam?.replace(/_/g, ' ') }); setTimeout(() => { window.location.href = '/cases'; }, 3000);
              } catch { setAdvanceError('Network error'); }
              finally { setAdvancingStage(false); }
            }} disabled={advancingStage} className="px-5 py-2 text-sm font-semibold rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">{advancingStage ? 'Advancing...' : 'Next Stage'}</button>
          </div>
        );
      })()}

      {caseData?.stage === 'Delivered' && (
        <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          {advanceError && <p className="text-sm text-red-600 mb-2">{advanceError}</p>}
          <button onClick={async () => {
            setAdvancingStage(true); setAdvanceError(null);
            try {
              const res = await fetch(`/api/cases/${id}/logistics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ advance_stage: 'Complete', activity_note: 'case closed' }) });
              if (!res.ok) { const d = await res.json(); setAdvanceError(d.error || 'Failed'); return; }
              await fetch(`/api/cases/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ closed_at: new Date().toISOString() }) });
              setAdvanceSuccess({ stage: 'Complete', team: 'closed' }); setTimeout(() => { window.location.href = '/cases'; }, 3000);
            } catch { setAdvanceError('Network error'); }
            finally { setAdvancingStage(false); }
          }} disabled={advancingStage} className="px-5 py-2 text-sm font-semibold rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{advancingStage ? 'Closing...' : 'Close Case'}</button>
        </div>
      )}

      {approvedReassignment && (
        <div className="mt-6 p-4 rounded-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>You have been temporarily assigned to this case. When your update is complete, click below to return the case to the original owning team.</p>
          {advanceError && <p className="text-sm text-red-600 mb-2">{advanceError}</p>}
          <button onClick={async () => {
            setAdvancingStage(true); setAdvanceError(null);
            try {
              const res = await fetch(`/api/case-reassignment/${approvedReassignment.id}/return`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
              if (!res.ok) { const d = await res.json(); setAdvanceError(d.error || 'Failed'); return; }
              setApprovedReassignment(null);
              setAdvanceSuccess({ stage: caseData.stage, team: resolveTeam(approvedReassignment.original_owning_team_id) });
              setTimeout(() => { window.location.href = backPath; }, 3000);
            } catch { setAdvanceError('Network error'); }
            finally { setAdvancingStage(false); }
          }} disabled={advancingStage} className="px-5 py-2 text-sm font-semibold rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">{advancingStage ? 'Returning...' : 'Update Complete'}</button>
        </div>
      )}

    </div>
  );
}

function Panel({ title, badge, headerAction, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        <div className="flex items-center gap-2">
          {badge && <span className="text-xs font-semibold text-gray-500 bg-white border border-slate-200 rounded px-2 py-0.5">{badge}</span>}
          {headerAction}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function TimelineEntry({ note, formatDate, onDelete, managing }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-blue-700 bg-blue-50 rounded px-1.5 py-0.5">{note.note_type}</span>
        {note.created_by && <span className="text-xs text-gray-600 font-medium">{note.created_by}</span>}
        <span className="text-xs text-gray-500">{formatDate(note.created_at)}</span>
        {managing && onDelete && !confirmDelete && <button onClick={() => setConfirmDelete(true)} className="ml-auto w-5 h-5 flex items-center justify-center text-xs text-red-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">✕</button>}
        {managing && confirmDelete && (
          <span className="ml-auto flex items-center gap-1">
            <span className="text-xs text-red-600">Delete?</span>
            <button onClick={() => { onDelete(note.id); setConfirmDelete(false); }} className="text-xs font-semibold text-red-600 hover:text-red-800 px-1">Yes</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 hover:text-gray-700 px-1">No</button>
          </span>
        )}
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.body}</p>
    </div>
  );
}

const REFRESH_NOTE_TYPES = ['Diagnostic', 'Repair', 'Additional Part Request', 'Quality Assurance', 'InformationCollection'];
const RMA_NOTE_TYPES = ['Note', 'InformationCollection'];

function AddNoteForm({ caseId, workflowKey, onAdded, onClearAwaitingPart, editLocked, onEditBlocked }) {
  const [noteType, setNoteType] = useState('');
  const [text, setText] = useState('');
  const [diagnosticOutcome, setDiagnosticOutcome] = useState('');
  const [repairOutcome, setRepairOutcome] = useState('');
  const [partRequestOutcome, setPartRequestOutcome] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const noteTypes = workflowKey === 'refresh' ? REFRESH_NOTE_TYPES : RMA_NOTE_TYPES;

  async function handleSubmit(e) {
    e.preventDefault();
    if (editLocked) { onEditBlocked?.(); return; }
    setError(null);
    setSubmitting(true);
    let body = text;
    if (noteType === 'Diagnostic' && diagnosticOutcome) body = `[${diagnosticOutcome}] ${text}`;
    else if (noteType === 'Repair' && repairOutcome) body = `[${repairOutcome}] ${text}`;
    else if (noteType === 'Additional Part Request' && partRequestOutcome) body = `[${partRequestOutcome}] ${text}`;
    try {
      const res = await fetch(`/api/cases/${caseId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_type: noteType, text: body }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return; }
      if (noteType === 'Additional Part Request' && onClearAwaitingPart) await onClearAwaitingPart();
      const wasUnsuccessful = noteType === 'Repair' && repairOutcome === 'Repair Unsuccessful';
      setNoteType(wasUnsuccessful ? 'Additional Part Request' : '');
      setText('');
      setDiagnosticOutcome('');
      setRepairOutcome('');
      setPartRequestOutcome('');
      if (onAdded) onAdded();
    } catch { setError('Network error'); }
    finally { setSubmitting(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 pb-4 border-b border-slate-200">
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      <div className="flex gap-2 mb-2 flex-wrap">
        <select value={noteType} onChange={(e) => { setNoteType(e.target.value); if (e.target.value !== 'Diagnostic') setDiagnosticOutcome(''); if (e.target.value !== 'Repair') setRepairOutcome(''); if (e.target.value !== 'Additional Part Request') setPartRequestOutcome(''); }} required className="px-3 py-1.5 border border-slate-200 rounded text-sm">
          <option value="">Note type...</option>
          {noteTypes.map((t) => <option key={t} value={t}>{t === 'InformationCollection' ? 'Information Collection' : t}</option>)}
        </select>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Enter note..." required className="w-full px-3 py-2 border border-slate-200 rounded text-sm mb-2" rows={3} />
      {noteType === 'Diagnostic' && (
        <div className="flex flex-wrap gap-4 mb-2">
          {['Part(s) Required', 'Reseat Fix', 'No Issue Found', 'Sending to Depot'].map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
              <input type="radio" name="diagnostic_outcome" value={opt} checked={diagnosticOutcome === opt} onChange={(e) => setDiagnosticOutcome(e.target.value)} />
              {opt}
            </label>
          ))}
        </div>
      )}
      {noteType === 'Repair' && (
        <div className="flex flex-wrap gap-4 mb-2">
          {['Repair Successful', 'Repair Unsuccessful'].map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
              <input type="radio" name="repair_outcome" value={opt} checked={repairOutcome === opt} onChange={(e) => setRepairOutcome(e.target.value)} />
              {opt}
            </label>
          ))}
        </div>
      )}
      {noteType === 'Additional Part Request' && (
        <div className="flex flex-wrap gap-4 mb-2">
          {['Part(s) Required', 'Sending to Depot'].map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
              <input type="radio" name="part_request_outcome" value={opt} checked={partRequestOutcome === opt} onChange={(e) => setPartRequestOutcome(e.target.value)} />
              {opt}
            </label>
          ))}
        </div>
      )}
      <button type="submit" disabled={submitting || !noteType || !text.trim() || (noteType === 'Diagnostic' && !diagnosticOutcome) || (noteType === 'Repair' && !repairOutcome) || (noteType === 'Additional Part Request' && !partRequestOutcome)} className="px-4 py-1.5 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">Add Note</button>
    </form>
  );
}

function DefectivePartsPanel({ caseId, program, onPartsChanged, editLocked, onEditBlocked, warrantyEnd }) {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [partName, setPartName] = useState('');
  const [partOpen, setPartOpen] = useState(false);
  const [partNumber, setPartNumber] = useState('');
  const [condition, setCondition] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [mismatch, setMismatch] = useState(null);
  const [editPart, setEditPart] = useState(null);
  const [editForm, setEditForm] = useState({ part_name: '', part_number: '', condition: '', failure_id: '' });
  const [editPartOpen, setEditPartOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [failureIdPrompt, setFailureIdPrompt] = useState(null);
  const [failureIdInput, setFailureIdInput] = useState('');
  const [failureIdSaving, setFailureIdSaving] = useState(false);
  const warrantyValid = warrantyEnd && new Date(warrantyEnd) >= new Date();
  const needsFailureId = (cond) => warrantyValid && (cond === 'Defective' || cond === 'Damaged');

  async function fetchParts(notify) {
    const res = await fetch(`/api/cases/${caseId}/defective-parts`);
    if (res.ok) { const d = await res.json(); setParts(d.data || []); if (notify && onPartsChanged) onPartsChanged(d.data || []); }
    setLoading(false);
  }
  useEffect(() => { fetchParts(false); }, [caseId]);
  useEffect(() => { fetch('/api/reference/defective-parts').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setCatalog(d.data); }).catch(() => {}); }, []);

  async function submitPart(name, number, cond) {
    if (editLocked) { onEditBlocked?.(); return; }
    setSubmitting(true); setError(null);
    if (!catalog.some(c => c.name === name)) { setError('Part must be selected from the catalog'); setSubmitting(false); return; }
    try {
      const res = await fetch(`/api/cases/${caseId}/defective-parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part_name: name, part_number: number, condition: cond }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return; }
      setPartName(''); setPartNumber(''); setCondition('');
      await fetchParts(true);
      if (needsFailureId(cond)) {
        const latest = await fetch(`/api/cases/${caseId}/defective-parts`).then(r => r.ok ? r.json() : null);
        const added = (latest?.data || []).find(p => p.part_name === name && !p.failure_id);
        if (added) { setFailureIdPrompt(added); setFailureIdInput(''); }
      }
    } catch { setError('Network error'); }
    finally { setSubmitting(false); }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError(null); setMismatch(null);
    if (!partNumber.trim()) { await submitPart(partName, partNumber, condition); return; }
    try {
      const stockUrl = program
        ? `/api/stock?search=${encodeURIComponent(partNumber.trim())}&pool=${encodeURIComponent(program)}`
        : `/api/stock?search=${encodeURIComponent(partNumber.trim())}`;
      const res = await fetch(stockUrl);
      if (res.ok) {
        const d = await res.json();
        const match = (d.data || []).find(p => p.part_no.toLowerCase() === partNumber.trim().toLowerCase());
        if (match && match.description && match.description.toLowerCase() !== partName.trim().toLowerCase() && match.description !== 'Uncatalogued') {
          setMismatch({ inventoryDesc: match.description, enteredName: partName, partNumber: partNumber, condition });
          return;
        }
      }
    } catch {}
    await submitPart(partName, partNumber, condition);
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="mb-4 pb-4 border-b border-slate-200">
        {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          <div className="relative">
            <label className="block text-xs text-gray-500 mb-1">Part *</label>
            <input value={partName} onChange={(e) => { setPartName(e.target.value); setPartOpen(true); }} onFocus={() => setPartOpen(true)} onBlur={() => setTimeout(() => { setPartOpen(false); if (partName && !catalog.some(c => c.name === partName)) setPartName(''); }, 150)} placeholder="Search part..." className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" autoComplete="off" required />
            {partOpen && partName.length >= 1 && (() => {
              const matches = catalog.filter((c) => c.name.toLowerCase().includes(partName.toLowerCase())).slice(0, 8);
              if (!matches.length) return null;
              return (
                <ul className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto rounded shadow-lg text-sm bg-white border border-slate-200">
                  {matches.map((c) => <li key={c.id} className="px-2 py-1.5 cursor-pointer hover:bg-blue-50" onMouseDown={() => { setPartName(c.name); setPartOpen(false); }}>{c.name}</li>)}
                </ul>
              );
            })()}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Part Number</label>
            <input value={partNumber} onChange={(e) => setPartNumber(e.target.value.toUpperCase())} placeholder="Part #" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Condition *</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value)} required className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
              <option value="">Select...</option>
              <option value="Damaged">Damaged</option>
              <option value="Defective">Defective</option>
              <option value="Missing">Missing</option>
            </select>
          </div>
          <button type="submit" disabled={submitting || !partName.trim() || !condition} className="px-3 py-1.5 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">Add</button>
        </div>
      </form>
      {mismatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setMismatch(null)}>
          <div className="rounded-lg shadow-xl p-6 w-full max-w-md" style={{ background: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3 text-red-600">Part Description Mismatch</h3>
            <p className="text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>The part description provided doesn't match the part number's description in inventory records.</p>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>In inventory, part is labeled "<strong>{mismatch.inventoryDesc}</strong>".</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setMismatch(null)} className="px-4 py-1.5 text-sm rounded border border-slate-200 text-gray-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => { setPartName(mismatch.inventoryDesc); setMismatch(null); }} className="px-4 py-1.5 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700">Use Inventory Description</button>
            </div>
          </div>
        </div>
      )}
      {failureIdPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg shadow-xl p-6 w-full max-w-sm bg-white" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 mb-2">Failure ID Required</h3>
            <p className="text-xs text-gray-600 mb-3">This unit is under warranty. Please provide the Failure ID for "<strong>{failureIdPrompt.part_name}</strong>".</p>
            {!failureIdPrompt.unavailable ? (
              <>
                <input value={failureIdInput} onChange={e => setFailureIdInput(e.target.value.toUpperCase())} placeholder="Enter Failure ID" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm mb-3" autoFocus />
                <button type="button" onClick={() => { setFailureIdPrompt(p => ({ ...p, unavailable: true })); setFailureIdInput(''); }} className="text-xs text-blue-600 hover:underline mb-3 block">Failure ID Unavailable</button>
              </>
            ) : (
              <>
                <select value={failureIdInput} onChange={e => setFailureIdInput(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm mb-3" autoFocus>
                  <option value="">Select reason...</option>
                  <option value="No Power">No Power</option>
                  <option value="Boot Loop">Boot Loop</option>
                  <option value="I/O Inaccessible">I/O Inaccessible</option>
                  <option value="Diagnostics Passed/Symptoms Observed">Diagnostics Passed/Symptoms Observed</option>
                  <option value="Intermittent">Intermittent</option>
                  <option value="Testing Not Available For Part">Testing Not Available For Part</option>
                </select>
                <button type="button" onClick={() => { setFailureIdPrompt(p => ({ ...p, unavailable: false })); setFailureIdInput(''); }} className="text-xs text-blue-600 hover:underline mb-3 block">Enter Failure ID instead</button>
              </>
            )}
            <div className="flex gap-2 justify-end">
              <button disabled={!failureIdInput.trim() || failureIdSaving} onClick={async () => {
                setFailureIdSaving(true);
                const valueToSave = failureIdPrompt.unavailable ? `No FID: ${failureIdInput}` : failureIdInput;
                try {
                  const res = await fetch(`/api/cases/${caseId}/defective-parts`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: failureIdPrompt.id, failure_id: valueToSave }) });
                  if (res.ok) { setFailureIdPrompt(null); await fetchParts(true); }
                } catch {}
                finally { setFailureIdSaving(false); }
              }} className="px-4 py-1.5 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">{failureIdSaving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
      {loading && <div className="text-xs text-gray-500">Loading...</div>}
      {!loading && parts.length === 0 && <div className="text-center py-3 text-gray-500 text-sm">No defective parts logged</div>}
      {!loading && parts.length > 0 && (
        <table className="w-full text-sm border-collapse">
          <thead><tr><th className="text-left text-xs font-semibold text-gray-500 pb-2">Part</th><th className="text-left text-xs font-semibold text-gray-500 pb-2">Part Number</th><th className="text-left text-xs font-semibold text-gray-500 pb-2">Condition</th>{warrantyValid && <th className="text-left text-xs font-semibold text-gray-500 pb-2">Failure ID</th>}<th className="text-left text-xs font-semibold text-gray-500 pb-2">Stock</th><th className="text-left text-xs font-semibold text-gray-500 pb-2">Added By</th><th className="text-left text-xs font-semibold text-gray-500 pb-2">Added</th><th className="text-left text-xs font-semibold text-gray-500 pb-2">Part Issued</th><th className="text-left text-xs font-semibold text-gray-500 pb-2"></th></tr></thead>
          <tbody>{parts.map((p) => <tr key={p.id} className="border-t border-slate-100"><td className="py-2 text-gray-700">{p.part_name || '-'}</td><td className="py-2 text-gray-700">{p.part_number || '-'}</td><td className="py-2 text-gray-700">{p.condition || '-'}</td>{warrantyValid && <td className="py-2 text-gray-700 text-xs">{needsFailureId(p.condition) ? (p.failure_id || <span className="text-red-600 font-semibold">Required</span>) : <span className="text-gray-400">N/A</span>}</td>}<td className="py-2"><span className="relative inline-block">{p.stock_status === 'In Stock' ? <span className="text-green-600 font-semibold text-xs">In Stock</span> : p.stock_status === 'Out of Stock' ? <span className="text-red-600 font-semibold text-xs">Out of Stock</span> : '-'}{p.issued_at && <span className="absolute inset-0 flex items-center justify-center"><span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white bg-blue-600/80 rounded rotate-[-8deg] shadow-sm">Issued</span></span>}</span></td><td className="py-2 text-gray-700 text-xs">{p.created_by || '-'}</td><td className="py-2 text-gray-500 text-xs">{p.created_at ? new Date(p.created_at).toLocaleString() : '-'}</td><td className="py-2 text-xs">{p.issued_at ? <span className="text-green-600">{new Date(p.issued_at).toLocaleString()}</span> : <span className="text-gray-400">—</span>}</td><td className="py-2"><button onClick={() => { if (editLocked) { onEditBlocked?.(); return; } setEditPart(p); setEditForm({ part_name: p.part_name || '', part_number: p.part_number || '', condition: p.condition || '', failure_id: p.failure_id || '' }); setEditError(null); }} className="text-xs text-blue-600 hover:underline">Edit</button></td></tr>)}</tbody>
        </table>
      )}
      {editPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditPart(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Edit Defective Part</h3>
            {editError && <div className="text-xs text-red-600 mb-2">{editError}</div>}
            <div className="space-y-3">
              <div className="relative"><label className="block text-xs text-gray-500 mb-1">Part</label><input value={editForm.part_name} onChange={e => { setEditForm(f => ({ ...f, part_name: e.target.value })); setEditPartOpen(true); }} onFocus={() => setEditPartOpen(true)} onBlur={() => setTimeout(() => setEditPartOpen(false), 150)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" autoComplete="off" />{editPartOpen && editForm.part_name.length >= 1 && (() => { const matches = catalog.filter(c => c.name.toLowerCase().includes(editForm.part_name.toLowerCase())).slice(0, 8); if (!matches.length) return null; return <ul className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto rounded shadow-lg text-sm bg-white border border-slate-200">{matches.map(c => <li key={c.id} className="px-2 py-1.5 cursor-pointer hover:bg-blue-50" onMouseDown={() => { setEditForm(f => ({ ...f, part_name: c.name })); setEditPartOpen(false); }}>{c.name}</li>)}</ul>; })()}</div>
              <div><label className="block text-xs text-gray-500 mb-1">Part Number</label><input value={editForm.part_number} onChange={e => setEditForm(f => ({ ...f, part_number: e.target.value.toUpperCase() }))} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Condition</label><select value={editForm.condition} onChange={e => setEditForm(f => ({ ...f, condition: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"><option value="">Select...</option><option value="Damaged">Damaged</option><option value="Defective">Defective</option><option value="Missing">Missing</option></select></div>
              {needsFailureId(editForm.condition) && <div><label className="block text-xs text-gray-500 mb-1">Failure ID <span className="text-red-600">*</span></label><input value={editForm.failure_id.startsWith('No FID:') ? '' : editForm.failure_id} onChange={e => setEditForm(f => ({ ...f, failure_id: e.target.value.toUpperCase() }))} placeholder="Enter Failure ID" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" /><div className="text-xs text-center text-gray-400 my-1">— or —</div><select value={editForm.failure_id.startsWith('No FID:') ? editForm.failure_id : ''} onChange={e => setEditForm(f => ({ ...f, failure_id: e.target.value }))} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"><option value="">— No Selection —</option><option value="No FID: No Power">No Power</option><option value="No FID: Boot Loop">Boot Loop</option><option value="No FID: I/O Inaccessible">I/O Inaccessible</option><option value="No FID: Diagnostics Passed/Symptoms Observed">Diagnostics Passed/Symptoms Observed</option><option value="No FID: Intermittent">Intermittent</option><option value="No FID: Testing Not Available For Part">Testing Not Available For Part</option></select></div>}
            </div>
            <div className="flex justify-between mt-4">
              <button disabled={editSaving} onClick={async () => {
                if (!confirm('Delete this part from records?')) return;
                setEditSaving(true); setEditError(null);
                try {
                  const res = await fetch(`/api/cases/${caseId}/defective-parts`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editPart.id }) });
                  if (!res.ok) { const d = await res.json().catch(() => ({})); setEditError(d.error || 'Failed'); return; }
                  setEditPart(null); await fetchParts(true);
                } catch { setEditError('Network error'); }
                finally { setEditSaving(false); }
              }} className="px-4 py-1.5 text-sm font-semibold rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-40">Delete</button>
              <div className="flex gap-2">
              <button onClick={() => setEditPart(null)} className="px-4 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
              <button disabled={editSaving || !editForm.part_name.trim()} onClick={async () => {
                setEditSaving(true); setEditError(null);
                try {
                  const res = await fetch(`/api/cases/${caseId}/defective-parts`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editPart.id, part_name: editForm.part_name, part_number: editForm.part_number, condition: editForm.condition, failure_id: editForm.failure_id }) });
                  if (!res.ok) { const d = await res.json().catch(() => ({})); setEditError(d.error || 'Failed'); return; }
                  setEditPart(null); await fetchParts(true);
                } catch { setEditError('Network error'); }
                finally { setEditSaving(false); }
              }} className="px-4 py-1.5 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">{editSaving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DiagnosticOutcomePanels({ caseId, caseStage, program, notes, editLocked, isManager, onRequestAccess, owningTeamLabel, onAssetLocationSaved, onDepotSaved, onPartsChanged, warrantyEnd }) {
  // Collect all unique outcomes from all diagnostic notes
  const diagnosticNotes = notes.filter((n) => n.note_type === 'Diagnostic' || n.note_type === 'Additional Part Request');
  const outcomes = new Set();
  diagnosticNotes.forEach((n) => { const m = n.body?.match(/^\[(.*?)\]/); if (m) outcomes.add(m[1]); });

  const hasRepairSuccess = notes.some(n => n.note_type === 'Repair' && n.body?.startsWith('[Repair Successful]'));
  const repairedUnlocked = hasRepairSuccess || outcomes.has('Reseat Fix') || outcomes.has('No Issue Found');

  const [managingLocation, setManagingLocation] = useState(false);
  const locationManageBtn = isManager ? <button onClick={() => setManagingLocation(m => !m)} className={`px-2 py-0.5 text-xs rounded ${managingLocation ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>{managingLocation ? 'Done' : 'Manage'}</button> : null;

  return (
    <>
      {outcomes.has('Part(s) Required') && <Panel title="Defective / Damaged Part(s)"><DefectivePartsPanel caseId={caseId} program={program} onPartsChanged={onPartsChanged} editLocked={editLocked} onEditBlocked={onRequestAccess} warrantyEnd={warrantyEnd} /></Panel>}
      <OrderDetailsPanel caseId={caseId} notes={notes} />
      {outcomes.has('Reseat Fix') && <Panel title="Reseated Part(s)"><ReseatedPartsPanel caseId={caseId} /></Panel>}
      {outcomes.has('Sending to Depot') && <Panel title="Depot Repair"><DepotRepairPanel caseId={caseId} onSaved={onDepotSaved} /></Panel>}
      {outcomes.has('Part(s) Required') && <Panel title="Asset Location" headerAction={locationManageBtn}><AssetLocationPanel caseId={caseId} lockRepaired={!repairedUnlocked} onSaved={onAssetLocationSaved} showNoRepairReturn={caseStage === 'Cancelled'} editLocked={editLocked} onEditBlocked={onRequestAccess} managing={managingLocation} onClearLocation={() => { setManagingLocation(false); onAssetLocationSaved({ awaiting_part: { rack: '', shelf: '', crate: '' }, repaired: { rack: '', shelf: '', crate: '' }, no_repair_return: { rack: '', shelf: '', crate: '' } }); }} /></Panel>}
      {outcomes.has('Reseat Fix') && <Panel title="Asset Location" headerAction={locationManageBtn}><AssetLocationPanel caseId={caseId} noIssue onSaved={onAssetLocationSaved} showNoRepairReturn={caseStage === 'Cancelled'} editLocked={editLocked} onEditBlocked={onRequestAccess} managing={managingLocation} onClearLocation={() => { setManagingLocation(false); onAssetLocationSaved({ awaiting_part: { rack: '', shelf: '', crate: '' }, repaired: { rack: '', shelf: '', crate: '' }, no_repair_return: { rack: '', shelf: '', crate: '' } }); }} /></Panel>}
      {outcomes.has('No Issue Found') && <Panel title="Asset Location" headerAction={locationManageBtn}><AssetLocationPanel caseId={caseId} noIssue onSaved={onAssetLocationSaved} showNoRepairReturn={caseStage === 'Cancelled'} editLocked={editLocked} onEditBlocked={onRequestAccess} managing={managingLocation} onClearLocation={() => { setManagingLocation(false); onAssetLocationSaved({ awaiting_part: { rack: '', shelf: '', crate: '' }, repaired: { rack: '', shelf: '', crate: '' }, no_repair_return: { rack: '', shelf: '', crate: '' } }); }} /></Panel>}
      {caseStage === 'Cancelled' && !outcomes.has('Part(s) Required') && !outcomes.has('Reseat Fix') && !outcomes.has('No Issue Found') && <Panel title="Asset Location" headerAction={locationManageBtn}><AssetLocationPanel caseId={caseId} onSaved={onAssetLocationSaved} showNoRepairReturn editLocked={editLocked} onEditBlocked={onRequestAccess} managing={managingLocation} onClearLocation={() => { setManagingLocation(false); onAssetLocationSaved({ awaiting_part: { rack: '', shelf: '', crate: '' }, repaired: { rack: '', shelf: '', crate: '' }, no_repair_return: { rack: '', shelf: '', crate: '' } }); }} /></Panel>}
    </>
  );
}

function AssetLocationPanel({ caseId, noIssue, onSaved, lockRepaired, showNoRepairReturn, editLocked, onEditBlocked, managing, onClearLocation }) {
  const [awaitingPart, setAwaitingPart] = useState({ rack: '', shelf: '', crate: '' });
  const [repaired, setRepaired] = useState({ rack: '', shelf: '', crate: '' });
  const [noRepairReturn, setNoRepairReturn] = useState({ rack: '', shelf: '', crate: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [clearing, setClearing] = useState(false);
  const apRef = useRef(awaitingPart);
  const rpRef = useRef(repaired);
  const nrrRef = useRef(noRepairReturn);
  apRef.current = awaitingPart;
  rpRef.current = repaired;
  nrrRef.current = noRepairReturn;

  useEffect(() => {
    fetch(`/api/cases/${caseId}/notes`).then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.data) return;
      const loc = d.data.find(n => n.note_type === 'AssetLocation');
      if (loc?.body) { try { const parsed = JSON.parse(loc.body); if (parsed.awaiting_part) { setAwaitingPart(parsed.awaiting_part); apRef.current = parsed.awaiting_part; } if (parsed.repaired) { setRepaired(parsed.repaired); rpRef.current = parsed.repaired; } if (parsed.no_repair_return) { setNoRepairReturn(parsed.no_repair_return); nrrRef.current = parsed.no_repair_return; } } catch {} }
    });
  }, [caseId]);

  async function save() {
    if (editLocked) { onEditBlocked?.(); return; }
    const ap = apRef.current, rp = rpRef.current, nrr = nrrRef.current;
    const apValid = (ap.rack.trim() && ap.shelf.trim()) || ap.crate.trim();
    const rpValid = (rp.rack.trim() && rp.shelf.trim()) || rp.crate.trim();
    const nrrValid = (nrr.rack.trim() && nrr.shelf.trim()) || nrr.crate.trim();
    if (!apValid && !rpValid && !nrrValid) return;
    setError(null); setSuccess(null);
    try {
      const payload = { awaiting_part: ap, repaired: rp, no_repair_return: nrr };
      const res = await fetch(`/api/cases/${caseId}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note_type: 'AssetLocation', text: JSON.stringify(payload), replace: true }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed'); return; }
      setSuccess('Saved'); setTimeout(() => setSuccess(null), 2000);
      if (onSaved) onSaved(payload);
    } catch { setError('Network error'); }
  }

  const nrrFilled = (noRepairReturn.rack.trim() && noRepairReturn.shelf.trim()) || noRepairReturn.crate.trim();

  async function handleClear(field) {
    setClearing(true);
    const empty = { rack: '', shelf: '', crate: '' };
    const payload = {
      awaiting_part: field === 'awaiting_part' ? empty : apRef.current,
      repaired: field === 'repaired' ? empty : rpRef.current,
      no_repair_return: field === 'no_repair_return' ? empty : nrrRef.current,
    };
    try {
      await fetch(`/api/cases/${caseId}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note_type: 'AssetLocation', text: JSON.stringify(payload), replace: true }) });
    } catch {}
    if (field === 'awaiting_part') { setAwaitingPart(empty); apRef.current = empty; }
    if (field === 'repaired') { setRepaired(empty); rpRef.current = empty; }
    if (field === 'no_repair_return') { setNoRepairReturn(empty); nrrRef.current = empty; }
    setClearing(false);
    if (onSaved) onSaved(payload);
  }

  return (
    <div>
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      {success && <div className="text-xs text-green-600 mb-2">{success}</div>}
      <div className={`mb-3 flex items-center gap-3 ${noIssue || nrrFilled ? 'opacity-40' : ''}`}>
        <span className="text-sm font-semibold text-gray-700 w-28 shrink-0">Awaiting Part</span>
        <input placeholder="Scan..." disabled={noIssue || nrrFilled} className="w-28 px-2 py-1.5 border border-dashed border-blue-300 rounded text-sm bg-blue-50 disabled:bg-slate-100 disabled:border-slate-200" onInput={(e) => { const v = e.target.value; const m = v.match(/rack[:\s]*(\S+)[,\s]+shelf[:\s]*(\S+)/i); if (m) { setAwaitingPart(p => ({ ...p, rack: m[1], shelf: m[2], crate: '' })); e.target.value = ''; setTimeout(save, 0); } else if (/^[A-Za-z]\d{3,}$/.test(v.trim())) { setAwaitingPart(p => ({ ...p, crate: v.trim().toUpperCase(), rack: '', shelf: '' })); e.target.value = ''; setTimeout(save, 0); } }} />
        <label className="text-xs text-gray-500">Rack</label>
        <input value={awaitingPart.rack} onChange={(e) => setAwaitingPart(p => ({ ...p, rack: e.target.value, crate: '' }))} onBlur={save} disabled={noIssue || nrrFilled || !!awaitingPart.crate} className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm text-center disabled:bg-slate-100" maxLength={5} />
        <label className="text-xs text-gray-500">Shelf</label>
        <input value={awaitingPart.shelf} onChange={(e) => setAwaitingPart(p => ({ ...p, shelf: e.target.value, crate: '' }))} onBlur={save} disabled={noIssue || nrrFilled || !!awaitingPart.crate} className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm text-center disabled:bg-slate-100" maxLength={5} />
        <span className="text-xs text-gray-400">or</span>
        <label className="text-xs text-gray-500">Crate</label>
        <input value={awaitingPart.crate} onChange={(e) => setAwaitingPart(p => ({ ...p, crate: e.target.value, rack: '', shelf: '' }))} onBlur={save} disabled={noIssue || nrrFilled || !!(awaitingPart.rack || awaitingPart.shelf)} className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm text-center disabled:bg-slate-100" maxLength={5} />
        {managing && <button onClick={() => handleClear('awaiting_part')} disabled={clearing} className="px-2 py-0.5 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 ml-auto shrink-0">Clear</button>}
      </div>
      <div className={`mb-3 flex items-center gap-3 ${lockRepaired ? 'opacity-40' : ''}`}>
        <span className="text-sm font-semibold text-gray-700 w-28 shrink-0">Repaired</span>
        <input placeholder="Scan..." disabled={lockRepaired} className="w-28 px-2 py-1.5 border border-dashed border-blue-300 rounded text-sm bg-blue-50 disabled:bg-slate-100 disabled:border-slate-200" onInput={(e) => { const v = e.target.value; const m = v.match(/rack[:\s]*(\S+)[,\s]+shelf[:\s]*(\S+)/i); if (m) { setRepaired(p => ({ ...p, rack: m[1], shelf: m[2], crate: '' })); e.target.value = ''; setTimeout(save, 0); } else if (/^[A-Za-z]\d{3,}$/.test(v.trim())) { setRepaired(p => ({ ...p, crate: v.trim().toUpperCase(), rack: '', shelf: '' })); e.target.value = ''; setTimeout(save, 0); } }} />
        <label className="text-xs text-gray-500">Rack</label>
        <input value={repaired.rack} onChange={(e) => setRepaired(p => ({ ...p, rack: e.target.value, crate: '' }))} onBlur={save} disabled={lockRepaired || !!repaired.crate} className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm text-center disabled:bg-slate-100" maxLength={5} />
        <label className="text-xs text-gray-500">Shelf</label>
        <input value={repaired.shelf} onChange={(e) => setRepaired(p => ({ ...p, shelf: e.target.value, crate: '' }))} onBlur={save} disabled={lockRepaired || !!repaired.crate} className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm text-center disabled:bg-slate-100" maxLength={5} />
        <span className="text-xs text-gray-400">or</span>
        <label className="text-xs text-gray-500">Crate</label>
        <input value={repaired.crate} onChange={(e) => setRepaired(p => ({ ...p, crate: e.target.value, rack: '', shelf: '' }))} onBlur={save} disabled={lockRepaired || !!(repaired.rack || repaired.shelf)} className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm text-center disabled:bg-slate-100" maxLength={5} />
        {managing && <button onClick={() => handleClear('repaired')} disabled={clearing} className="px-2 py-0.5 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 ml-auto shrink-0">Clear</button>}
      </div>
      {showNoRepairReturn && <div className="mb-3 flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-700 w-28 shrink-0">No Repair Return</span>
        <input placeholder="Scan..." className="w-28 px-2 py-1.5 border border-dashed border-blue-300 rounded text-sm bg-blue-50 disabled:bg-slate-100 disabled:border-slate-200" onInput={(e) => { const v = e.target.value; const m = v.match(/rack[:\s]*(\S+)[,\s]+shelf[:\s]*(\S+)/i); if (m) { setNoRepairReturn(p => ({ ...p, rack: m[1], shelf: m[2], crate: '' })); e.target.value = ''; setTimeout(save, 0); } else if (/^[A-Za-z]\d{3,}$/.test(v.trim())) { setNoRepairReturn(p => ({ ...p, crate: v.trim().toUpperCase(), rack: '', shelf: '' })); e.target.value = ''; setTimeout(save, 0); } }} />
        <label className="text-xs text-gray-500">Rack</label>
        <input value={noRepairReturn.rack} onChange={(e) => setNoRepairReturn(p => ({ ...p, rack: e.target.value, crate: '' }))} onBlur={save} disabled={!!noRepairReturn.crate} className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm text-center disabled:bg-slate-100" maxLength={5} />
        <label className="text-xs text-gray-500">Shelf</label>
        <input value={noRepairReturn.shelf} onChange={(e) => setNoRepairReturn(p => ({ ...p, shelf: e.target.value, crate: '' }))} onBlur={save} disabled={!!noRepairReturn.crate} className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm text-center disabled:bg-slate-100" maxLength={5} />
        <span className="text-xs text-gray-400">or</span>
        <label className="text-xs text-gray-500">Crate</label>
        <input value={noRepairReturn.crate} onChange={(e) => setNoRepairReturn(p => ({ ...p, crate: e.target.value, rack: '', shelf: '' }))} onBlur={save} disabled={!!(noRepairReturn.rack || noRepairReturn.shelf)} className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm text-center disabled:bg-slate-100" maxLength={5} />
        {managing && <button onClick={() => handleClear('no_repair_return')} disabled={clearing} className="px-2 py-0.5 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 ml-auto shrink-0">Clear</button>}
      </div>}
    </div>
  );
}

function ReseatedPartsPanel({ caseId }) {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [partName, setPartName] = useState('');
  const [partOpen, setPartOpen] = useState(false);
  const [partNumber, setPartNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function fetchParts() { const res = await fetch(`/api/cases/${caseId}/reseated-parts`); if (res.ok) { const d = await res.json(); setParts(d.data || []); } setLoading(false); }
  useEffect(() => { fetchParts(); }, [caseId]);
  useEffect(() => { fetch('/api/reference/defective-parts').then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setCatalog(d.data); }).catch(() => {}); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    if (!catalog.some(c => c.name === partName)) { setError('Part must be selected from the catalog'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/reseated-parts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ part_name: partName, part_number: partNumber }) });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return; }
      setPartName(''); setPartNumber('');
      await fetchParts(true);
    } catch { setError('Network error'); }
    finally { setSubmitting(false); }
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="mb-4 pb-4 border-b border-slate-200">
        {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div className="relative">
            <label className="block text-xs text-gray-500 mb-1">Part *</label>
            <input value={partName} onChange={(e) => { setPartName(e.target.value); setPartOpen(true); }} onFocus={() => setPartOpen(true)} onBlur={() => setTimeout(() => { setPartOpen(false); if (partName && !catalog.some(c => c.name === partName)) setPartName(''); }, 150)} placeholder="Search part..." className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" autoComplete="off" required />
            {partOpen && partName.length >= 1 && (() => { const matches = catalog.filter((c) => c.name.toLowerCase().includes(partName.toLowerCase())).slice(0, 8); if (!matches.length) return null; return (<ul className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto rounded shadow-lg text-sm bg-white border border-slate-200">{matches.map((c) => <li key={c.id} className="px-2 py-1.5 cursor-pointer hover:bg-blue-50" onMouseDown={() => { setPartName(c.name); setPartOpen(false); }}>{c.name}</li>)}</ul>); })()}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Part Number</label>
            <input value={partNumber} onChange={(e) => setPartNumber(e.target.value.toUpperCase())} placeholder="Part #" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
          </div>
          <button type="submit" disabled={submitting || !partName.trim()} className="px-3 py-1.5 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">Add</button>
        </div>
      </form>
      {loading && <div className="text-xs text-gray-500">Loading...</div>}
      {!loading && parts.length === 0 && <div className="text-center py-3 text-gray-500 text-sm">No reseated parts logged</div>}
      {!loading && parts.length > 0 && (
        <table className="w-full text-sm border-collapse">
          <thead><tr><th className="text-left text-xs font-semibold text-gray-500 pb-2">Part</th><th className="text-left text-xs font-semibold text-gray-500 pb-2">Part Number</th><th className="text-left text-xs font-semibold text-gray-500 pb-2">Added By</th><th className="text-left text-xs font-semibold text-gray-500 pb-2">Added</th></tr></thead>
          <tbody>{parts.map((p) => <tr key={p.id} className="border-t border-slate-100"><td className="py-2 text-gray-700">{p.part_name || '-'}</td><td className="py-2 text-gray-700">{p.part_number || '-'}</td><td className="py-2 text-gray-700 text-xs">{p.created_by || '-'}</td><td className="py-2 text-gray-500 text-xs">{p.created_at ? new Date(p.created_at).toLocaleString() : '-'}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

function DepotRepairPanel({ caseId, onSaved }) {
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({ manufacturer_case_number: '', engagement_date: '', outbound_carrier: '', outbound_tracking: '', outcome: '', inbound_carrier: '', inbound_tracking: '' });
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    Promise.all([
      fetch(`/api/cases/${caseId}/depot-repair`).then(r => r.ok ? r.json() : null),
      fetch('/api/admin/carriers').then(r => r.ok ? r.json() : null),
    ]).then(([depotRes, carrierRes]) => {
      if (depotRes?.data) { const d = { manufacturer_case_number: depotRes.data.manufacturer_case_number || '', engagement_date: depotRes.data.engagement_date || '', outbound_carrier: depotRes.data.outbound_carrier || '', outbound_tracking: depotRes.data.outbound_tracking || '', outcome: depotRes.data.outcome || '', inbound_carrier: depotRes.data.inbound_carrier || '', inbound_tracking: depotRes.data.inbound_tracking || '' }; setForm(d); formRef.current = d; }
      if (carrierRes?.data) setCarriers(carrierRes.data);
    }).finally(() => setLoading(false));
  }, [caseId]);

  async function save(updated) {
    setError(null); setSuccess(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/depot-repair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated || formRef.current) });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return; }
      setSuccess('Saved'); setTimeout(() => setSuccess(null), 2000);
      if (onSaved) onSaved(formRef.current);
    } catch { setError('Network error'); }
  }

  function updateAndSave(field, value) { const updated = { ...formRef.current, [field]: value }; setForm(updated); formRef.current = updated; save(updated); }

  if (loading) return <div className="text-xs text-gray-500">Loading...</div>;

  return (
    <div className="space-y-3">
      {error && <div className="text-xs text-red-600">{error}</div>}
      {success && <div className="text-xs text-green-600">{success}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Manufacturer Case Number</label>
          <input value={form.manufacturer_case_number} onChange={(e) => setForm(p => ({ ...p, manufacturer_case_number: e.target.value }))} onBlur={() => save()} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Engagement Date</label>
          <input type="date" value={form.engagement_date} onChange={(e) => updateAndSave('engagement_date', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Outbound Carrier</label>
          <select value={form.outbound_carrier} onChange={(e) => updateAndSave('outbound_carrier', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
            <option value="">Select carrier...</option>
            {carriers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Outbound Tracking</label>
          <input value={form.outbound_tracking} onChange={(e) => setForm(p => ({ ...p, outbound_tracking: e.target.value }))} onBlur={() => save()} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Outcome</label>
          <input value={form.outcome} onChange={(e) => setForm(p => ({ ...p, outcome: e.target.value }))} onBlur={() => save()} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Inbound Carrier</label>
          <select value={form.inbound_carrier} onChange={(e) => updateAndSave('inbound_carrier', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
            <option value="">Select carrier...</option>
            {carriers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Inbound Tracking</label>
          <input value={form.inbound_tracking} onChange={(e) => setForm(p => ({ ...p, inbound_tracking: e.target.value }))} onBlur={() => save()} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
        </div>
      </div>
    </div>
  );
}

function LogisticsPanel({ caseId, stage }) {
  const [form, setForm] = useState({ scheduled_pickup_date: '', pickup_resource: '', actual_pickup_date: '', picked_up_by: '', scheduled_delivery_date: '', delivery_resource: '', actual_delivery_date: '', intake_crate: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [failures, setFailures] = useState([]);
  const [userTeams, setUserTeams] = useState([]);

  useEffect(() => {
    fetch(`/api/cases/${caseId}/logistics`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.data) setForm({ scheduled_pickup_date: d.data.scheduled_pickup_date || '', pickup_resource: d.data.pickup_resource || '', actual_pickup_date: d.data.actual_pickup_date || '', picked_up_by: d.data.picked_up_by || '', scheduled_delivery_date: d.data.scheduled_delivery_date || '', delivery_resource: d.data.delivery_resource || '', actual_delivery_date: d.data.actual_delivery_date || '', intake_crate: d.data.intake_crate || '' });
      if (d?.failures) setFailures(d.failures);
    }).finally(() => setLoading(false));
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (d?.user?.teams) setUserTeams(d.user.teams); });
  }, [caseId]);

  const isRouteCoord = userTeams.includes('route_coordinators');
  const pickupLocked = !!form.actual_pickup_date;
  const deliveryLocked = !!form.actual_delivery_date;
  const deliveryStages = ['Ready for Delivery', 'Delivery Scheduled', 'Closed'];
  const deliveryEditable = deliveryStages.includes(stage) && isRouteCoord && !deliveryLocked;
  const pickupDetailColumns = form.intake_crate && form.picked_up_by ? 'md:grid-cols-5' : ((form.intake_crate || form.picked_up_by) ? 'md:grid-cols-4' : 'md:grid-cols-3');

  async function saveField(field, value) {
    const updated = { ...form, [field]: value };
    setForm(updated);
    setError(null); setSuccess(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/logistics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return; }
      setSuccess('Saved');
      setTimeout(() => setSuccess(null), 2000);
    } catch { setError('Network error'); }
  }

  if (loading) return <div className="text-xs text-gray-500">Loading...</div>;

  return (
    <div className="space-y-3">
      {error && <div className="text-xs text-red-600">{error}</div>}
      {success && <div className="text-xs text-green-600">{success}</div>}
      <div className={`grid grid-cols-1 ${pickupDetailColumns} gap-3`}>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Scheduled Pickup Date</label>
          <input type="date" value={form.scheduled_pickup_date} onChange={(e) => saveField('scheduled_pickup_date', e.target.value)} disabled={pickupLocked || !isRouteCoord} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm disabled:bg-slate-100 disabled:text-gray-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Pickup Resource</label>
          <input type="text" value={form.pickup_resource} onChange={(e) => setForm(prev => ({ ...prev, pickup_resource: e.target.value }))} onBlur={(e) => saveField('pickup_resource', e.target.value)} disabled={pickupLocked || !isRouteCoord} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm disabled:bg-slate-100 disabled:text-gray-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Actual Pickup Date</label>
          <input type="date" value={form.actual_pickup_date} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm bg-slate-50" readOnly />
        </div>
        {form.picked_up_by && <div>
          <label className="block text-xs text-gray-500 mb-1">Picked Up By</label>
          <input type="text" value={form.picked_up_by} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm bg-slate-50" readOnly />
        </div>}
        {form.intake_crate && <div>
          <label className="block text-xs text-gray-500 mb-1">Intake Crate</label>
          <input type="text" value={form.intake_crate} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm bg-slate-50" readOnly />
        </div>}
      </div>
      {failures.filter(f => f.failure_type === 'pickup').length > 0 && (
        <div className="mt-1 ml-1 mb-3">
          <span className="text-xs font-semibold text-red-600">Pickup Failures:</span>
          {failures.filter(f => f.failure_type === 'pickup').map((f, i) => (
            <div key={i} className="text-xs text-red-700 ml-2">• {f.failed_at} — {f.reason}</div>
          ))}
        </div>
      )}
      {pickupLocked && <p className="text-xs text-gray-400 mt-2">Pickup fields locked — actual pickup date recorded.</p>}
      {!isRouteCoord && !pickupLocked && <p className="text-xs text-gray-400 mt-2">Pickup scheduling restricted to route coordinators.</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Scheduled Delivery Date</label>
          <input type="date" value={form.scheduled_delivery_date} onChange={(e) => saveField('scheduled_delivery_date', e.target.value)} disabled={!deliveryEditable} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm disabled:bg-slate-100 disabled:text-gray-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Delivery Resource</label>
          <input type="text" value={form.delivery_resource} onChange={(e) => setForm(prev => ({ ...prev, delivery_resource: e.target.value }))} onBlur={(e) => saveField('delivery_resource', e.target.value)} disabled={!deliveryEditable} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm disabled:bg-slate-100 disabled:text-gray-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Actual Delivery Date</label>
          <input type="date" value={form.actual_delivery_date} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm bg-slate-50" readOnly />
        </div>
      </div>
      {failures.filter(f => f.failure_type === 'delivery').length > 0 && (
        <div className="mt-1 ml-1">
          <span className="text-xs font-semibold text-red-600">Delivery Failures:</span>
          {failures.filter(f => f.failure_type === 'delivery').map((f, i) => (
            <div key={i} className="text-xs text-red-700 ml-2">• {f.failed_at} — {f.reason}</div>
          ))}
        </div>
      )}
      {deliveryLocked && <p className="text-xs text-gray-400">Delivery fields locked — actual delivery date recorded.</p>}
      {!deliveryLocked && !deliveryStages.includes(stage) && <p className="text-xs text-gray-400">Delivery scheduling available at Ready for Delivery stage.</p>}
      {!deliveryLocked && deliveryStages.includes(stage) && !isRouteCoord && <p className="text-xs text-gray-400">Delivery scheduling restricted to route coordinators.</p>}
    </div>
  );
}

function OrderDetailsPanel({ caseId, notes }) {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serviceFee, setServiceFee] = useState(null);

  const hasRepairSuccess = (notes || []).some(n => n.note_type === 'Repair' && n.body?.startsWith('[Repair Successful]'));

  useEffect(() => {
    fetch(`/api/cases/${caseId}/order-details`).then(r => r.ok ? r.json() : null).then(d => { if (d?.data) setDetails(d.data); }).catch(() => {}).finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => {
    if (!hasRepairSuccess) return;
    fetch(`/api/cases/${caseId}`).then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.data?.program) return;
      fetch('/api/admin/programs').then(r => r.ok ? r.json() : null).then(p => {
        const prog = (p?.data || []).find(x => x.name === d.data.program);
        if (prog?.service_fee) setServiceFee(prog.service_fee);
      });
    });
  }, [caseId, hasRepairSuccess]);

  if (loading || (details.length === 0 && !hasRepairSuccess)) return null;

  const bulkParts = details.filter(d => d.detail_type === 'bulk_part' && d.part_name);
  const bulkOrders = details.filter(d => d.detail_type === 'bulk_order');

  return (
    <Panel title="Order Details">
      {bulkOrders.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-bold text-gray-800 mb-2">Bulk Order</h4>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-gray-500 pb-2">Bulk Order #</th>
              </tr>
            </thead>
            <tbody>
              {bulkOrders.map(d => (
                <tr key={d.id}>
                  <td className="px-3 py-2 border-b font-mono text-xs" style={{ borderColor: 'var(--color-border)' }}>{d.bulk_order_number || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(bulkParts.length > 0 || (hasRepairSuccess && serviceFee)) && (
        <div>
          {bulkParts.length > 0 && <h4 className="text-sm font-bold text-gray-800 mb-2">Bulk Parts</h4>}
          <table className="text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Part</th>
                <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Part Number</th>
                <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Bulk Order #</th>
                <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Quote</th>
                <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">PO</th>
                <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Vendor</th>
                <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Vendor Order #</th>
                <th className="text-left text-xs font-semibold text-gray-500 pb-2">Unit Price</th>
              </tr>
            </thead>
            <tbody>
              {bulkParts.map(d => (
                <tr key={d.id}>
                  <td className="py-2 pr-4 border-b" style={{ borderColor: 'var(--color-border)' }}>{d.part_name || '-'}</td>
                  <td className="py-2 pr-4 border-b" style={{ borderColor: 'var(--color-border)' }}>{d.part_number || '-'}</td>
                  <td className="py-2 pr-4 border-b font-mono text-xs" style={{ borderColor: 'var(--color-border)' }}>{d.bulk_order_number || '-'}</td>
                  <td className="py-2 pr-4 border-b" style={{ borderColor: 'var(--color-border)' }}>N/A</td>
                  <td className="py-2 pr-4 border-b" style={{ borderColor: 'var(--color-border)' }}>{d.po || '-'}</td>
                  <td className="py-2 pr-4 border-b" style={{ borderColor: 'var(--color-border)' }}>{d.vendor || '-'}</td>
                  <td className="py-2 pr-4 border-b" style={{ borderColor: 'var(--color-border)' }}>{d.vendor_order_number || '-'}</td>
                  <td className="py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>{d.unit_price ? parseFloat(d.unit_price).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : ''}</td>
                </tr>
              ))}
              {hasRepairSuccess && serviceFee && (
                <>
                <tr><td colSpan="8" className="pt-4 pb-2"><h4 className="text-sm font-bold text-gray-800">Service Fee</h4></td></tr>
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Part</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Part Number</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Bulk Order #</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Quote</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">PO</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Vendor</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2 pr-4">Vendor Order #</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2">Unit Price</th>
                </tr>
                <tr>
                  <td className="py-2 pr-4 border-b" style={{ borderColor: 'var(--color-border)' }}>Pickup, Diagnosis, Repair & Delivery</td>
                  <td className="py-2 pr-4 border-b" style={{ borderColor: 'var(--color-border)' }}>Service Fee</td>
                  <td className="py-2 pr-4 border-b" style={{ borderColor: 'var(--color-border)' }}>N/A</td>
                  <td className="py-2 pr-4 border-b" style={{ borderColor: 'var(--color-border)' }}>{(details.find(d => d.entry_type === 'service_fee' || d.detail_type === 'service_fee'))?.quote_number || '-'}</td>
                  <td className="py-2 pr-4 border-b" style={{ borderColor: 'var(--color-border)' }}>{(details.find(d => d.entry_type === 'service_fee' || d.detail_type === 'service_fee'))?.po || '-'}</td>
                  <td className="py-2 pr-4 border-b" style={{ borderColor: 'var(--color-border)' }}>Netsync</td>
                  <td className="py-2 pr-4 border-b" style={{ borderColor: 'var(--color-border)' }}>N/A</td>
                  <td className="py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>{serviceFee ? parseFloat(serviceFee).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}</td>
                </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function AuditLogContent({ caseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch(`/api/cases/${caseId}/audit`).then(r => r.ok ? r.json() : null).then(d => setData(d)).finally(() => setLoading(false)); }, [caseId]);
  if (loading) return <div className="text-sm text-gray-500">Loading...</div>;
  if (!data) return <div className="text-sm text-red-600">Failed to load audit data.</div>;
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-800 mb-2">Change History</h3>
      {data.notes.length === 0 ? <p className="text-sm text-gray-500">No change history recorded.</p> : (
          <table className="w-full text-sm border-collapse">
            <thead><tr><th className="text-left px-3 py-1.5 font-semibold text-gray-500 border-b border-slate-200">Date</th><th className="text-left px-3 py-1.5 font-semibold text-gray-500 border-b border-slate-200">By</th><th className="text-left px-3 py-1.5 font-semibold text-gray-500 border-b border-slate-200">Type</th><th className="text-left px-3 py-1.5 font-semibold text-gray-500 border-b border-slate-200">Original Value</th><th className="text-left px-3 py-1.5 font-semibold text-gray-500 border-b border-slate-200">Updated Value</th><th className="text-left px-3 py-1.5 font-semibold text-gray-500 border-b border-slate-200">Details</th></tr></thead>
            <tbody>{data.notes.map((n, i) => {
              const m = n.details?.match(/changed from "(.+?)" to "(.+?)"/);
              return <tr key={i} className="border-b border-slate-100"><td className="px-3 py-1.5 text-xs text-gray-500 whitespace-nowrap">{n.date ? new Date(n.date).toLocaleString() : '-'}</td><td className="px-3 py-1.5 text-xs text-gray-600 whitespace-nowrap">{n.by || '-'}</td><td className="px-3 py-1.5 text-xs font-semibold text-gray-600 whitespace-nowrap">{n.type}</td><td className="px-3 py-1.5 text-sm text-gray-700">{m ? m[1] : '-'}</td><td className="px-3 py-1.5 text-sm text-gray-700">{m ? m[2] : '-'}</td><td className="px-3 py-1.5 text-sm text-gray-700 whitespace-pre-wrap">{n.details}</td></tr>;
            })}</tbody>
          </table>
        )}
    </div>
  );
}
