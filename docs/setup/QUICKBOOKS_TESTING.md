# QuickBooks Integration Testing Guide

## Overview
This document outlines the testing procedures for the QuickBooks OAuth integration in Ollie Receipts. All features should be tested in the **sandbox environment** before moving to production.

## Prerequisites for Testing

### 1. Complete Setup
Before testing, ensure you have:
- ✅ Run database migration (`add_quickbooks_connections.sql`)
- ✅ Installed backend dependencies (`npm install` in server folder)
- ✅ Created QuickBooks app in Intuit Developer Portal
- ✅ Set environment variables (see `QUICKBOOKS_SETUP.md`)
- ✅ Backend and frontend servers running

### 2. Intuit Sandbox Account
- Sandbox environment includes test company with sample data
- Access via https://app.sandbox.qbo.intuit.com/
- No risk to real QuickBooks data

## Test Cases

### Test 1: OAuth Connection Flow

**Objective**: Verify users can connect their QuickBooks account

**Steps**:
1. Start development servers
2. Sign in to Ollie Receipts with Clerk
3. Click "Connect QuickBooks" button
4. Verify OAuth popup opens
5. Sign in to Intuit (use sandbox credentials)
6. Select a sandbox company
7. Click "Authorize" to grant permissions
8. Verify popup closes automatically
9. Verify "QBO Connected" badge appears in UI
10. Verify connection status persists on page reload

**Expected Result**:
- OAuth flow completes without errors
- Connection status shows as connected
- Database has entry in `quickbooks_connections` table
- `access_token`, `refresh_token`, and `token_expires_at` are populated

**API Endpoint Tested**: 
- `GET /api/qbo/auth-url`
- `GET /api/qbo/callback`
- `GET /api/qbo/status`

---

### Test 2: Fetch Chart of Accounts

**Objective**: Verify expense accounts are fetched from QuickBooks

**Steps**:
1. Ensure QuickBooks is connected
2. Upload a receipt (or select existing one)
3. Navigate to receipt review page
4. Open "Category" dropdown
5. Verify accounts are loaded from QuickBooks (not mock data)

**Expected Result**:
- Real accounts from QuickBooks sandbox appear
- Accounts show proper format: `AccountID - Account Name`
- Multiple expense account types visible

**API Endpoint Tested**: `GET /api/qbo/accounts`

**Sample Expected Accounts** (sandbox):
- Advertising
- Auto
- Bank Charges
- Insurance
- Meals and Entertainment
- Office Supplies
- Professional Fees
- Travel

---

### Test 3: Fetch Payment Accounts

**Objective**: Verify bank and credit card accounts are fetched

**Steps**:
1. Ensure QuickBooks is connected
2. Go to receipt review page
3. Open "Payment Method" dropdown
4. Verify payment accounts are loaded

**Expected Result**:
- Bank accounts appear (type: Bank)
- Credit card accounts appear (type: Credit Card)
- Real sandbox accounts visible

**API Endpoint Tested**: `GET /api/qbo/payment-accounts`

---

### Test 4: Publish Receipt as Purchase (Paid Expense)

**Objective**: Create Purchase transaction in QuickBooks for paid expense

**Steps**:
1. Ensure QuickBooks is connected
2. Upload or select a receipt with:
   - Vendor name: "Test Vendor"
   - Date: Today's date
   - Total: $50.00
3. In receipt review:
   - Select expense category (e.g., "Office Supplies")
   - Select payment method (e.g., "Mastercard")
   - Check "Is Paid" checkbox
   - Set "Publish to" as "Expense"
4. Click "Publish to QuickBooks"
5. Wait for success message

**Expected Result**:
- Success message appears
- Receipt status changes to "Published"
- `qb_transaction_id` populated in database
- Transaction appears in QuickBooks sandbox:
  - Go to QuickBooks → Expenses
  - Find the transaction
  - Verify vendor, date, amount, category
  - Check private note contains receipt URL

**API Endpoint Tested**: `POST /api/qbo/publish`

