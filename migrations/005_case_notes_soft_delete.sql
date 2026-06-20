-- Migration 005: Soft-delete support for cm_case_notes
-- Adds deleted_at and deleted_by_user_id so deletions persist in audit log
ALTER TABLE cm_case_notes ADD COLUMN IF NOT EXISTS deleted_at text;
ALTER TABLE cm_case_notes ADD COLUMN IF NOT EXISTS deleted_by_user_id integer;
