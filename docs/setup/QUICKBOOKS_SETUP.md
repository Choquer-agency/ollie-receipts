# QuickBooks OAuth Integration Setup Guide

## Overview
This guide will help you set up the QuickBooks OAuth integration for Ollie Receipts. The integration allows users to connect their QuickBooks Online account once, and automatically publish receipts as Purchase or Bill transactions.

## Prerequisites
- QuickBooks Online account (Sandbox or Production)
- Intuit Developer account
- Ollie Receipts backend and frontend running

## Step 1: Create QuickBooks App on Intuit Developer Portal

### 1.1 Sign up for Intuit Developer Account
1. Go to https://developer.intuit.com/
2. Click "Sign In" or "Create Account"
3. Sign in with your Intuit account or create a new one

### 1.2 Create a New App
1. Once logged in, go to "My Apps" in the dashboard
2. Click "Create an app" or "Create new app"
3. Select "QuickBooks Online and Payments"
4. Fill in app details:
   - **App Name**: `Ollie Receipts` (or your preferred name)
   - **Description**: AI-powered receipt management with QuickBooks integration

### 1.3 Configure OAuth Settings
1. In your app dashboard, go to "Keys & credentials"
2. Under "Redirect URIs", add:
   - **Development**: `http://localhost:4000/api/qbo/callback`
   - **Production**: `https://your-production-domain.com/api/qbo/callback`
3. Select the following scopes:
   - ✅ `com.intuit.quickbooks.accounting` (QuickBooks Online API)
   - ✅ `openid`
   - ✅ `profile`
   - ✅ `email`
4. Save your changes

### 1.4 Get Your Credentials
1. In "Keys & credentials", you'll find:
   - **Client ID** (starts with `AB...`)
   - **Client Secret** (click "Show" to reveal)
2. Copy these values - you'll need them for environment variables

## Step 2: Configure Environment Variables

### 2.1 Backend Environment Variables
Add the following to `server/.env`:

```env
# QuickBooks OAuth Configuration
INTUIT_CLIENT_ID=your_client_id_here
INTUIT_CLIENT_SECRET=your_client_secret_here
INTUIT_REDIRECT_URI=http://localhost:4000/api/qbo/callback
INTUIT_ENVIRONMENT=sandbox  # Use 'sandbox' for testing, 'production' for live

# Existing variables (keep these)
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_test_...
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET_NAME=ollie-receipts
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
GEMINI_API_KEY=...
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3331
```

### 2.2 Production Environment Variables
For production deployment (Railway, Heroku, etc.), update:

```env
INTUIT_REDIRECT_URI=https://your-production-domain.com/api/qbo/callback
INTUIT_ENVIRONMENT=production
```

## Step 3: Set Up Database

### 3.1 Run QuickBooks Migration
Run the migration to add the `quickbooks_connections` table:

```bash
cd server
# Option 1: Run the migration SQL file directly in Neon SQL Editor
# Copy the contents of server/src/db/add_quickbooks_connections.sql

# Option 2: If you're setting up from scratch, the full schema is in server/src/db/schema.sql
```

The migration creates:
- `quickbooks_connections` table to store OAuth tokens per user
- Indexes for fast lookups
- Automatic token refresh tracking

## Step 4: Install Dependencies

### 4.1 Backend Dependencies
```bash
cd server
npm install
```

This will install the new dependencies:
- `intuit-oauth` - Official Intuit OAuth library
- `node-fetch` - For making QuickBooks API calls

### 4.2 Frontend Dependencies
No new frontend dependencies needed - uses existing `axios` for API calls.

## Step 5: Test in Sandbox Environment

### 5.1 Start Development Servers

Terminal 1 - Backend:
```bash
cd server
npm run dev
```

Terminal 2 - Frontend:
```bash
npm run dev
```

### 5.2 Connect QuickBooks Sandbox
1. Open http://localhost:3331
2. Sign in with Clerk
3. Click "Connect QuickBooks" button
4. In the OAuth popup:
   - Sign in with your Intuit Developer account
   - Select a **Sandbox company** (not a real company)
   - Click "Authorize"
5. You should be redirected back and see "QBO Connected"

### 5.3 Test Publishing a Receipt
1. Upload a receipt (or use an existing one)
2. Review the receipt and ensure it has:
   - Vendor name
   - Transaction date
   - Total amount
   - Expense category selected
   - Payment account selected (for paid expenses)
3. Click "Publish to QuickBooks"
4. The receipt should be published as:
   - **Purchase** (if "Is Paid" is checked and payment account selected)
   - **Bill** (if "Is Paid" is unchecked)

