import './config/env.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { clerkMiddleware } from '@clerk/express';
import receiptRoutes from './routes/receipts.js';
import qboRoutes from './routes/qbo.js';
import categoryRoutes from './routes/categories.js';
import categoryRulesRoutes from './routes/categoryRules.js';
import orgRoutes from './routes/org.js';
import { validateQBConfig } from './config/quickbooks.js';
import { startQuickBooksTokenRefreshJob } from './jobs/qboTokenRefresh.js';
import { isLangfuseConfigured } from './services/langfuseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3331';

// Trust proxy for Railway (ensures req.protocol returns 'https' behind reverse proxy)
app.set('trust proxy', true);

// Middleware
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3331'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add Clerk middleware to handle authentication
app.use(clerkMiddleware());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/receipts', receiptRoutes);
app.use('/api/qbo', qboRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/category-rules', categoryRulesRoutes);
app.use('/api/org', orgRoutes);

// Serve static files from frontend build in production
if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.join(__dirname, '../../dist');
  console.log('Serving static files from:', frontendDistPath);
  
  app.use(express.static(frontendDistPath));
  
  // Serve index.html for all other routes (SPA fallback)
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV === 'production') {
    console.log('Serving frontend from /dist');
  }
  console.log(`Accepting requests from: ${FRONTEND_URL}`);
  
  // Langfuse observability
  if (isLangfuseConfigured()) {
    console.log('✓ Langfuse observability configured');
  } else {
    console.log('⚠ Langfuse not configured (LANGFUSE_SECRET_KEY / LANGFUSE_PUBLIC_KEY missing)');
  }

  // Validate QuickBooks configuration
  const qbConfig = validateQBConfig();
  if (qbConfig.valid) {
    console.log('✓ QuickBooks configuration loaded');
    console.log(`  Client ID: ${process.env.INTUIT_CLIENT_ID?.substring(0, 8)}...`);
    console.log(`  Redirect URI: ${process.env.INTUIT_REDIRECT_URI}`);
    
    // Start background token refresh job (Option 3: Hybrid approach)
    if (process.env.QB_DISABLE_BACKGROUND_REFRESH !== 'true') {
      startQuickBooksTokenRefreshJob();
      console.log('✓ QuickBooks token refresh job started (keeps connections alive 100+ days)');
    } else {
      console.log('⚠ QuickBooks background refresh disabled by environment variable');
    }
  } else {
    console.warn('⚠ QuickBooks configuration incomplete. Missing:', qbConfig.missing.join(', '));
    console.warn('  QuickBooks integration will not work until configured.');
  }
});

