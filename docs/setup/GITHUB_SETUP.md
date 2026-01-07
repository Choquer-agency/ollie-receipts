# GitHub Setup Instructions

## Create Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `ollie-receipts`
3. Description: "AI-powered receipt management with QuickBooks integration"
4. Privacy: Choose Private or Public
5. DO NOT initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Push Code to GitHub

After creating the repository, run these commands:

```bash
cd "/Users/brycechoquer/Desktop/Ollie Receipts"

# Add GitHub as remote
git remote add origin https://github.com/YOUR_USERNAME/ollie-receipts.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

## Verify

Go to https://github.com/YOUR_USERNAME/ollie-receipts and verify all files are there.

## Next Steps

After pushing to GitHub:
1. Go to Railway (https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose the ollie-receipts repository
5. Follow RAILWAY_DEPLOY.md for detailed deployment instructions



