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
  
  -- File metadata for duplicate detection
  original_filename TEXT,
  
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
CREATE INDEX IF NOT EXISTS idx_receipts_filename ON receipts(user_id, original_filename);

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

-- QuickBooks connections table
CREATE TABLE IF NOT EXISTS quickbooks_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  realm_id TEXT NOT NULL, -- QuickBooks company ID
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  refresh_token_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Track refresh token age
  company_name TEXT,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_refreshed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one connection per user
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_qb_connections_user_id ON quickbooks_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_qb_connections_realm_id ON quickbooks_connections(realm_id);

-- Trigger to automatically update last_refreshed_at
CREATE TRIGGER update_qb_connections_refreshed_at
  BEFORE UPDATE ON quickbooks_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- QuickBooks categories cache table
CREATE TABLE IF NOT EXISTS qb_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qb_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'Expense',
  account_sub_type TEXT,
  active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- One entry per QB account per user
  UNIQUE(user_id, qb_account_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_qb_categories_user_id ON qb_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_qb_categories_active ON qb_categories(user_id, active);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_qb_categories_updated_at
  BEFORE UPDATE ON qb_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Category rules table (vendor-to-category automation)
CREATE TABLE IF NOT EXISTS category_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor_pattern TEXT NOT NULL,
  qb_category_id UUID NOT NULL REFERENCES qb_categories(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL DEFAULT 'exact', -- 'exact' or 'contains'
  created_from_receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  times_applied INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Prevent duplicate rules for same vendor+category
  UNIQUE(user_id, vendor_pattern, qb_category_id)
);

CREATE INDEX IF NOT EXISTS idx_category_rules_user_id ON category_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_category_rules_active ON category_rules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_category_rules_vendor ON category_rules(user_id, vendor_pattern);

CREATE TRIGGER update_category_rules_updated_at
  BEFORE UPDATE ON category_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Multi-User Team System (Organizations)
-- ============================================

-- Organizations table (maps Clerk org IDs to internal UUIDs)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_org_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizations_clerk_org_id ON organizations(clerk_org_id);

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Auto-categorization tracking
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS auto_categorized BOOLEAN DEFAULT false;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS auto_categorized_rule_id UUID REFERENCES category_rules(id) ON DELETE SET NULL;

-- Add organization columns to receipts
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS paid_by TEXT;

CREATE INDEX IF NOT EXISTS idx_receipts_org_id ON receipts(organization_id);
CREATE INDEX IF NOT EXISTS idx_receipts_uploaded_by ON receipts(uploaded_by);

-- Add organization column to quickbooks_connections
ALTER TABLE quickbooks_connections ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Unique index: one QBO connection per org (when org is set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_qb_connections_org_id ON quickbooks_connections(organization_id) WHERE organization_id IS NOT NULL;

-- Add refresh_token_expires_at to track refresh token expiry separately from access token
ALTER TABLE quickbooks_connections ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Backfill: existing rows get refresh_token_created_at + 100 days
UPDATE quickbooks_connections
SET refresh_token_expires_at = refresh_token_created_at + INTERVAL '100 days'
WHERE refresh_token_expires_at IS NULL;

