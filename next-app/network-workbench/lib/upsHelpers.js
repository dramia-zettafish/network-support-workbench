export const upsStatusLabelMap = {
  intake: 'Pending',
  servicing: 'Servicing',
  scheduled: 'In Progress',
  confirm_ip: 'Confirm IP',
  fulfilled: 'Fulfilled'
};

export const upsStatusToneMap = {
  intake: 'warning',
  servicing: 'info',
  scheduled: 'success',
  confirm_ip: 'warning',
  fulfilled: 'neutral'
};

export function getUpsTicketLabel(install) {
  return install.external_ticket_number || install.ticket_number;
}

export function deriveUpsEquipment(install) {
  const batteryCount = [
    install.defective_battery_pack_serial,
    install.battery_pack_1_asset_tag,
    install.new_battery_pack_serial,
    install.new_battery_pack_asset_tag
  ].filter(Boolean).length > 0 ? 1 : 0;

  return batteryCount > 0 ? 'UPS, 1 BP' : 'UPS';
}

export function toggleSelection(setter, id) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });
}

export function clearSelection(setter) {
  setter(new Set());
}
