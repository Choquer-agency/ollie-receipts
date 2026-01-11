# Environment Variables Configuration

## Frontend (.env)
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
VITE_API_URL=http://localhost:4000

## Backend (server/.env)
DATABASE_URL=postgresql://username:password@ep-xxx.neon.tech/neondb?sslmode=require
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key
CLOUDFLARE_R2_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_r2_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_r2_secret_key
CLOUDFLARE_R2_BUCKET_NAME=ollie-receipts
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
GEMINI_API_KEY=your_gemini_api_key_here
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3331

# QuickBooks OAuth (see QUICKBOOKS_SETUP.md for detailed setup)
INTUIT_CLIENT_ID=your_intuit_client_id
INTUIT_CLIENT_SECRET=your_intuit_client_secret
INTUIT_REDIRECT_URI=http://localhost:4000/api/qbo/callback
INTUIT_ENVIRONMENT=sandbox

## Setup Instructions

### 1. Clerk (Already have keys)
You already have:
- CLERK_SECRET_KEY in your .env
- Need to add CLERK_PUBLISHABLE_KEY (get from Clerk dashboard)

### 2. Neon Database
1. Go to https://console.neon.tech
2. Create new project "ollie-receipts"
3. Copy the connection string
4. Run the SQL schema from server/src/db/schema.sql

### 3. Cloudflare R2
1. Go to https://dash.cloudflare.com
2. Go to R2 Object Storage
3. Create a new bucket called "ollie-receipts"
4. Generate API tokens:
   - Click "Manage R2 API Tokens"
   - Create API token with read & write permissions
   - Copy the Account ID, Access Key ID, and Secret Access Key
5. Configure public access:
   - Go to bucket settings
   - Enable public access or set up a custom domain
   - Copy the public URL

### 4. Gemini API
You already have this key - copy it to both frontend and backend .env files

### 5. QuickBooks OAuth (Optional)
For QuickBooks integration, see the detailed setup guide in `QUICKBOOKS_SETUP.md`:

1. Go to https://developer.intuit.com
2. Create a new app or use an existing one
3. Configure OAuth redirect URI: `http://localhost:4000/api/qbo/callback`
4. Copy Client ID and Client Secret
5. Add to `server/.env`:
   ```
   INTUIT_CLIENT_ID=your_client_id
   INTUIT_CLIENT_SECRET=your_client_secret
   INTUIT_REDIRECT_URI=http://localhost:4000/api/qbo/callback
   INTUIT_ENVIRONMENT=sandbox
   ```

**Note**: QuickBooks integration is optional. The app will work without it, but the "Connect QuickBooks" button won't function until configured.

## For Production (Railway)
Set these same environment variables in Railway dashboard, but update:
- VITE_API_URL=https://your-backend.railway.app
- FRONTEND_URL=https://your-frontend.railway.app
- NODE_ENV=production
- INTUIT_REDIRECT_URI=https://your-backend.railway.app/api/qbo/callback
- INTUIT_ENVIRONMENT=production (only after app is approved by Intuit)



