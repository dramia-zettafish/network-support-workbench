-- ============================================================================
-- EUS Support — Production Schema Upgrade Migration
-- Purpose: Bring production schema forward to support the Next.js app
-- Safety: All operations are idempotent (IF NOT EXISTS / IF NOT EXISTS patterns)
-- WARNING: Do NOT drop or truncate any existing tables or columns
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: New columns on existing tables
-- ============================================================================

-- cm_cases: add 'program' column (used by refresh workflow)
ALTER TABLE cm_cases ADD COLUMN IF NOT EXISTS program text;

-- cm_workflows: add 'assignment_team_id' column
ALTER TABLE cm_workflows ADD COLUMN IF NOT EXISTS assignment_team_id integer;

-- cm_rma_manufacturers: add 'workflow_key' column
ALTER TABLE cm_rma_manufacturers ADD COLUMN IF NOT EXISTS workflow_key text;

-- inventory: add 'inventory_pool' column with default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory' AND column_name = 'inventory_pool'
  ) THEN
    ALTER TABLE inventory ADD COLUMN inventory_pool text NOT NULL DEFAULT 'Operations';
  END IF;
END $$;

-- inventory_add_requests: add 'description', 'qty_on_hand', 'location' columns
ALTER TABLE inventory_add_requests ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE inventory_add_requests ADD COLUMN IF NOT EXISTS qty_on_hand integer DEFAULT 0;
ALTER TABLE inventory_add_requests ADD COLUMN IF NOT EXISTS location text DEFAULT '';

-- users: add 'timezone' column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE users ADD COLUMN timezone varchar NOT NULL DEFAULT 'America/Chicago';
  END IF;
END $$;

-- ============================================================================
-- PART 2: New tables required by the Next.js app
-- ============================================================================

-- cm_programs (reference/lookup table for program tracking)
CREATE TABLE IF NOT EXISTS cm_programs (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  standard_service_fee text,
  service_fee text
);

-- cm_bulk_orders
CREATE TABLE IF NOT EXISTS cm_bulk_orders (
  id uuid PRIMARY KEY,
  part_name text,
  part_number text,
  cost text,
  quote text,
  sales_order text,
  vendor_order_number text,
  status text DEFAULT 'submitted',
  submitted_by_user_id integer,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  vendor text,
  quantity text,
  unit_price text,
  program text,
  qty_received integer DEFAULT 0,
  bulk_order_number text
);

-- cm_case_defective_parts
CREATE TABLE IF NOT EXISTS cm_case_defective_parts (
  id text PRIMARY KEY,
  case_id text NOT NULL,
  part_number text,
  description text,
  quantity integer NOT NULL DEFAULT 1,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  part_name text,
  condition text,
  created_by_user_id integer,
  issued_at timestamp without time zone
);
CREATE INDEX IF NOT EXISTS idx_cm_case_defective_parts_case ON cm_case_defective_parts(case_id);

