ALTER TABLE ups_installations
  ADD COLUMN IF NOT EXISTS ip_response_email_body TEXT,
  ADD COLUMN IF NOT EXISTS ip_response_email_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ip_response_email_confirmed_at TIMESTAMPTZ;
