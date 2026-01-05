# 📋 Setup Checklist

Use this checklist to track your progress setting up Ollie Receipts.

## Phase 1: Initial Setup ✅

- [x] Git repository initialized
- [x] Backend Express server created
- [x] Frontend Clerk integration added
- [x] API service layer created
- [x] Documentation created

## Phase 2: Service Configuration ⏳

### Clerk Authentication
- [ ] Get publishable key from Clerk dashboard
- [ ] Add `VITE_CLERK_PUBLISHABLE_KEY` to frontend `.env`
- [ ] Verify `CLERK_SECRET_KEY` in backend `server/.env`
- [ ] Enable Google OAuth in Clerk dashboard
- [ ] Enable Email/Password in Clerk dashboard

### Neon Database
- [ ] Create Neon project "ollie-receipts"
- [ ] Copy connection string
- [ ] Add `DATABASE_URL` to `server/.env`
- [ ] Run `server/src/db/schema.sql` in Neon SQL Editor
- [ ] Verify tables created (users, receipts)

### Cloudflare R2
- [ ] Create R2 bucket "ollie-receipts"
- [ ] Generate API token (read & write)
- [ ] Copy Account ID → `CLOUDFLARE_R2_ACCOUNT_ID`
- [ ] Copy Access Key → `CLOUDFLARE_R2_ACCESS_KEY_ID`
- [ ] Copy Secret Key → `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- [ ] Enable public access on bucket
- [ ] Copy public URL → `CLOUDFLARE_R2_PUBLIC_URL`

### Gemini API
- [ ] Copy Gemini API key to frontend `.env` as `VITE_GEMINI_API_KEY`
- [ ] Copy Gemini API key to backend `server/.env` as `GEMINI_API_KEY`

## Phase 3: Local Development ⏳

- [ ] Run `./setup.sh` or manually install dependencies
- [ ] Fill in all environment variables
- [ ] Start backend: `cd server && npm run dev`
- [ ] Start frontend: `npm run dev`
- [ ] Visit http://localhost:3331
- [ ] Test sign up with email
- [ ] Test sign in with Google
- [ ] Upload a test receipt
- [ ] Verify OCR extraction works
- [ ] Check receipt saves to database

## Phase 4: GitHub Setup ⏳

- [ ] Create GitHub repository "ollie-receipts"
- [ ] Add remote: `git remote add origin https://github.com/YOUR_USERNAME/ollie-receipts.git`
- [ ] Push code: `git push -u origin main`
- [ ] Verify all files pushed successfully

## Phase 5: Railway Deployment ⏳

### Backend Service
- [ ] Create Railway project
- [ ] Connect GitHub repository
- [ ] Create backend service (root: `server/`)
- [ ] Add all backend environment variables
- [ ] Wait for successful deployment
- [ ] Copy backend URL
- [ ] Test health endpoint: `https://your-backend.railway.app/health`

### Frontend Service
- [ ] Create frontend service in same Railway project
- [ ] Set root directory to `/`
- [ ] Add frontend environment variables
- [ ] Set `VITE_API_URL` to backend URL
- [ ] Wait for successful deployment
- [ ] Copy frontend URL

### Post-Deployment Configuration
- [ ] Update backend `FRONTEND_URL` with actual frontend URL
- [ ] Redeploy backend
- [ ] Add production URLs to Clerk allowed origins
- [ ] Test production deployment
- [ ] Verify authentication works
- [ ] Upload test receipt in production
- [ ] Check database for receipt

## Phase 6: Final Verification ✅

- [ ] Local development working
- [ ] Production deployment working
- [ ] Authentication working (Google + Email)
- [ ] File upload to R2 working
- [ ] Gemini OCR extraction working
- [ ] Database persistence working
- [ ] All receipts displaying correctly

## Troubleshooting

If you encounter issues, refer to:
- `IMPLEMENTATION_SUMMARY.md` - Complete overview
- `ENV_SETUP.md` - Environment variables
- `server/NEON_SETUP.md` - Database setup
- `RAILWAY_DEPLOY.md` - Deployment guide
- Backend logs in Railway dashboard
- Browser console for frontend errors

## Quick Reference

### Start Development
```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend  
npm run dev
```

### Deploy Changes
```bash
git add .
git commit -m "Your message"
git push
# Railway auto-deploys
```

### View Logs
- Local: Check terminal output
- Production: Railway dashboard → Service → Logs

---

**Last Updated**: Implementation complete, ready for configuration


