-- Migration: Add original_filename column to receipts table
-- This migration adds support for duplicate detection by filename

-- Add the original_filename column
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- Create index for faster duplicate checks
CREATE INDEX IF NOT EXISTS idx_receipts_filename ON receipts(user_id, original_filename);

-- The migration is complete
-- Note: Existing receipts will have NULL for original_filename, which is expected


