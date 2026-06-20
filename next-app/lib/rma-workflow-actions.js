/**
 * RMA Workflow Actions — prerequisite definitions and checking logic.
 * Used by POST /api/cases/[id]/rma/actions to validate manual workflow actions.
 */

export const SUPPORTED_ACTIONS = [
  'manufacturer_engaged',
  'manufacturer_case_opened',
  'rma_approved_eta_established',
  'inbound_tracking_available',
  'rma_denied',
  'rma_completed',
];

const ACTION_LABELS = {
  manufacturer_engaged: 'Manufacturer Engaged',
  manufacturer_case_opened: 'Manufacturer Case Opened',
  rma_approved_eta_established: 'RMA Approved / ETA Established',
  inbound_tracking_available: 'Inbound Tracking Available',
  rma_denied: 'RMA Denied',
  rma_completed: 'RMA Completed',
};

const RECOMMENDED_NOTIFICATIONS = {
  manufacturer_engaged: 'manufacturer_engaged',
  manufacturer_case_opened: 'manufacturer_case_opened',
  rma_approved_eta_established: 'rma_approved_eta',
  inbound_tracking_available: 'inbound_tracking_available',
  rma_denied: 'rma_denied',
};

/**
 * Check prerequisites for a given action against current RMA data.
 * Returns { met: boolean, missing: string[] }
 */
export function checkPrerequisites(action, rma) {
  const missing = [];

  switch (action) {
    case 'manufacturer_engaged':
      if (!rma?.manufacturer) missing.push('manufacturer');
      break;

    case 'manufacturer_case_opened':
      if (!rma?.manufacturer) missing.push('manufacturer');
      if (!rma?.vendor_sr_number) missing.push('vendor_sr_number');
      break;

    case 'rma_approved_eta_established':
      if (!rma?.rma_number) missing.push('rma_number');
      if (!rma?.replacement_ship_promised_at) missing.push('replacement_ship_promised_at');
      if (!rma?.product_id) missing.push('product_id');
      break;

    case 'inbound_tracking_available':
      if (!rma?.inbound_tracking) missing.push('inbound_tracking');
      break;

    case 'rma_denied':
      // Accept if entitlement_status indicates denial OR rma_status indicates denial
      if (!isDenialIndicated(rma)) {
        missing.push('entitlement_status or rma_status must indicate denial');
      }
      break;

    case 'rma_completed':
      if (!isCompletionIndicated(rma)) {
        missing.push('rma_status must indicate Completed');
      }
      break;
  }

  return { met: missing.length === 0, missing };
}

function isDenialIndicated(rma) {
  if (!rma) return false;
  const status = (rma.rma_status || '').toLowerCase();
  const entitlement = (rma.entitlement_status || '').toLowerCase();
  return status === 'denied' || entitlement === 'denied';
}

function isCompletionIndicated(rma) {
  if (!rma) return false;
  const status = (rma.rma_status || '').toLowerCase();
  return status === 'completed';
}

/**
 * Build the SystemEvent note body for a successful action.
 */
export function buildNoteBody(action) {
  const label = ACTION_LABELS[action] || action;
  return `Workflow action recorded: ${label}`;
}

/**
 * Get recommended notification type for an action (if any).
 */
export function getRecommendedNotification(action) {
  return RECOMMENDED_NOTIFICATIONS[action] || null;
}

/**
 * Get human-readable label for an action.
 */
export function getActionLabel(action) {
  return ACTION_LABELS[action] || action;
}
