-- Migration: Add refresh_token_created_at field for proactive token refresh
-- Run this if you've already created the quickbooks_connections table

-- Add the new column (defaults to current timestamp for existing rows)
ALTER TABLE quickbooks_connections 
ADD COLUMN IF NOT EXISTS refresh_token_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- For existing connections, set refresh_token_created_at to connected_at
-- (best estimate of when the refresh token was originally issued)
UPDATE quickbooks_connections 
SET refresh_token_created_at = connected_at 
WHERE refresh_token_created_at IS NULL;

-- Make the column NOT NULL after backfilling
ALTER TABLE quickbooks_connections 
ALTER COLUMN refresh_token_created_at SET NOT NULL;

