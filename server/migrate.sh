#!/bin/bash

# Database Migration Script
# Adds the original_filename column to the receipts table for duplicate detection

echo "========================================"
echo "Duplicate Detection Migration Script"
echo "========================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL environment variable is not set"
  echo ""
  echo "Please set your database connection string:"
  echo "  export DATABASE_URL='your-neon-connection-string'"
  echo ""
  exit 1
fi

echo "🔍 Found DATABASE_URL"
echo ""

# Run the migration
echo "📝 Running migration..."
psql "$DATABASE_URL" -f "$(dirname "$0")/src/db/add_filename_column.sql"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration completed successfully!"
  echo ""
  echo "The receipts table now includes:"
  echo "  - original_filename column"
  echo "  - idx_receipts_filename index"
  echo ""
  echo "Duplicate detection is now active! 🎉"
else
  echo ""
  echo "❌ Migration failed. Please check the error above."
  exit 1
fi