-- cm_case_depot_repair
CREATE TABLE IF NOT EXISTS cm_case_depot_repair (
  id text PRIMARY KEY,
  case_id text NOT NULL,
  manufacturer_case_number text,
  engagement_date text,
  outbound_carrier text,
  outbound_tracking text,
  outcome text,
  inbound_carrier text,
  inbound_tracking text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cm_case_depot_repair_case ON cm_case_depot_repair(case_id);

-- cm_case_logistics
CREATE TABLE IF NOT EXISTS cm_case_logistics (
  case_id text PRIMARY KEY,
  scheduled_pickup_date text,
  pickup_resource text,
  scheduled_delivery_date text,
  delivery_resource text,
  updated_at text,
  actual_pickup_date text,
  intake_crate text,
  picked_up_by text,
  actual_delivery_date text
);
ALTER TABLE cm_case_logistics ADD COLUMN IF NOT EXISTS intake_crate text;
ALTER TABLE cm_case_logistics ADD COLUMN IF NOT EXISTS picked_up_by text;

-- cm_case_logistics_failures
CREATE TABLE IF NOT EXISTS cm_case_logistics_failures (
  id text PRIMARY KEY,
  case_id text NOT NULL,
  failure_type text NOT NULL,
  reason text NOT NULL,
  failed_at text NOT NULL DEFAULT CURRENT_DATE,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cm_case_logistics_failures_case ON cm_case_logistics_failures(case_id);

-- cm_case_order_details
CREATE TABLE IF NOT EXISTS cm_case_order_details (
  id text PRIMARY KEY,
  case_id text NOT NULL,
  quote_number text,
  part_name text,
  part_number text,
  created_at timestamp with time zone DEFAULT now(),
  po text,
  vendor text,
  vendor_order_number text,
  bulk_order_number text,
  unit_price text,
  entry_type text,
  service_fee text,
  detail_type text DEFAULT 'bulk_part',
  unit_cost text
);

-- cm_case_reseated_parts
CREATE TABLE IF NOT EXISTS cm_case_reseated_parts (
  id text PRIMARY KEY,
  case_id text NOT NULL,
  part_name text,
  part_number text,
  created_by_user_id integer,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cm_case_reseated_parts_case ON cm_case_reseated_parts(case_id);

-- cm_case_workflow_refresh
CREATE TABLE IF NOT EXISTS cm_case_workflow_refresh (
  case_id text PRIMARY KEY,
  manufacturer text,
  device_type text,
  serial_number text,
  asset_tag text,
  model text,
  issue_description text,
  damage_excuse text,
  model_name text,
  warranty_end text,
  adp text
);

-- cm_custom_logistics_teams
CREATE TABLE IF NOT EXISTS cm_custom_logistics_teams (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_by_user_id integer,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamp without time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cm_custom_logistics_teams_expires ON cm_custom_logistics_teams(expires_at);

-- cm_custom_logistics_team_members
CREATE TABLE IF NOT EXISTS cm_custom_logistics_team_members (
  team_id text NOT NULL,
  user_upn text NOT NULL,
  display_name text,
  PRIMARY KEY (team_id, user_upn)
);

-- cm_defective_parts_catalog
CREATE TABLE IF NOT EXISTS cm_defective_parts_catalog (
  id bigserial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_enabled integer NOT NULL DEFAULT 1,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text
);

-- employee_assets
CREATE TABLE IF NOT EXISTS employee_assets (
  id serial PRIMARY KEY,
  serial_number varchar NOT NULL,
  asset_type varchar,
  manufacturer varchar,
  model_number varchar,
  description text,
  location varchar,
  asset_status varchar DEFAULT 'Available',
  assigned_to varchar,
  assignment_date date,
  notes text,
  created_at timestamp without time zone DEFAULT now()
);

-- inventory_stock_sources
CREATE TABLE IF NOT EXISTS inventory_stock_sources (
  id serial PRIMARY KEY,
  part_no text NOT NULL,
  inventory_pool text,
  bulk_order_id uuid,
  bulk_order_number text,
  cost text,
  sales_order text,
  vendor text,
  vendor_order_number text,
  qty_remaining integer NOT NULL DEFAULT 0,
  received_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stock_sources_part_pool ON inventory_stock_sources(part_no, inventory_pool);

-- alto_inventory
CREATE TABLE IF NOT EXISTS alto_inventory (
  id serial PRIMARY KEY,
  mac_address varchar NOT NULL,
  location varchar NOT NULL,
  date_added timestamp without time zone,
  date_issued timestamp without time zone,
  customer_issued_to varchar,
  case_issued_on varchar
);

-- system_active_user_sessions (for system monitoring)
CREATE TABLE IF NOT EXISTS system_active_user_sessions (
  client_key text PRIMARY KEY,
  user_key text NOT NULL,
  username text NOT NULL,
  role text,
  state text NOT NULL DEFAULT 'active',
  last_seen timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_system_active_user_sessions_last_seen ON system_active_user_sessions(last_seen);
CREATE INDEX IF NOT EXISTS idx_system_active_user_sessions_user_key ON system_active_user_sessions(user_key);

-- system_metric_samples (for system monitoring)
CREATE TABLE IF NOT EXISTS system_metric_samples (
  id bigserial PRIMARY KEY,
  sampled_at timestamp with time zone NOT NULL,
  system_cpu_percent double precision NOT NULL,
  container_cpu_percent double precision NOT NULL,
  container_cpu_share_percent double precision NOT NULL,
  system_memory_percent double precision NOT NULL,
  container_memory_percent double precision NOT NULL,
  container_memory_share_percent double precision NOT NULL,
  storage_used_percent double precision NOT NULL,
  storage_free_bytes bigint NOT NULL,
  storage_used_bytes bigint NOT NULL,
  storage_total_bytes bigint NOT NULL,
  source_system text NOT NULL,
  source_container text NOT NULL,
  raw jsonb NOT NULL,
  active_user_count integer NOT NULL DEFAULT 0,
  background_user_count integer NOT NULL DEFAULT 0,
  total_user_count integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_system_metric_samples_sampled_at ON system_metric_samples(sampled_at);

COMMIT;
