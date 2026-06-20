// RMA Notification Preview Templates — read-only, no email sending.
// This module generates preview text for customer-facing RMA notifications.

import 'server-only';

const VALID_TYPES = [
  'manufacturer_engaged',
  'manufacturer_case_opened',
  'rma_approved_eta',
  'inbound_tracking_available',
  'rma_denied',
];

export function isValidNotificationType(type) {
  return VALID_TYPES.includes(type);
}

export function getValidTypes() {
  return [...VALID_TYPES];
}

/**
 * Generate notification preview content for a given type.
 * @param {string} type - Notification type
 * @param {object} caseData - Case record fields
 * @param {object|null} rma - RMA record fields
 * @returns {{ to: string[], cc: string[], subject: string, body: string, warnings: string[] }}
 */
export function generateNotification(type, caseData, rma) {
  const warnings = [];
  const to = [];
  const cc = [];

  if (caseData.requester_email) {
    to.push(caseData.requester_email);
  } else {
    warnings.push('Requester email is missing');
  }

  if (caseData.poc_email) {
    cc.push(caseData.poc_email);
  }

  const greeting = buildGreeting(caseData);
  const caseRef = caseData.case_number || 'N/A';

  switch (type) {
    case 'manufacturer_engaged': {
      const mfr = rma && rma.manufacturer ? rma.manufacturer : 'the manufacturer';
      if (!rma || !rma.manufacturer) warnings.push('Manufacturer name is missing from RMA data');
      return {
        to, cc, warnings,
        subject: `Manufacturer Engaged – ${caseRef}`,
        body: [
          greeting,
          `We are writing to let you know that ${mfr} has been engaged regarding your RMA request for case ${caseRef}.`,
          'We will follow up once the manufacturer responds. No action is needed from you at this time.',
          'Thank you,\nEUS Support',
        ].join('\n\n'),
      };
    }

    case 'manufacturer_case_opened':
      return {
        to, cc, warnings,
        subject: `Manufacturer Case Opened – ${caseRef}`,
        body: [
          greeting,
          `A case/service request has been opened with the manufacturer for case ${caseRef}.`,
          'Please note that the manufacturer may review the request, ask for additional validation, or request further troubleshooting before approving the RMA.',
          'We will keep you informed of any changes or actions required.',
          'Thank you,\nEUS Support',
        ].join('\n\n'),
      };

    case 'rma_approved_eta': {
      if (!rma || !rma.rma_number) warnings.push('RMA number is missing');
      const productDesc = rma && rma.product_id ? `${rma.product_id}` : '[product]';
      const serialDesc = rma && rma.serial_number ? ` – ${rma.serial_number}` : '';
      const rmaNum = rma && rma.rma_number ? rma.rma_number : '[pending]';
      const shipDate = rma && rma.replacement_ship_promised_at
        ? new Date(rma.replacement_ship_promised_at).toLocaleDateString()
        : '[TBD]';
      if (!rma || !rma.replacement_ship_promised_at) warnings.push('Replacement ship date is not available');
      const trackingNote = (rma && rma.inbound_tracking)
        ? `Tracking number: ${rma.inbound_tracking}`
        : 'We will provide tracking information once it becomes available.';

      return {
        to, cc, warnings,
        subject: 'RMA Request Approved – ETA Established',
        body: [
          greeting,
          `Your RMA request has been approved. The replacement product for ${productDesc}${serialDesc} is expected to ship on ${shipDate} under RMA number ${rmaNum}.`,
          trackingNote,
          'Thank you,\nEUS Support',
        ].join('\n\n'),
      };
    }

    case 'inbound_tracking_available': {
      if (!rma || !rma.inbound_tracking) warnings.push('Inbound tracking number is missing');
      if (!rma || !rma.inbound_shipping_carrier) warnings.push('Inbound shipping carrier is missing');
      const carrier = rma && rma.inbound_shipping_carrier ? rma.inbound_shipping_carrier : '[carrier not specified]';
      const tracking = rma && rma.inbound_tracking ? rma.inbound_tracking : '[not yet available]';

      return {
        to, cc, warnings,
        subject: `Replacement Tracking Available – ${caseRef}`,
        body: [
          greeting,
          `Tracking information is now available for your replacement shipment on case ${caseRef}.`,
          `Carrier: ${carrier}\nTracking: ${tracking}`,
          'Thank you,\nEUS Support',
        ].join('\n\n'),
      };
    }

    case 'rma_denied': {
      const reason = rma && rma.entitlement_status ? `Entitlement status: ${rma.entitlement_status}` : '';
      const status = rma && rma.rma_status ? `RMA status: ${rma.rma_status}` : '';
      const details = [reason, status].filter(Boolean).join('\n');

      return {
        to, cc, warnings,
        subject: `RMA Request Status – ${caseRef}`,
        body: [
          greeting,
          `We regret to inform you that the RMA request for case ${caseRef} could not be approved at this time.`,
          details || 'No additional details are available regarding the denial.',
          'If you have questions or believe this determination was made in error, please reply to this message and we will review further.',
          'Thank you,\nEUS Support',
        ].join('\n\n'),
      };
    }

    default:
      return null;
  }
}

function buildGreeting(caseData) {
  const names = [];
  if (caseData.requester_name) names.push(caseData.requester_name);
  if (caseData.poc_name && caseData.poc_name !== caseData.requester_name) {
    names.push(caseData.poc_name);
  }
  if (names.length === 0) return 'Hello,';
  return `Hello ${names.join(' and ')},`;
}
