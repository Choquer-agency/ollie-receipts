# Neon Database Setup Guide

## Step 1: Create Neon Database

1. Go to [https://neon.tech](https://neon.tech) and sign in
2. Create a new project called "ollie-receipts"
3. Copy your connection string from the Neon dashboard

## Step 2: Run Database Migration

The schema file is located at `server/src/db/schema.sql`. You can run it in two ways:

### Option A: Using Neon SQL Editor (Recommended)
1. Go to your Neon project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Copy and paste the contents of `server/src/db/schema.sql`
4. Click "Run" to execute the SQL

### Option B: Using Command Line
```bash
# Install Neon CLI (if not already installed)
npm install -g neonctl

# Authenticate
neonctl auth

# Run the schema
psql "YOUR_DATABASE_URL" -f server/src/db/schema.sql
```

## Step 3: Add Connection String to Environment

Add your Neon database connection string to `server/.env`:

```
DATABASE_URL=postgresql://username:password@ep-xxx-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## Database Schema Overview

The migration creates:
- **users table**: Stores user information linked to Clerk
- **receipts table**: Stores all receipt data including OCR results and QuickBooks metadata
- Indexes for optimized queries
- Automatic timestamp updates via triggers

## Verify Setup

You can verify the tables were created successfully:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

You should see:
- users
- receipts