**QuickBooks Verification**:
```
Transaction Type: Purchase
Vendor: Test Vendor
Date: [Today's date]
Amount: $50.00
Category: Office Supplies
Payment Account: Mastercard
Status: Paid
```

---

### Test 5: Publish Receipt as Bill (Unpaid Expense)

**Objective**: Create Bill transaction in QuickBooks for unpaid expense

**Steps**:
1. Ensure QuickBooks is connected
2. Upload or select a receipt with:
   - Vendor name: "Unpaid Vendor"
   - Date: Today's date
   - Total: $100.00
3. In receipt review:
   - Select expense category
   - **Uncheck** "Is Paid" checkbox
   - Set "Publish to" as "Bill"
   - Leave payment method empty
4. Click "Publish to QuickBooks"

**Expected Result**:
- Success message appears
- Receipt status changes to "Published"
- Transaction appears in QuickBooks sandbox:
  - Go to QuickBooks → Expenses → Bills
  - Find the bill
  - Verify vendor, date, amount, category
  - Status shows as "Unpaid"

**QuickBooks Verification**:
```
Transaction Type: Bill
Vendor: Unpaid Vendor
Date: [Today's date]
Amount: $100.00
Category: [Selected category]
Status: Unpaid (Open)
Due Date: 30 days from transaction date
```

---

### Test 6: Automatic Token Refresh

**Objective**: Verify access tokens refresh automatically before expiration

**Setup**: This test requires waiting or manually expiring tokens

**Method 1 - Manual Token Expiration (Quick)**:
1. Connect to QuickBooks
2. In database, update `token_expires_at` to a past date:
   ```sql
   UPDATE quickbooks_connections
   SET token_expires_at = NOW() - INTERVAL '1 hour'
   WHERE user_id = [your_user_id];
   ```
3. Try to fetch accounts or publish a receipt
4. Check backend logs for "Token needs refresh, refreshing..."
5. Verify operation succeeds

**Method 2 - Natural Expiration (Slow)**:
1. Connect to QuickBooks
2. Wait 1 hour (access token lifetime)
3. Try to fetch accounts or publish a receipt
4. Verify it still works (token refreshed automatically)

**Expected Result**:
- Token refresh happens automatically
- User doesn't see any errors
- `token_expires_at` and `access_token` updated in database
- `last_refreshed_at` timestamp updated
- QuickBooks API calls continue to work

---

### Test 7: Vendor Auto-Creation

**Objective**: Verify new vendors are created in QuickBooks if they don't exist

**Steps**:
1. Create receipt with vendor name: "Brand New Vendor XYZ"
2. Publish to QuickBooks
3. Go to QuickBooks sandbox → Expenses → Vendors
4. Search for "Brand New Vendor XYZ"

**Expected Result**:
- Vendor is created automatically
- Transaction is linked to new vendor
- Subsequent receipts with same vendor name reuse existing vendor

---

### Test 8: Receipt Image URL in Transaction

**Objective**: Verify receipt image URL is stored in QuickBooks transaction

**Steps**:
1. Publish a receipt to QuickBooks
2. Log into QuickBooks sandbox
3. Open the transaction
4. Check "Private Note" or "Memo" field

**Expected Result**:
- Private note contains receipt description (if provided)
- Private note includes "Receipt Image: [R2 URL]"
- URL is accessible (not broken)

---

### Test 9: Disconnect QuickBooks

**Objective**: Verify users can disconnect QuickBooks connection

**Steps**:
1. Ensure QuickBooks is connected
2. Click "Disconnect" or similar option in UI
3. Verify "QBO Connected" badge disappears
4. Try to fetch accounts (should fail or prompt reconnection)

**Expected Result**:
- Tokens revoked with Intuit
- Database entry deleted from `quickbooks_connections`
- UI shows disconnected state
- User can reconnect without issues

**API Endpoint Tested**: `DELETE /api/qbo/disconnect`

---

### Test 10: Error Handling

**Objective**: Verify graceful error handling for various failure scenarios

**Test Cases**:

**10a. Missing Required Receipt Data**:
1. Try to publish receipt without vendor name
2. Expected: Error message "Missing required receipt data"

**10b. Not Connected to QuickBooks**:
1. Disconnect QuickBooks
2. Try to publish receipt
3. Expected: Error or prompt to connect

**10c. Invalid Account IDs**:
1. Manually set invalid expense account ID in request
2. Try to publish receipt
3. Expected: Error from QuickBooks API with helpful message

**10d. Network Errors**:
1. Disconnect internet
2. Try to connect QuickBooks
3. Expected: Timeout error with user-friendly message

---

## Backend Testing (Optional)

### Test API Endpoints Directly

Use a tool like Postman or curl to test endpoints directly.

**Get Auth URL**:
```bash
curl -X GET "http://localhost:4000/api/qbo/auth-url" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

**Check Status**:
```bash
curl -X GET "http://localhost:4000/api/qbo/status" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

**Publish Receipt**:
```bash
curl -X POST "http://localhost:4000/api/qbo/publish" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "receiptId": "receipt-uuid",
    "expenseAccountId": "35",
    "paymentAccountId": "41"
  }'
```

---

## Database Verification

### Check QuickBooks Connection
```sql
SELECT 
  id, 
  user_id, 
  realm_id, 
  company_name,
  token_expires_at,
  connected_at,
  last_refreshed_at
FROM quickbooks_connections;
```

### Check Published Receipts
```sql
SELECT 
  id,
  vendor_name,
  total,
  qb_transaction_id,
  qb_account_id,
  status
FROM receipts
WHERE qb_transaction_id IS NOT NULL;
```

---

## QuickBooks Sandbox Verification

After each publish operation, verify in QuickBooks:

1. Go to https://app.sandbox.qbo.intuit.com/
2. Navigate to **Expenses** or **Bills**
3. Find the transaction
4. Verify all fields match receipt data
5. Check that transaction shows in reports

---

## Testing Checklist

Before moving to production, ensure all tests pass:

- [ ] OAuth connection flow works
- [ ] Connection status persists on reload
- [ ] Chart of Accounts loads from QuickBooks
- [ ] Payment accounts load from QuickBooks
- [ ] Can publish paid expense as Purchase
- [ ] Can publish unpaid expense as Bill
- [ ] Token refresh works automatically
- [ ] New vendors are auto-created
- [ ] Receipt URL appears in transaction notes
- [ ] Can disconnect QuickBooks
- [ ] Error messages are user-friendly
- [ ] Database entries are correct
- [ ] Transactions appear in QuickBooks sandbox
- [ ] Multiple receipts can be published
- [ ] Connection works after server restart

---

## Production Testing Notes

When moving to production:

1. **Change Environment**:
   - Set `INTUIT_ENVIRONMENT=production`
   - Update redirect URI to production URL
   - Get app approved by Intuit for production access

2. **Test with Real QuickBooks**:
   - Create test account or use your own
   - Verify all flows work the same way
   - Check transactions appear correctly

3. **Monitor Logs**:
   - Watch for token refresh events
   - Monitor API error rates
   - Track successful publish operations

4. **User Feedback**:
   - Gather feedback on OAuth flow
   - Ensure connection persists reliably
   - Verify no unexpected disconnections

---

## Troubleshooting Common Issues

### OAuth Popup Blocked
- Check browser settings
- Allow popups for your domain

### Callback Fails
- Verify redirect URI matches exactly
- Check Clerk middleware allows callback route
- Ensure user is authenticated during callback

### Token Refresh Fails
- Check refresh token hasn't expired (100 days)
- Verify Intuit API is accessible
- User may need to reconnect

### Transactions Don't Appear
- Check QuickBooks company is correct
- Verify API returned transaction ID
- Look for API errors in backend logs

---

## Need Help?

If tests fail:
1. Check backend logs for detailed errors
2. Verify environment variables are correct
3. Ensure database migration ran successfully
4. Test in sandbox before production
5. Review QuickBooks API documentation

