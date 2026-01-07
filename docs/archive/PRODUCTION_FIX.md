# Production Database Migration Fix

## The Problem

You're getting a 500 error when uploading files because the production database is missing the `original_filename` column that was added for duplicate detection.

## The Solution

You need to run the database migration on your Railway production database.

### Option 1: Run Migration via Railway CLI (Recommended)

1. **Install Railway CLI** (if not already installed):
```bash
npm install -g @railway/cli
```

2. **Login to Railway**:
```bash
railway login
```

3. **Link to your project**:
```bash
cd "/Users/brycechoquer/Desktop/Ollie Receipts"
railway link
```

4. **Get your DATABASE_URL from Railway**:
```bash
railway variables get DATABASE_URL
```

5. **Set the DATABASE_URL locally** (temporarily):
```bash
export DATABASE_URL="your-database-url-from-step-4"
```

6. **Run the migration**:
```bash
cd server
./migrate.sh
```

### Option 2: Run Migration Directly via Railway Shell

1. **Login to Railway CLI**:
```bash
railway login
```

2. **Open Railway shell**:
```bash
cd "/Users/brycechoquer/Desktop/Ollie Receipts/server"
railway shell
```

3. **Run the migration inside the shell**:
```bash
psql $DATABASE_URL -f src/db/add_filename_column.sql
```

### Option 3: Manual SQL via Neon Dashboard

1. Go to your Neon dashboard: https://console.neon.tech
2. Open the SQL Editor for your production database
3. Run this SQL:

```sql
-- Migration: Add original_filename column to receipts table
-- This migration adds support for duplicate detection by filename

-- Add the original_filename column
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- Create index for faster duplicate checks
CREATE INDEX IF NOT EXISTS idx_receipts_filename ON receipts(user_id, original_filename);
```

4. Click "Run" to execute the migration

## Verification

After running the migration, verify it worked:

```bash
# In Railway shell or with DATABASE_URL set:
psql $DATABASE_URL -c "\d receipts"
```

You should see `original_filename` listed in the columns.

## Testing

1. Go to your production app: https://ollie-receipts-production.up.railway.app/
2. Try uploading a receipt
3. It should work without errors now!

## What This Migration Does

- Adds the `original_filename` column to the `receipts` table
- Creates an index on `(user_id, original_filename)` for fast duplicate detection
- Allows the duplicate detection feature to work properly

## Note

After running this migration once, you won't need to run it again unless you reset your database or create a new one.


