-- Network Vcode development schema
-- Generated from the current project snapshot.
-- Purpose: recreate the PostgreSQL schema without requiring FastAPI/Alembic.
-- Data preservation is not required; run against a fresh/dev database.

BEGIN;

CREATE SCHEMA IF NOT EXISTS network_workbench;

-- -----------------------------------------------------------------------------
-- Enum types
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'network_workbench' AND t.typname = 'network_device_type'
  ) THEN
    CREATE TYPE network_workbench.network_device_type AS ENUM ('switch', 'access_point', 'ups');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'network_workbench' AND t.typname = 'ticket_status'
  ) THEN
    CREATE TYPE network_workbench.ticket_status AS ENUM ('open', 'on_hold', 'closed');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'network_workbench' AND t.typname = 'ticket_priority'
  ) THEN
    CREATE TYPE network_workbench.ticket_priority AS ENUM ('low', 'medium', 'high');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'network_workbench' AND t.typname = 'ups_install_status'
  ) THEN
    CREATE TYPE network_workbench.ups_install_status AS ENUM ('intake', 'servicing', 'scheduled', 'confirm_ip', 'fulfilled');
  ELSE
    ALTER TYPE network_workbench.ups_install_status ADD VALUE IF NOT EXISTS 'confirm_ip';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'network_workbench' AND t.typname = 'device_response_resolution_type'
  ) THEN
    CREATE TYPE network_workbench.device_response_resolution_type AS ENUM ('permanent', 'temp_rma', 'no_replacement');
  ELSE
    ALTER TYPE network_workbench.device_response_resolution_type ADD VALUE IF NOT EXISTS 'no_replacement';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'network_workbench' AND t.typname = 'device_response_status'
  ) THEN
    CREATE TYPE network_workbench.device_response_status AS ENUM ('open', 'temp_placed', 'closed');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Shared timestamp trigger helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION network_workbench.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Tickets
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS network_workbench.tickets (
  ticket_number SERIAL PRIMARY KEY,
  external_ticket_number VARCHAR(8) NOT NULL,
  device_type network_workbench.network_device_type NOT NULL,
  school_name VARCHAR(255) NOT NULL,
  tea_code INTEGER NOT NULL,
  mdf_idf VARCHAR(100),
  date TEXT NOT NULL,
  note VARCHAR(1000),
  priority network_workbench.ticket_priority,
  status network_workbench.ticket_status NOT NULL DEFAULT 'open',

  CONSTRAINT ck_tickets_tea_code_3_digits CHECK (tea_code >= 0 AND tea_code <= 999),
  CONSTRAINT ck_tickets_external_ticket_number_len CHECK (char_length(external_ticket_number) <= 8)
);

CREATE INDEX IF NOT EXISTS ix_tickets_ticket_number ON network_workbench.tickets (ticket_number);
CREATE INDEX IF NOT EXISTS ix_tickets_external_ticket_number ON network_workbench.tickets (external_ticket_number);
CREATE INDEX IF NOT EXISTS ix_tickets_school_name ON network_workbench.tickets (school_name);
CREATE INDEX IF NOT EXISTS ix_tickets_status ON network_workbench.tickets (status);
CREATE INDEX IF NOT EXISTS ix_tickets_device_type ON network_workbench.tickets (device_type);

