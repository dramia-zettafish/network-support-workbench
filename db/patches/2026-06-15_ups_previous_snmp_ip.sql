ALTER TABLE ups_installations
  ADD COLUMN IF NOT EXISTS previous_snmp_ip VARCHAR(100);
