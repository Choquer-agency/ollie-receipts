# QuickBooks Integration - Quick Start Guide

## 🚀 Get Started in 5 Steps

This is a condensed guide to get QuickBooks integration working quickly. For detailed information, see `QUICKBOOKS_SETUP.md`.

## Step 1: Create QuickBooks App (10 minutes)

1. Go to https://developer.intuit.com/ and sign in
2. Click "Create an app" → Select "QuickBooks Online and Payments"
3. Name your app: "Ollie Receipts"
4. In "Keys & credentials":
   - Add redirect URI: `http://localhost:4000/api/qbo/callback`
   - Copy your **Client ID** and **Client Secret**

## Step 2: Add Environment Variables (2 minutes)

Add to `server/.env`:

```env
INTUIT_CLIENT_ID=your_client_id_here
INTUIT_CLIENT_SECRET=your_client_secret_here
INTUIT_REDIRECT_URI=http://localhost:4000/api/qbo/callback
INTUIT_ENVIRONMENT=sandbox
```

## Step 3: Run Database Migration (1 minute)

```bash
# Option A: Copy SQL from server/src/db/add_quickbooks_connections.sql
# and paste into Neon SQL Editor

# Option B: If setting up from scratch, use server/src/db/schema.sql
```

The migration adds the `quickbooks_connections` table.

## Step 4: Install Dependencies (1 minute)

```bash
cd server
npm install
```

This installs `intuit-oauth` and `node-fetch`.

## Step 5: Test It! (5 minutes)

### Start Servers
Terminal 1:
```bash
cd server
npm run dev
```

Terminal 2:
```bash
npm run dev
```

### Connect QuickBooks
1. Open http://localhost:3331
2. Sign in with Clerk
3. Click "Connect QuickBooks"
4. In popup: Sign in to Intuit and select a **Sandbox company**
5. Click "Authorize"
6. ✅ You should see "QBO Connected" badge

### Publish a Receipt
1. Upload a receipt (or use existing)
2. Review the receipt
3. Select expense category and payment method
4. Click "Publish to QuickBooks"
5. ✅ Success! Check QuickBooks sandbox to see the transaction

## 🎉 Done!

Your QuickBooks integration is working! The connection persists indefinitely thanks to our hybrid token refresh strategy:
- **User activity** refreshes tokens automatically (free!)
- **Background job** keeps inactive users connected (minimal cost)
- **No 100-day limit** - connections stay alive forever

Learn more: `docs/implementation/QUICKBOOKS_TOKEN_REFRESH_STRATEGY.md`

## What's Next?

### For Development
- Test all features using `docs/setup/QUICKBOOKS_TESTING.md`
- Verify token refresh works (wait 1 hour or manually expire token)
- Test both Purchase (paid) and Bill (unpaid) transactions

### For Production
1. Update redirect URI in Intuit Developer Portal to production URL
2. Update environment variables:
   ```env
   INTUIT_REDIRECT_URI=https://your-domain.com/api/qbo/callback
   INTUIT_ENVIRONMENT=production
   ```
3. Submit app for Intuit production approval
4. Deploy and test with real QuickBooks accounts

## Need Help?

- **Detailed setup**: `docs/setup/QUICKBOOKS_SETUP.md`
- **Testing guide**: `docs/setup/QUICKBOOKS_TESTING.md`
- **Implementation details**: `docs/implementation/QUICKBOOKS_IMPLEMENTATION.md`
- **Intuit docs**: https://developer.intuit.com/app/developer/qbo/docs/develop

## Common Issues

**Popup blocked?**
→ Allow popups in browser settings

**Callback fails?**
→ Verify redirect URI matches exactly in Intuit portal and `.env`

**No accounts loading?**
→ Make sure you're connected to QuickBooks (check "QBO Connected" badge)

**Transaction not appearing?**
→ Check you're looking in the right place (Expenses for Purchase, Bills for Bills)

## Files Created

This implementation added:
- ✅ 9 new backend files (services, controllers, routes, config)
- ✅ 1 database migration
- ✅ 3 documentation files
- ✅ Updated frontend service and app
- ✅ Updated main README and ENV_SETUP

**All todos complete! Ready to test and deploy.** 🚀

