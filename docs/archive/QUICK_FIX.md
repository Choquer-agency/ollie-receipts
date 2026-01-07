# Quick Fix Guide - Upload Error

## What Happened

You got a **500 Internal Server Error** when uploading files. This is because the production database is missing the `original_filename` column that was added for duplicate detection.

## Quick Fix (Choose ONE option)

### ✅ Option 1: Manual SQL via Neon Dashboard (EASIEST - 2 minutes)

1. **Go to Neon Dashboard**: https://console.neon.tech
2. **Find your database** and open the **SQL Editor**
3. **Copy and paste this SQL**:

```sql
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS original_filename TEXT;
CREATE INDEX IF NOT EXISTS idx_receipts_filename ON receipts(user_id, original_filename);
```

4. **Click "Run"**
5. **Done!** Try uploading again.

---

### Option 2: Railway CLI Method (5 minutes)

```bash
# 1. Install Railway CLI (if needed)
npm install -g @railway/cli

# 2. Login
railway login

# 3. Navigate to server folder
cd "/Users/brycechoquer/Desktop/Ollie Receipts/server"

# 4. Run migration via Railway
railway run ./migrate.sh

# 5. Done! Try uploading again.
```

---

## How to Verify It Worked

1. Go to: https://ollie-receipts-production.up.railway.app/
2. Sign in
3. Upload a receipt
4. Should work now! ✅

## Why This Happened

The duplicate detection feature requires the `original_filename` column in the database. The main schema has it, but this migration needed to be run on your production database.

## Deploy the Code Improvements

After fixing the database, deploy the updated code with better error messages:

```bash
cd "/Users/brycechoquer/Desktop/Ollie Receipts"

# Commit the changes
git add .
git commit -m "Improve error handling for database migrations"

# Push to trigger Railway deployment
git push origin main
```

This will give you helpful error messages in the future if similar issues occur.

---

## Still Having Issues?

Check the Railway logs:
1. Go to your Railway dashboard
2. Click on your project
3. Click on the server service
4. Click "View Logs"
5. Look for the error message with "column" or "original_filename"

The error should now include a hint: "Database migration may be required. Run server/migrate.sh"


