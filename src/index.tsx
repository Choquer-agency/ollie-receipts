import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider, AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import App from './App';
import './main.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key');
}

// Check if this is an OAuth callback (redirect from Google/Clerk)
const isSSOCallback = window.location.pathname === '/sso-callback';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      {isSSOCallback ? (
        <AuthenticateWithRedirectCallback />
      ) : (
        <App />
      )}
    </ClerkProvider>
  </React.StrictMode>
);
