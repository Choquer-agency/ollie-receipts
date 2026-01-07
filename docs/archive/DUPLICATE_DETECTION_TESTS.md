# Duplicate Detection Test Plan

## Test Environment Setup

1. Ensure database migration has been applied
2. Have 3-4 sample receipt images ready
3. Clear your existing receipts table (optional, for clean testing)

## Test Cases

### Test 1: Basic Filename Duplicate Detection

**Steps:**
1. Upload `receipt-1.jpg`
2. Wait for OCR to complete
3. Upload `receipt-1.jpg` again (same file, same name)

**Expected Result:**
- First upload: Success
- Second upload: Shows "1 receipt was a duplicate"
- Only 1 receipt appears in the list

**Status:** [ ]

---

### Test 2: Multiple Files with One Duplicate

**Steps:**
1. Upload 3 files: `receipt-a.jpg`, `receipt-b.jpg`, `receipt-c.jpg`
2. After completion, upload 3 files: `receipt-a.jpg`, `receipt-d.jpg`, `receipt-e.jpg`

**Expected Result:**
- First batch: "3 receipts ready for review"
- Second batch: "2 receipts ready for review" + "1 receipt was a duplicate"
- Total of 5 unique receipts in the list

**Status:** [ ]

---

### Test 3: Transaction Details Duplicate (Different Filename)

**Steps:**
1. Upload `receipt-original.jpg` (e.g., Starbucks receipt for $5.00)
2. Wait for OCR to complete
3. Take a screenshot or photo of the same receipt
4. Save it as `receipt-copy.jpg` and upload it

**Expected Result:**
- First upload: Success, OCR extracts details
- Second upload: Initially creates receipt, but after OCR detects duplicate transaction details and removes it
- Shows "1 receipt was a duplicate"
- Only 1 receipt appears in the list

**Status:** [ ]

---

### Test 4: Similar but Different Receipts (Should NOT be Duplicates)

**Steps:**
1. Upload receipt from "Starbucks" for $5.00 on 2024-01-15
2. Upload receipt from "Starbucks" for $5.00 on 2024-01-16 (different date)

**Expected Result:**
- Both uploads succeed
- Shows "2 receipts ready for review"
- Both receipts appear in the list

**Status:** [ ]

---

### Test 5: Batch Upload with Multiple Duplicates

**Steps:**
1. Upload 5 files: `a.jpg`, `b.jpg`, `c.jpg`, `d.jpg`, `e.jpg`
2. After completion, upload 6 files: `a.jpg`, `b.jpg`, `c.jpg`, `f.jpg`, `g.jpg`, `h.jpg`

**Expected Result:**
- First batch: "5 receipts ready for review"
- Second batch: "3 receipts ready for review" + "3 receipts were duplicates"
- Total of 8 unique receipts in the list

**Status:** [ ]

---

### Test 6: Progress Bar Updates Correctly

**Steps:**
1. Upload 10 receipts (mix of new and duplicates)
2. Watch the progress bar during upload

**Expected Result:**
- Progress bar starts at 0%
- Smoothly progresses to 100%
- Shows "Processing X documents" during upload
- Final stats match actual results
- Success and duplicate counts are accurate

**Status:** [ ]

---

### Test 7: Error Handling - OCR Fails

**Steps:**
1. Upload a completely blank/white image
2. Wait for OCR attempt

**Expected Result:**
- Receipt is created with UPLOADED status
- OCR fails gracefully
- Receipt marked as ERROR status
- Still counted in successful uploads (not duplicates)
- No crash or infinite loading

**Status:** [ ]

---

### Test 8: Large Batch Upload Performance

**Steps:**
1. Upload 20+ receipts at once
2. Monitor upload progress

**Expected Result:**
- All files process in chunks of 3 (parallel processing)
- Progress updates smoothly
- No timeout errors
- All files complete (either success or duplicate)
- UI remains responsive

**Status:** [ ]

---

### Test 9: Database Persistence

**Steps:**
1. Upload `test-receipt.jpg`
2. Refresh the page
3. Upload `test-receipt.jpg` again

**Expected Result:**
- After refresh, receipt still appears in list
- Second upload correctly detects as duplicate
- `original_filename` field is persisted in database

**Status:** [ ]

---

### Test 10: User-Specific Duplicates

**Steps:**
1. Login as User A, upload `receipt.jpg`
2. Logout, login as User B
3. Upload `receipt.jpg` (same file)

**Expected Result:**
- User A: Receipt uploads successfully
- User B: Receipt uploads successfully (NOT a duplicate)
- Each user has their own receipt
- Duplicates are user-scoped, not global

**Status:** [ ]

---

## Manual Database Verification

After running tests, check the database:

```sql
-- View receipts with filenames
SELECT id, user_id, original_filename, vendor_name, total, created_at 
FROM receipts 
ORDER BY created_at DESC 
LIMIT 20;

-- Check for any NULL filenames (from before migration)
SELECT COUNT(*) FROM receipts WHERE original_filename IS NULL;

-- Verify index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'receipts' 
AND indexname = 'idx_receipts_filename';
```

## Performance Benchmarks

| Operation | Expected Time | Actual Time | Status |
|-----------|---------------|-------------|--------|
| Filename check (1 file) | < 50ms | | [ ] |
| Filename check (10 files) | < 200ms | | [ ] |
| Transaction check | < 100ms | | [ ] |
| Full upload + OCR | 2-5 sec/file | | [ ] |

## API Endpoint Testing

### Test Check Duplicates Endpoint

```bash
# Test with curl
curl -X POST http://localhost:3000/api/receipts/check-duplicates \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {
        "filename": "test.jpg",
        "transactionDetails": {
          "vendorName": "Starbucks",
          "transactionDate": "2024-01-15",
          "total": 5.00
        }
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "results": [
    {
      "filename": "test.jpg",
      "isDuplicate": false
    }
  ]
}
```

## Browser Console Checks

During testing, monitor browser console for:
- [ ] No JavaScript errors
- [ ] API calls to `/check-duplicates` complete successfully
- [ ] No failed network requests
- [ ] Proper logging of duplicate detections

## Edge Cases

- [ ] Empty file upload (should be caught by file input validation)
- [ ] Very long filename (> 255 characters)
- [ ] Special characters in filename (`receipt #1 @test.jpg`)
- [ ] Filename with spaces
- [ ] Unicode/emoji in filename
- [ ] Case sensitivity (Receipt.jpg vs receipt.jpg vs RECEIPT.JPG)

## Success Criteria

✅ All 10 main test cases pass
✅ No console errors during normal operation
✅ Database has correct schema and indexes
✅ User sees accurate feedback on duplicates
✅ Performance is acceptable (< 5 sec per receipt)
✅ No data loss or orphaned records
✅ Existing receipts still work correctly

## Rollback Plan

If issues arise:

1. **Remove filename column** (optional):
```sql
ALTER TABLE receipts DROP COLUMN IF EXISTS original_filename;
DROP INDEX IF EXISTS idx_receipts_filename;
```

2. **Revert code changes**:
```bash
git revert <commit-hash>
```

3. **Redeploy previous version**



