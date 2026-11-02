-- Add bad_values column to field_specs (MD/field-specifications-system-instructions.md §2a)
-- For Y/N and select fields: list the values that are "bad" (out of spec).
-- Use bad_values OR allowed_values, not both.
ALTER TABLE field_specs ADD COLUMN IF NOT EXISTS bad_values TEXT;
