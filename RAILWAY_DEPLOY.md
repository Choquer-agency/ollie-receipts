# Railway Deployment Guide

## Prerequisites

1. GitHub account
2. Railway account (sign up at https://railway.app)
3. All environment variables ready (see ENV_SETUP.md)

## Deployment Steps

### 1. Push to GitHub

If you haven't created a GitHub repository yet:

1. Go to https://github.com/new
2. Create a new repository named "ollie-receipts"
3. DO NOT initialize with README (we already have one)
4. Copy the commands and run:

```bash
cd "/Users/brycechoquer/Desktop/Ollie Receipts"
git remote add origin https://github.com/YOUR_USERNAME/ollie-receipts.git
git branch -M main
git push -u origin main
```

### 2. Set Up Railway Project

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Connect your GitHub account if not already connected
4. Select the "ollie-receipts" repository

### 3. Create Backend Service

1. Railway will detect the project automatically
2. Click "Add Service" → "GitHub Repo"
3. Configure the backend service:
   - **Root Directory**: `server`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`

4. Add environment variables in Railway dashboard:
   - DATABASE_URL (from Neon)
   - CLERK_SECRET_KEY
   - CLOUDFLARE_R2_ACCOUNT_ID
   - CLOUDFLARE_R2_ACCESS_KEY_ID
   - CLOUDFLARE_R2_SECRET_ACCESS_KEY
   - CLOUDFLARE_R2_BUCKET_NAME
   - CLOUDFLARE_R2_PUBLIC_URL
   - GEMINI_API_KEY
   - PORT=4000
   - NODE_ENV=production
   - FRONTEND_URL (will be set after frontend is deployed)

5. Railway will automatically deploy the backend

### 4. Create Frontend Service

1. Click "New Service" in your Railway project
2. Select "GitHub Repo" again (same repo)
3. Configure the frontend service:
   - **Root Directory**: `/` (root)
   - **Build Command**: `npm run build`
   - **Start Command**: (leave empty, Railway will serve static files)

4. Add environment variables:
   - VITE_GEMINI_API_KEY
   - VITE_CLERK_PUBLISHABLE_KEY
   - VITE_API_URL (use the backend service URL from Railway)

### 5. Update CORS and URLs

1. Copy the deployed frontend URL from Railway
2. Go back to backend service settings
3. Update the FRONTEND_URL environment variable with the actual frontend URL
4. Update VITE_API_URL in frontend with the actual backend URL
5. Redeploy both services

### 6. Update Clerk Settings

1. Go to Clerk dashboard
2. Add your production URLs to allowed origins:
   - Frontend URL (from Railway)
   - Backend URL (from Railway)

### 7. Verify Deployment

1. Visit your frontend URL
2. Test sign in/sign up
3. Upload a receipt
4. Verify it saves to Neon database

## Continuous Deployment

Railway automatically deploys when you push to GitHub:

```bash
git add .
git commit -m "Your commit message"
git push
```

## Monitoring

- View logs in Railway dashboard
- Check health endpoint: https://your-backend.railway.app/health
- Monitor database in Neon dashboard

## Troubleshooting

### Build Failures
- Check Railway logs
- Verify all environment variables are set
- Ensure dependencies are in package.json

### Database Connection Issues
- Verify DATABASE_URL is correct
- Check Neon database is active
- Ensure IP allowlist in Neon allows Railway

### CORS Errors
- Verify FRONTEND_URL in backend matches actual frontend URL
- Check Clerk allowed origins

## Custom Domains (Optional)

1. Go to service settings in Railway
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Update DNS records as shown
5. Update environment variables with new domain

