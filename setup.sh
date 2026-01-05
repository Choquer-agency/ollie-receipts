#!/bin/bash

# Ollie Receipts - Quick Start Setup Script

echo "🎉 Ollie Receipts - Full Stack Setup"
echo "===================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  Frontend .env file not found!"
    echo "📝 Creating .env from template..."
    cat > .env << 'EOF'
VITE_GEMINI_API_KEY=
VITE_CLERK_PUBLISHABLE_KEY=
VITE_API_URL=http://localhost:4000
EOF
    echo "✅ Created .env file"
    echo "⚠️  Please fill in your environment variables in .env"
    echo ""
else
    echo "✅ Frontend .env file exists"
fi

# Check if server/.env exists
if [ ! -f server/.env ]; then
    echo "⚠️  Backend server/.env file not found!"
    echo "📝 Creating server/.env from template..."
    cat > server/.env << 'EOF'
DATABASE_URL=
CLERK_SECRET_KEY=sk_test_oPYakPiLZaw7ItaUHBITRL0Z8Z5cLhv66nBGFUf6Mp
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=ollie-receipts
CLOUDFLARE_R2_PUBLIC_URL=
GEMINI_API_KEY=
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3331
EOF
    echo "✅ Created server/.env file"
    echo "⚠️  Please fill in your environment variables in server/.env"
    echo ""
else
    echo "✅ Backend .env file exists"
fi

echo ""
echo "📦 Installing dependencies..."
echo ""

# Install frontend dependencies
echo "Installing frontend dependencies..."
npm install

# Install backend dependencies
echo "Installing backend dependencies..."
cd server
npm install
cd ..

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Configure your environment variables:"
echo "   - Edit .env (frontend)"
echo "   - Edit server/.env (backend)"
echo "   - See ENV_SETUP.md for details"
echo ""
echo "2. Set up Neon Database:"
echo "   - See server/NEON_SETUP.md"
echo ""
echo "3. Set up Cloudflare R2:"
echo "   - See ENV_SETUP.md"
echo ""
echo "4. Start development servers:"
echo "   Terminal 1: cd server && npm run dev"
echo "   Terminal 2: npm run dev"
echo ""
echo "5. Open http://localhost:3331"
echo ""
echo "📚 For complete documentation, see:"
echo "   - IMPLEMENTATION_SUMMARY.md (START HERE)"
echo "   - README.md"
echo "   - ENV_SETUP.md"
echo ""


