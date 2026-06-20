-- ============================================================================
-- EUS Support — Production Seed Data (Reference/Lookup tables only)
-- Purpose: Seed reference data required by the Next.js app
-- Safety: All operations use ON CONFLICT DO NOTHING or equivalent
-- WARNING: This does NOT import transactional data from dev.
--          Production cases, inventory, ledger, users, uploads are PRESERVED.
-- ============================================================================
-- Team ID mapping (dev → prod):
--   2340 → 1  parts_administrators
--   2341 → 2  rma_administrators
--   2342 → 3  internal_support_technicians
--   2343 → 4  computer_technicians
--   2344 → 5  intake_administrators
--   2345 → 6  route_coordinators
--   2346 → 7  order_administrators
--   2347 → 8  quote_administrators
--   2348 → 9  network_technicians
--   2349 → 10 logistics_technicians
--   2350 → 11 reporting_administrators
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. cm_workflows — add 'refresh' workflow with correct prod team IDs
-- ============================================================================
INSERT INTO cm_workflows (workflow_key, label, owning_team_id, is_enabled, created_at, assignment_team_id)
VALUES ('refresh', 'Refresh', 4, 1, CURRENT_TIMESTAMP, 6)
ON CONFLICT (workflow_key) DO NOTHING;

-- ============================================================================
-- 2. cm_programs — program reference data
-- ============================================================================
INSERT INTO cm_programs (name, is_active, standard_service_fee, service_fee)
VALUES
  ('Operations', true, NULL, NULL),
  ('Refresh - Spring ISD', true, '41.17', '41.17')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 3. cm_defective_parts_catalog — 51 standard part types
-- ============================================================================
INSERT INTO cm_defective_parts_catalog (name, is_enabled) VALUES
  ('AC Adapter', 1),
  ('Audio Board', 1),
  ('Base Enclosure', 1),
  ('Battery', 1),
  ('Battery Cable', 1),
  ('Bottom Cover', 1),
  ('Bracket Kit', 1),
  ('Cable Kit', 1),
  ('Click Button Board', 1),
  ('DC In', 1),
  ('Display Back Cover', 1),
  ('Display Bezel', 1),
  ('Display Cable', 1),
  ('Display Hinge Kit', 1),
  ('Display Panel', 1),
  ('Fan', 1),
  ('Hard Drive', 1),
  ('Hard Drive Door', 1),
  ('Heatsink', 1),
  ('Hinge Cap', 1),
  ('I/O Cable', 1),
  ('Keyboard', 1),
  ('Microphone Module', 1),
  ('Monitor', 1),
  ('Plastic Kit', 1),
  ('Point Stick Caps', 1),
  ('Power Button Board', 1),
  ('Power Cable', 1),
  ('RAM', 1),
  ('Screw Kit', 1),
  ('Secondary Webcam', 1),
  ('Sensor Board', 1),
  ('Service Door', 1),
  ('Smart Card RDR w/Cable', 1),
  ('Speaker', 1),
  ('SSD', 1),
  ('Surface Kickstand', 1),
  ('Surflink', 1),
  ('System Board', 1),
  ('Thermal Pad', 1),
  ('Top Cover', 1),
  ('Touch Control Board', 1),
  ('Touch Pad', 1),
  ('Touchpad Cable', 1),
  ('Touchscreen Panel', 1),
  ('USB/VGA Board', 1),
  ('USB-C Power I/O Board', 1),
  ('Webcam', 1),
  ('Webcam Transfer Board', 1),
  ('WLAN', 1),
  ('WLAN Cables', 1)
ON CONFLICT (name) DO NOTHING;

COMMIT;
