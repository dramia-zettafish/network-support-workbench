-- Migration: Create cm_case_reassignment_requests and user_messages tables
-- Required by: next-app/app/api/case-reassignment/ routes
-- Date: 2026-06-15

CREATE TABLE IF NOT EXISTS cm_case_reassignment_requests (
  id SERIAL PRIMARY KEY,
  case_id TEXT NOT NULL,
  case_number TEXT,
  owning_team_id INTEGER,
  original_owning_team_id INTEGER,
  requested_by INTEGER NOT NULL,
  requested_by_name TEXT,
  justification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by INTEGER,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reassignment_case_user ON cm_case_reassignment_requests (case_id, requested_by);
CREATE INDEX IF NOT EXISTS idx_reassignment_status ON cm_case_reassignment_requests (status);
CREATE INDEX IF NOT EXISTS idx_user_messages_user ON user_messages (user_id);
