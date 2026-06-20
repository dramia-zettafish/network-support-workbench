-- Add failure_id column to cm_case_defective_parts
-- Required by the defective-parts API GET query
ALTER TABLE cm_case_defective_parts ADD COLUMN IF NOT EXISTS failure_id text;
