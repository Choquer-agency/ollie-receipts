# Duplicate Detection Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER UPLOADS FILES                               │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Pre-Upload Check (Filename-based)                              │
│  ─────────────────────────────────────────                              │
│  • Collect all filenames                                                │
│  • Call POST /api/receipts/check-duplicates                             │
│  • Database query: SELECT WHERE original_filename = ?                   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
        ┌───────────────────┐    ┌───────────────────┐
        │   IS DUPLICATE    │    │   NOT DUPLICATE   │
        │   (by filename)   │    │                   │
        └─────────┬─────────┘    └─────────┬─────────┘
                  │                         │
                  │                         ▼
                  │            ┌─────────────────────────────────┐
                  │            │  STEP 2: Upload to R2           │
                  │            │  ────────────────────           │
                  │            │  • Get signed URL               │
                  │            │  • Upload file to R2            │
                  │            │  • Get public URL               │
                  │            └─────────┬───────────────────────┘
                  │                      │
                  │                      ▼
                  │            ┌─────────────────────────────────┐
                  │            │  STEP 3: Create Receipt Record  │
                  │            │  ──────────────────────────────  │
                  │            │  • Store image_url              │
                  │            │  • Store original_filename      │
                  │            │  • Status: UPLOADED             │
                  │            └─────────┬───────────────────────┘
                  │                      │
                  │                      ▼
                  │            ┌─────────────────────────────────┐
                  │            │  STEP 4: OCR Processing         │
                  │            │  ───────────────────            │
                  │            │  • Parse with Gemini API        │
                  │            │  • Extract transaction details  │
                  │            └─────────┬───────────────────────┘
                  │                      │
                  │                      ▼
                  │            ┌─────────────────────────────────┐
                  │            │  STEP 5: Transaction Check      │
                  │            │  ──────────────────────────     │
                  │            │  • Call check-duplicates again  │
                  │            │  • Match on: vendor, date,      │
                  │            │    total, tax, subtotal         │
                  │            └─────────┬───────────────────────┘
                  │                      │
                  │         ┌────────────┴────────────┐
                  │         │                         │
                  │         ▼                         ▼
                  │  ┌──────────────┐      ┌─────────────────────┐
                  │  │ IS DUPLICATE │      │   NOT DUPLICATE     │
                  │  │ (by details) │      │                     │
                  │  └──────┬───────┘      └──────────┬──────────┘
                  │         │                         │
                  │         ▼                         ▼
                  │  ┌──────────────┐      ┌─────────────────────┐
                  │  │ Delete       │      │ Update Receipt      │
                  │  │ Receipt      │      │ • Add OCR data      │
                  │  │              │      │ • Status: COMPLETE  │
                  │  └──────┬───────┘      └──────────┬──────────┘
                  │         │                         │
                  └─────────┼─────────────────────────┘
                            │
                            ▼
                ┌───────────────────────────┐
                │  STEP 6: Update UI Stats  │
                │  ───────────────────────   │
                │  • Increment duplicates    │
                │  • OR increment successful │
                │  • Increment completed     │
                └───────────┬───────────────┘
                            │
                            ▼
                ┌───────────────────────────┐
                │  Display Results to User  │
                │  ────────────────────────  │
                │  ✓ X receipts ready       │
                │  ⚠ X were duplicates      │
                └───────────────────────────┘
```

## Database Queries

### Filename Check
```sql
SELECT id FROM receipts
WHERE user_id = $1
AND original_filename = $2
LIMIT 1
```

### Transaction Details Check
```sql
SELECT id FROM receipts
WHERE user_id = $1
AND vendor_name = $2
AND transaction_date = $3
AND total = $4
AND COALESCE(tax, 0) = $5
AND COALESCE(subtotal, 0) = $6
LIMIT 1
```

## Performance Characteristics

| Check Type | When | Speed | Database Hits |
|------------|------|-------|---------------|
| Filename | Before upload | Fast (~10ms) | 1 per file |
| Transaction | After OCR | Fast (~10ms) | 1 per file |

Both checks use indexed queries for optimal performance.

## Error Handling

- If duplicate check API fails: Continue with upload (fail-safe)
- If OCR fails: Receipt marked as ERROR, counted as successful upload
- If transaction duplicate found: Receipt deleted, no orphaned data

## User Experience Timeline

```
Upload 5 files (2 are duplicates):

[0%  ] Processing 5 documents - Extracting details using AI...
[40% ] Processing 5 documents - Extracting details using AI...
[80% ] Processing 5 documents - Extracting details using AI...
[100%] Upload complete
       ✓ 3 receipts ready for review below
       ⚠ 2 receipts were duplicates
```