### 5.4 Verify in QuickBooks Sandbox
1. Log into QuickBooks Sandbox at https://app.sandbox.qbo.intuit.com/
2. Go to **Expenses** or **Bills** (depending on what you published)
3. You should see the transaction with:
   - Vendor name
   - Date
   - Amount
   - Category (account)
   - Private note with receipt URL

## Step 6: Production Deployment

### 6.1 Token Refresh Strategy (Keeps Connections Alive 100+ Days!)

Ollie Receipts uses a **Hybrid Token Refresh Strategy** to keep QuickBooks connections alive indefinitely:

**How it works:**
- **User Activity (Primary)**: When users interact with QuickBooks features, tokens automatically refresh if they're 30+ days old (covers 90% of users, FREE)
- **Background Job (Fallback)**: Weekly job refreshes tokens for inactive users after 60 days (covers 10%, minimal cost)

**Result**: Connections stay alive forever, not just 100 days!

**Configuration** (optional):
```env
# Disable background job if you only want activity-based refresh
QB_DISABLE_BACKGROUND_REFRESH=true

# Test job on startup (development only)
QB_REFRESH_JOB_ON_STARTUP=true
```

**Learn more**: See `docs/implementation/QUICKBOOKS_TOKEN_REFRESH_STRATEGY.md` for detailed explanation.

### 6.2 Update Intuit App Settings
1. In Intuit Developer Portal, go to your app
2. Update "Redirect URIs" to include production URL:
   ```
   https://your-production-domain.com/api/qbo/callback
   ```
3. Submit app for production approval (if using real QuickBooks companies)

### 6.3 Update Production Environment Variables
Set these in your deployment platform (Railway, Heroku, etc.):
```env
INTUIT_CLIENT_ID=your_client_id
INTUIT_CLIENT_SECRET=your_client_secret
INTUIT_REDIRECT_URI=https://your-production-domain.com/api/qbo/callback
INTUIT_ENVIRONMENT=production
```

### 6.4 Production Verification Checklist
- [ ] Backend can access QuickBooks API
- [ ] OAuth popup opens correctly
- [ ] Users can connect their QuickBooks account
- [ ] Connection persists (no need to reconnect on each visit)
- [ ] Receipts publish successfully as Purchase/Bill
- [ ] Token refresh works automatically (test after 1 hour)
- [ ] Disconnect works properly

## Troubleshooting

### "Failed to open OAuth popup"
- Check browser popup blocker settings
- Allow popups for your domain

### "Missing authorization code or realm ID"
- Verify `INTUIT_REDIRECT_URI` matches exactly in:
  1. Intuit Developer Portal
  2. Backend `.env` file
  3. Backend URL configuration

### "No valid QuickBooks connection found"
- User needs to connect QuickBooks first
- Check database for `quickbooks_connections` entry for user
- Verify tokens haven't expired (shouldn't happen with auto-refresh)

### "Failed to create purchase/bill"
- Ensure receipt has required fields: vendor, date, total
- Check that expense account ID is valid in QuickBooks
- Verify payment account ID exists (for Purchase)
- Check backend logs for detailed error messages

### Token Refresh Issues
- Access tokens expire after 1 hour (auto-refreshed)
- Refresh tokens expire after 100 days (user must reconnect)
- Check `token_expires_at` in `quickbooks_connections` table

## API Endpoints Reference

### OAuth Endpoints
- `GET /api/qbo/auth-url` - Get OAuth authorization URL
- `GET /api/qbo/callback` - OAuth callback handler
- `GET /api/qbo/status` - Check connection status
- `DELETE /api/qbo/disconnect` - Disconnect QuickBooks

### QuickBooks API Endpoints
- `GET /api/qbo/accounts` - Fetch expense accounts (Chart of Accounts)
- `GET /api/qbo/payment-accounts` - Fetch bank/credit card accounts
- `POST /api/qbo/publish` - Publish receipt to QuickBooks

## Security Best Practices

1. **Never commit credentials** - Always use environment variables
2. **Use HTTPS in production** - Required for OAuth
3. **Store tokens securely** - Tokens are stored in database per user
4. **Implement proper error handling** - Don't expose sensitive errors to users
5. **Monitor token expiration** - Automatic refresh handles this
6. **Limit API scopes** - Only request necessary permissions

## Support Resources

- **Intuit Developer Portal**: https://developer.intuit.com/
- **QuickBooks API Docs**: https://developer.intuit.com/app/developer/qbo/docs/develop
- **OAuth 2.0 Guide**: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization
- **API Explorer**: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account

## Need Help?

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure database migration ran successfully
4. Test in sandbox environment first
5. Review Intuit Developer Portal for API status