-- -----------------------------------------------------------------------------
-- RMA placeholder table
-- Kept for schema parity even though RMA workflow logic is not fully active yet.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS network_workbench.rmas (
  rma_id SERIAL PRIMARY KEY,
  ticket_number INTEGER REFERENCES network_workbench.tickets(ticket_number) ON DELETE SET NULL,
  customer VARCHAR(255) NOT NULL,
  campus VARCHAR(255) NOT NULL,
  dynamics_case_number VARCHAR(32) NOT NULL,
  part_number_model VARCHAR(100) NOT NULL,
  defective_serial_number VARCHAR(100) NOT NULL,
  issue VARCHAR(1000) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_rmas_rma_id ON network_workbench.rmas (rma_id);
CREATE INDEX IF NOT EXISTS ix_rmas_ticket_number ON network_workbench.rmas (ticket_number);
CREATE INDEX IF NOT EXISTS ix_rmas_dynamics_case_number ON network_workbench.rmas (dynamics_case_number);

-- -----------------------------------------------------------------------------
-- Device responses
-- One response record per ticket. Used by switch/AP ticket response flow.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS network_workbench.device_responses (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES network_workbench.tickets(ticket_number) ON DELETE CASCADE,
  resolution_type network_workbench.device_response_resolution_type NOT NULL DEFAULT 'permanent',
  status network_workbench.device_response_status NOT NULL DEFAULT 'open',
  response_note VARCHAR(2000),
  temp_response_note VARCHAR(2000),
  rma_response_note VARCHAR(2000),
  defective_model VARCHAR(100),
  defective_sn VARCHAR(100),
  defective_mac VARCHAR(32),
  defective_asset_tag VARCHAR(100),
  defective_room VARCHAR(50),
  replacement_model VARCHAR(100),
  replacement_sn VARCHAR(100),
  replacement_mac VARCHAR(32),
  replacement_hostname VARCHAR(100),
  replacement_ip VARCHAR(100),
  replacement_asset_tag VARCHAR(100),
  replacement_room VARCHAR(50),
  temp_model VARCHAR(100),
  temp_sn VARCHAR(100),
  temp_mac VARCHAR(32),
  temp_hostname VARCHAR(100),
  temp_ip VARCHAR(100),
  temp_asset_tag VARCHAR(100),
  temp_room VARCHAR(50),
  resolution_locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_device_responses_ticket_id UNIQUE (ticket_id)
);

CREATE INDEX IF NOT EXISTS ix_device_responses_id ON network_workbench.device_responses (id);
CREATE INDEX IF NOT EXISTS ix_device_responses_ticket_id ON network_workbench.device_responses (ticket_id);
CREATE INDEX IF NOT EXISTS ix_device_responses_status ON network_workbench.device_responses (status);
CREATE INDEX IF NOT EXISTS ix_device_responses_resolution_type ON network_workbench.device_responses (resolution_type);

DROP TRIGGER IF EXISTS trg_device_responses_updated_at ON network_workbench.device_responses;
CREATE TRIGGER trg_device_responses_updated_at
BEFORE UPDATE ON network_workbench.device_responses
FOR EACH ROW
EXECUTE FUNCTION network_workbench.set_updated_at();

-- -----------------------------------------------------------------------------
-- UPS installations
-- Auto-created when a ticket is created with device_type = 'ups'.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS network_workbench.ups_installations (
  ups_installation_id SERIAL PRIMARY KEY,
  ticket_number INTEGER REFERENCES network_workbench.tickets(ticket_number) ON DELETE SET NULL,
  external_ticket_number VARCHAR(8),
  school_name VARCHAR(255) NOT NULL,
  tea_code INTEGER,
  created_date TEXT NOT NULL,
  status network_workbench.ups_install_status NOT NULL DEFAULT 'intake',

  serial_number VARCHAR(100),
  defective_battery_pack_serial VARCHAR(100),
  idf VARCHAR(100),
  asset_tag VARCHAR(100),
  new_serial_number VARCHAR(100),
  new_webcard_serial VARCHAR(100),
  new_asset_tag VARCHAR(100),
  mac_address VARCHAR(32),
  new_mac_address VARCHAR(32),
  hostname VARCHAR(100),
  new_battery_pack_asset_tag VARCHAR(100),
  new_battery_pack_serial VARCHAR(100),
  model VARCHAR(100),
  room_number VARCHAR(50),
  installed_date TEXT,
  installed_by VARCHAR(100),
  notes VARCHAR(1000),
  snmp_ip VARCHAR(100),
  previous_snmp_ip VARCHAR(100),
  battery_pack_1_asset_tag VARCHAR(100),
  ups_po VARCHAR(100),
  bp_po VARCHAR(100),
  proposed_install_date TEXT,
  approved_install_date TEXT,
  install_contact VARCHAR(255),
  install_contact_number VARCHAR(20),
  ip_response_email_body TEXT,
  ip_response_email_created_at TIMESTAMPTZ,
  ip_response_email_confirmed_at TIMESTAMPTZ,

  CONSTRAINT ck_ups_installations_tea_code_3_digits CHECK (tea_code >= 0 AND tea_code <= 999),
  CONSTRAINT ck_ups_installations_external_ticket_number_len CHECK (
    external_ticket_number IS NULL OR char_length(external_ticket_number) <= 8
  )
);

CREATE INDEX IF NOT EXISTS ix_ups_installations_ups_installation_id ON network_workbench.ups_installations (ups_installation_id);
CREATE INDEX IF NOT EXISTS ix_ups_installations_ticket_number ON network_workbench.ups_installations (ticket_number);
CREATE INDEX IF NOT EXISTS ix_ups_installations_status ON network_workbench.ups_installations (status);
CREATE INDEX IF NOT EXISTS ix_ups_installations_proposed_install_date ON network_workbench.ups_installations (proposed_install_date);
CREATE INDEX IF NOT EXISTS ix_ups_installations_school_name ON network_workbench.ups_installations (school_name);

COMMIT;
