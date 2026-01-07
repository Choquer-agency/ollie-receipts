# 🚨 URGENT: Production Clerk Setup

## Problem Identified

You're using **Clerk development keys** (`pk_test_...`) in **production**. This causes:
- Strict usage limits
- Unreliable OAuth flows
- Sign-in issues after Google redirect

## Solution: Switch to Production Keys

### Step 1: Get Clerk Production Keys

1. **Go to Clerk Dashboard**: https://dashboard.clerk.com
2. **Select your application**
3. **Look at the top of the page** - you should see a dropdown that says "Development" or similar
4. **Switch to Production** or **Create Production Instance**:
   - If you see "Development" dropdown → switch to "Production"
   - If no production instance exists → click "Create Production Instance"

5. **Get Production Keys**:
   - Go to **API Keys** section
   - Copy the **Publishable Key** (starts with `pk_live_...`)
   - Copy the **Secret Key** (starts with `sk_live_...`)

### Step 2: Configure Production URLs in Clerk

While in the Clerk Dashboard (Production mode):

1. **Go to "Paths" or "URLs" section**
2. **Add your Railway URLs**:
   - **Home URL**: `https://ollie-receipts-production.up.railway.app`
   - **Sign-in URL**: `https://ollie-receipts-production.up.railway.app`
   - **Sign-up URL**: `https://ollie-receipts-production.up.railway.app`
   - **After sign-in URL**: `https://ollie-receipts-production.up.railway.app`
   - **After sign-up URL**: `https://ollie-receipts-production.up.railway.app`

3. **Go to "Social Connections" or "OAuth"**
4. **Configure Google OAuth**:
   - Make sure Google is enabled
   - **Add authorized redirect URIs**:
     ```
     https://ollie-receipts-production.up.railway.app
     https://accounts.clerk.dev/v1/oauth_callback
     ```

5. **Go to "Allowed Origins" or "CORS"**
6. **Add your Railway frontend URL**:
   ```
   https://ollie-receipts-production.up.railway.app
   ```

### Step 3: Update Railway Environment Variables

1. **Go to Railway Dashboard**: https://railway.app
2. **Open your project**: ollie-receipts
3. **Select the FRONTEND service**
4. **Go to Variables tab**
5. **Update these variables**:
   ```
   VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_PRODUCTION_KEY_HERE
   ```
   (Replace with the `pk_live_...` key from Clerk)

6. **Select the BACKEND service**
7. **Go to Variables tab**
8. **Update these variables**:
   ```
   CLERK_SECRET_KEY=sk_live_YOUR_PRODUCTION_KEY_HERE
   ```
   (Replace with the `sk_live_...` key from Clerk)

9. **Verify other variables are correct**:
   ```
   FRONTEND_URL=https://ollie-receipts-production.up.railway.app
   NODE_ENV=production
   ```

### Step 4: Redeploy

After updating the environment variables:

1. **Railway will automatically redeploy** both services
2. **Wait 2-3 minutes** for deployment to complete
3. **Test the application**:
   - Visit your Railway URL
   - Try Google sign-in
   - Should redirect properly to dashboard

## Quick Verification Checklist

After completing the steps above:

- [ ] Clerk dashboard shows "Production" mode (not "Development")
- [ ] Railway frontend has `pk_live_...` key
- [ ] Railway backend has `sk_live_...` key
- [ ] Clerk has Railway URL in allowed origins
- [ ] Clerk has Railway URL in redirect URLs
- [ ] Google OAuth is enabled in Clerk production
- [ ] Both Railway services redeployed successfully

## Testing

Once everything is configured:

1. **Clear browser cache and cookies** for your Railway domain
2. **Visit**: https://ollie-receipts-production.up.railway.app
3. **Click "Sign in"**
4. **Click "Continue with Google"**
5. **Authenticate with Google**
6. **You should be redirected to the dashboard** ✅

## Troubleshooting

### Still redirecting to sign-in page?

1. Open browser console (F12)
2. Check for Clerk errors
3. Verify you're using production keys (no warning about development keys)
4. Check Network tab for failed requests

### "Invalid redirect URL" error?

- Make sure Railway URL is in Clerk's allowed redirect URLs
- Check that URL in Clerk matches exactly (with https://)

### Getting CORS errors?

- Add Railway URL to Clerk allowed origins
- Verify FRONTEND_URL in backend matches frontend URL

## Important Notes

- **Development keys (`pk_test_`, `sk_test_`)** = For local development only
- **Production keys (`pk_live_`, `sk_live_`)** = For production/Railway deployment
- **Always use production keys in Railway**
- **Keep your secret keys secure** - never commit them to git

## Need Help?

If you're still having issues after following these steps:
1. Share the exact error message from browser console
2. Verify which Clerk keys are currently in Railway
3. Check Clerk dashboard for any error logs


