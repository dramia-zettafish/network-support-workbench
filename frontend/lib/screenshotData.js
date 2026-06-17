function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function getCurrentWorkWeekDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const day = today.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday);

  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return toIsoDate(date);
  });
}

function daysAgo(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return toIsoDate(date);
}

export function getScreenshotOperationsData() {
  const weekDates = getCurrentWorkWeekDates();

  return {
    tickets: [
      {
        ticket_number: 1001001,
        external_ticket_number: '1001001',
        device_type: 'switch',
        school_name: 'Test ES',
        tea_code: 'ID-101',
        status: 'open',
        date: daysAgo(1)
      },
      {
        ticket_number: 1001002,
        external_ticket_number: '1001002',
        device_type: 'access_point',
        school_name: 'Test MS',
        tea_code: 'ID-202',
        status: 'open',
        date: daysAgo(2)
      },
      {
        ticket_number: 1001003,
        external_ticket_number: '1001003',
        device_type: 'ups',
        school_name: 'Test HS',
        tea_code: 'ID-303',
        status: 'on_hold',
        date: daysAgo(4)
      },
      {
        ticket_number: 1001004,
        external_ticket_number: '1001004',
        device_type: 'switch',
        school_name: 'Test Academy',
        tea_code: 'ID-404',
        status: 'open',
        date: daysAgo(0)
      }
    ],
    upsPending: [
      buildUpsInstall({
        id: 501,
        ticket: '1001003',
        school: 'Test HS',
        identifier: 'ID-303',
        idf: 'MDF-A',
        status: 'intake',
        serial: 'TEST-UPS-001',
        bpSerial: 'TEST-BP-001',
        assetTag: 'TEST-ASSET-001',
        mac: '00:11:22:33:44:55',
        hostname: 'test-ups-01',
        ip: '192.0.2.10'
      }),
      buildUpsInstall({
        id: 502,
        ticket: '1001005',
        school: 'Test Stadium',
        identifier: 'ID-101',
        idf: 'IDF-B',
        status: 'intake',
        serial: 'TEST-UPS-001',
        bpSerial: 'TEST-BP-001',
        assetTag: 'TEST-ASSET-002',
        mac: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-ups-02',
        ip: '198.51.100.20'
      })
    ],
    upsScheduled: [
      buildUpsInstall({
        id: 503,
        ticket: '1001001',
        school: 'Test ES',
        identifier: 'ID-101',
        idf: 'IDF-1',
        status: 'scheduled',
        installDate: weekDates[3],
        serial: 'TEST-UPS-001',
        bpSerial: 'TEST-BP-001',
        assetTag: 'TEST-ASSET-001',
        mac: '00:11:22:33:44:55',
        hostname: 'test-ups-01',
        ip: '203.0.113.10',
        upsPo: 'TEST-PO-001',
        bpPo: 'TEST-PO-002'
      })
    ],
    upsServicing: [
      buildUpsInstall({
        id: 504,
        ticket: '1001002',
        school: 'Test MS',
        identifier: 'ID-202',
        idf: 'IDF-2',
        status: 'servicing',
        installDate: weekDates[4],
        serial: 'TEST-UPS-001',
        bpSerial: 'TEST-BP-001',
        assetTag: 'TEST-ASSET-002',
        mac: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-switch-01',
        ip: '192.0.2.25',
        upsPo: 'TEST-PO-003',
        bpPo: 'TEST-PO-004'
      })
    ],
    upsCompleted: [
      buildUpsInstall({
        id: 505,
        ticket: '1001004',
        school: 'Test Academy',
        identifier: 'ID-404',
        idf: 'MDF-C',
        status: 'fulfilled',
        installDate: weekDates[2],
        serial: 'TEST-UPS-001',
        bpSerial: 'TEST-BP-001',
        assetTag: 'TEST-ASSET-001',
        mac: '00:11:22:33:44:55',
        hostname: 'test-ups-02',
        ip: '203.0.113.44',
        newAssetTag: 'TEST-ASSET-002',
        newSerial: 'TEST-UPS-001',
        newWebcardSerial: 'TEST-SNMP-001',
        newMac: 'AA:BB:CC:DD:EE:FF',
        newBpSerial: 'TEST-BP-001',
        newBpAssetTag: 'TEST-ASSET-002',
        upsPo: 'TEST-PO-005',
        bpPo: 'TEST-PO-006'
      })
    ]
  };
}

function buildUpsInstall({
  id,
  ticket,
  school,
  identifier,
  idf,
  status,
  installDate = '',
  serial,
  bpSerial,
  assetTag,
  mac,
  hostname,
  ip,
  newAssetTag = '',
  newSerial = '',
  newWebcardSerial = '',
  newMac = '',
  newBpSerial = '',
  newBpAssetTag = '',
  upsPo = '',
  bpPo = ''
}) {
  return {
    ups_installation_id: id,
    ticket_number: Number(ticket),
    external_ticket_number: ticket,
    school_name: school,
    tea_code: identifier,
    idf,
    status,
    proposed_install_date: installDate,
    serial_number: serial,
    defective_battery_pack_serial: bpSerial,
    asset_tag: assetTag,
    mac_address: mac,
    hostname,
    snmp_ip: ip,
    new_asset_tag: newAssetTag,
    new_serial_number: newSerial,
    new_webcard_serial: newWebcardSerial,
    new_mac_address: newMac,
    new_battery_pack_serial: newBpSerial,
    new_battery_pack_asset_tag: newBpAssetTag,
    ups_po: upsPo,
    bp_po: bpPo
  };
}
