# Ollie Receipts

AI-powered receipt management system with QuickBooks integration.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: Neon PostgreSQL
- **Authentication**: Clerk (Google OAuth + Email)
- **Storage**: Cloudflare R2
- **AI**: Google Gemini for OCR
- **Deployment**: Railway

## Local Development Setup

### Prerequisites

- Node.js 18+ and npm
- Clerk account
- Neon database
- Cloudflare R2 bucket
- Gemini API key

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd ollie-receipts
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd server
npm install
cd ..
```

4. Set up environment variables:

Create `.env` in root directory:
```
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key
VITE_API_URL=http://localhost:4000
```

Create `server/.env`:
```
DATABASE_URL=postgresql://...neon.tech/...
CLERK_SECRET_KEY=sk_test_your_key
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET_NAME=ollie-receipts
CLOUDFLARE_R2_PUBLIC_URL=https://your-bucket.r2.dev
GEMINI_API_KEY=your_gemini_api_key
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3331

# QuickBooks OAuth (optional - see QUICKBOOKS_SETUP.md)
INTUIT_CLIENT_ID=your_client_id
INTUIT_CLIENT_SECRET=your_client_secret
INTUIT_REDIRECT_URI=http://localhost:4000/api/qbo/callback
INTUIT_ENVIRONMENT=sandbox
```

5. Set up Neon database:

Run the SQL schema from `server/src/db/schema.sql` in your Neon SQL Editor.

See `server/NEON_SETUP.md` for detailed instructions.

6. Start development servers:

Terminal 1 - Backend:
```bash
cd server
npm run dev
```

Terminal 2 - Frontend:
```bash
npm run dev
```

The app will be available at http://localhost:3331

## Features

- 🔐 Secure authentication with Clerk
- 📸 Drag-and-drop receipt upload
- 🤖 AI-powered OCR with Google Gemini
- ☁️ Cloud storage with Cloudflare R2
- 📊 Receipt categorization and management
- 💼 QuickBooks OAuth integration with automatic token refresh
- 📤 Publish receipts to QuickBooks as Purchase/Bill transactions
- 🎨 Modern, responsive UI

## Project Structure

```
ollie-receipts/
├── src/                      # React frontend
│   ├── components/          # React components
│   ├── services/            # API and service integrations
│   ├── types/               # TypeScript types
│   └── App.tsx             # Main app component
├── server/                  # Express backend
│   └── src/
│       ├── controllers/    # Route controllers
│       ├── routes/         # API routes
│       ├── middleware/     # Auth and other middleware
│       ├── db/            # Database connection and schema
│       └── config/        # Configuration files
├── design-system/          # Design tokens and guidelines
└── docs/                   # Documentation
    ├── setup/             # Setup and deployment guides
    ├── features/          # Feature documentation
    ├── implementation/    # Implementation guides
    └── archive/          # Historical documentation
```

## Deployment

See deployment guides in `docs/setup/`:
- `RAILWAY_DEPLOY.md` - Railway deployment instructions
- `ENV_SETUP.md` - Environment variables configuration
- `GITHUB_SETUP.md` - GitHub repository setup
- `PRODUCTION_CLERK_SETUP.md` - Production authentication setup
- `QUICKBOOKS_SETUP.md` - QuickBooks OAuth integration setup

## Documentation

All project documentation is organized in the `docs/` folder:
- **Setup guides** (`docs/setup/`) - Installation, deployment, and configuration
- **Features** (`docs/features/`) - Feature documentation and guides  
- **Implementation** (`docs/implementation/`) - Technical implementation details
- **Archive** (`docs/archive/`) - Historical documentation and completed work

## License

Private - All rights reserved
