import { NextResponse } from 'next/server';
import { requireWriteEnabled, requireWritePermission, sanitizeWriteError } from '@/lib/write-safety';
import { requireAuth } from '@/lib/auth/require-auth.js';
import { withTransaction } from '@/lib/db-write.js';
import { query } from '@/lib/db.js';
import { sendEmail, getSmtpStatus } from '@/lib/email.js';

const SUPERVISOR_ROLES = ['supervisor', 'manager'];

function normId(s) {
  return (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * GET /api/notifications — list inventory add requests (pending by default)
 * Query params: status (pending|approved|denied|all)
 */
export async function GET(req) {
  const user = await requireAuth(req);
  if (!SUPERVISOR_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get('status') || 'pending').toLowerCase();

  let whereClause = '';
  const params = [];
  if (status && status !== 'all') {
    whereClause = 'WHERE r.status = $1';
    params.push(status);
  }

  const rows = await query(
    `SELECT r.id, r.part_no, r.description, r.qty_on_hand, r.location, r.work_order_no, r.vendor_claim_no,
            r.requested_justification, r.status, r.created_at, r.reviewed_at, r.review_note,
            COALESCE(u.display_name, u.upn, r.requested_by_upn) AS requested_by,
            COALESCE(ru.display_name, ru.upn) AS reviewed_by
     FROM inventory_add_requests r
     LEFT JOIN users u ON u.id = r.requested_by
     LEFT JOIN users ru ON ru.id = r.reviewed_by
     ${whereClause}
     ORDER BY r.created_at DESC`,
    params
  );

  return NextResponse.json({ data: rows });
}

/**
 * POST /api/notifications — create an inventory add request
 * Body: { part_no, work_order_no?, vendor_claim_no?, justification? }
 */
export async function POST(req) {
  const writeCheck = requireWriteEnabled();
  if (writeCheck) return writeCheck;
  const permCheck = await requireWritePermission(req);
  if (permCheck.error) return permCheck.error;
  const { user } = permCheck;

  try {
    const body = await req.json();
    const partNo = normId(body.part_no);
    if (!partNo) {
      return NextResponse.json({ error: 'part_no is required' }, { status: 422 });
    }

    const wo = normId(body.work_order_no) || null;
    const vc = normId(body.vendor_claim_no) || null;
    const justification = (body.justification || '').trim() || null;
    const description = (body.description || '').trim() || null;
    const qtyOnHand = parseInt(body.qty_on_hand || 0, 10);
    const location = (body.location || '').trim() || null;
    const inventoryPool = (body.inventory_pool || '').trim() || 'Operations';

    // Check if already in inventory
    const exists = await query(`SELECT 1 FROM inventory WHERE part_no = $1 LIMIT 1`, [partNo]);
    if (exists.length > 0) {
      return NextResponse.json({ ok: true, already_exists: true, part_no: partNo });
    }

    // Check for existing pending request
    const pending = await query(
      `SELECT id, status, created_at FROM inventory_add_requests WHERE part_no = $1 AND status = 'pending' ORDER BY id DESC LIMIT 1`,
      [partNo]
    );
    if (pending.length > 0) {
      return NextResponse.json({ ok: true, request_id: pending[0].id, status: 'pending', pending: true });
    }

    const result = await withTransaction(async (client) => {
      const res = await client.query(
        `INSERT INTO inventory_add_requests(part_no, work_order_no, vendor_claim_no, requested_justification, description, qty_on_hand, location, inventory_pool, requested_by, requested_by_upn)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, status, created_at`,
        [partNo, wo, vc, justification, description, qtyOnHand, location, inventoryPool, user.id, user.username]
      );
      return res.rows[0];
    });

    // Email supervisors and managers
    try {
      const { configured } = getSmtpStatus();
      if (configured) {
        const recipients = await query(
          `SELECT email FROM users WHERE role IN ('supervisor', 'manager') AND email IS NOT NULL AND email != ''`
        );
        const emails = recipients.map((r) => r.email).filter(Boolean);
        if (emails.length > 0) {
          await sendEmail({
            to: emails,
            cc: [],
            subject: `Add Part Request: ${partNo}`,
            text: `A new part add request has been submitted.\n\nPart No: ${partNo}\nDescription: ${description || '-'}\nQty: ${qtyOnHand}\nLocation: ${location || '-'}\nCase Number: ${wo || '-'}\nVendor Claim No: ${vc || '-'}\nReason: ${justification || '-'}\nRequested By: ${user.username}\n\nPlease review in the Notifications module.`,
          });
        }
      }
    } catch (emailErr) {
      console.error('[notifications] Email send failed:', emailErr.message);
    }

    return NextResponse.json({ ok: true, request_id: result.id, status: result.status, created_at: result.created_at });
  } catch (error) {
    return sanitizeWriteError(error);
  }
}
