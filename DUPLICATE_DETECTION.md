# Duplicate Detection Feature

## Overview

The receipt upload system now includes comprehensive duplicate detection to prevent users from accidentally uploading the same receipt multiple times.

## How It Works

### Two-Layer Detection System

1. **Filename Check (Fast)**
   - When files are selected for upload, the system immediately checks if any filename has been uploaded before
   - This check happens before any file processing begins
   - If a duplicate filename is found, the file is skipped entirely

2. **Transaction Details Check (Thorough)**
   - After OCR processing extracts receipt details, the system checks if a receipt with identical transaction details already exists
   - Matches on ALL of the following fields:
     - Vendor name
     - Transaction date
     - Total amount
     - Tax amount
     - Subtotal amount
   - If a match is found, the newly created receipt is deleted and marked as a duplicate

### User Experience

When users upload files:
- The system processes all files and tracks statistics
- At completion, users see:
  - **Success count**: "X receipts ready for review below"
  - **Duplicate count**: "X receipts were duplicates" (if any duplicates detected)
- Both messages are clearly displayed with appropriate icons

### Database Schema

The `receipts` table now includes:
```sql
original_filename TEXT  -- Stores the original uploaded filename
```

An index has been added for fast duplicate lookups:
```sql
CREATE INDEX idx_receipts_filename ON receipts(user_id, original_filename);
```

## API Endpoints

### Check Duplicates

**Endpoint**: `POST /api/receipts/check-duplicates`

**Request Body**:
```json
{
  "files": [
    {
      "filename": "receipt-2024-01-15.jpg",
      "transactionDetails": {
        "vendorName": "Starbucks",
        "transactionDate": "2024-01-15",
        "subtotal": 4.50,
        "tax": 0.50,
        "total": 5.00
      }
    }
  ]
}
```

**Response**:
```json
{
  "results": [
    {
      "filename": "receipt-2024-01-15.jpg",
      "isDuplicate": true,
      "reason": "filename",
      "existingReceiptId": "uuid-here"
    }
  ]
}
```

**Duplicate Reasons**:
- `filename`: A receipt with this filename already exists
- `transaction_details`: A receipt with matching transaction details already exists

## Migration

To apply the schema changes to an existing database:

```bash
# Connect to your Neon database
psql $DATABASE_URL -f server/src/db/add_filename_column.sql
```

Or run the full schema:
```bash
psql $DATABASE_URL -f server/src/db/schema.sql
```

## Implementation Details

### Backend (`receiptController.ts`)

- **`checkForDuplicate()`**: Helper function that performs both filename and transaction detail checks
- **`checkDuplicates()`**: API endpoint handler for batch duplicate checking
- **`createReceipt()`**: Updated to accept and store `originalFilename`

### Frontend (`ReceiptUpload.tsx`)

1. **Pre-upload check**: Before processing files, check all filenames against existing receipts
2. **Post-OCR check**: After extracting transaction details, verify no matching transactions exist
3. **Stats tracking**: Maintains counts for total, completed, successful, and duplicate uploads
4. **User feedback**: Displays clear summary of upload results with icons

### API Service (`apiService.ts`)

New method:
```typescript
checkDuplicates: async (files: Array<{
  filename: string;
  transactionDetails?: {...};
}>) => {...}
```

## Testing

To test the duplicate detection:

1. Upload a receipt file (e.g., `test-receipt.jpg`)
2. Try uploading the same file again
3. Verify you see: "1 receipt was a duplicate"

To test transaction detail matching:
1. Upload two different image files of the same receipt
2. After OCR completes, the second one should be detected as a duplicate
3. Verify only one receipt appears in the list

## Future Enhancements

Possible improvements:
- Fuzzy matching for similar (but not identical) transaction details
- Date range tolerance (receipts from same vendor within X hours)
- Visual confirmation dialog before skipping duplicates
- Ability to force upload known duplicates
- Duplicate detection across multiple users (for shared accounts)


