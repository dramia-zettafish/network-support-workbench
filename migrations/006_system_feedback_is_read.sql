-- Migration 006: Add is_read to system_feedback for mark-as-read functionality
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_feedback'
  ) THEN
    ALTER TABLE system_feedback ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;
  END IF;
END $$;
