-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on clerk_user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);

-- Receipts table
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  
  -- OCR extracted fields
  vendor_name TEXT,
  transaction_date DATE,
  subtotal DECIMAL(10, 2),
  tax DECIMAL(10, 2),
  total DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  suggested_category TEXT,
  
  -- Additional metadata
  description TEXT,
  document_type TEXT,
  
  -- Tax fields
  tax_treatment TEXT,
  tax_rate DECIMAL(5, 4),
  
  -- Publishing fields
  publish_target TEXT,
  is_paid BOOLEAN DEFAULT false,
  payment_account_id TEXT,
  
  -- QuickBooks integration
  qb_account_id TEXT,
  qb_transaction_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

