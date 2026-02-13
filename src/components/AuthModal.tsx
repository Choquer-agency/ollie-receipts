import React, { useState } from 'react';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { X, AlertCircle, Loader2 } from 'lucide-react';

// Google icon component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'signin' }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const { signIn, setActive: setActiveSignIn } = useSignIn();
  const { signUp, setActive: setActiveSignUp } = useSignUp();

  if (!isOpen) return null;

  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      // Use redirect strategy for OAuth flow
      await signIn?.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: window.location.origin + '/sso-callback',
        redirectUrlComplete: window.location.origin,
      });
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.errors?.[0]?.message || 'Failed to sign in with Google');
      setGoogleLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    
    setLoading(true);
    setError('');

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActiveSignIn({ session: result.createdSessionId });
        onClose();
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;

    setLoading(true);
    setError('');

    try {
      // Split full name into first and last name
      const names = fullName.trim().split(' ');
      const firstName = names[0] || '';
      const lastName = names.slice(1).join(' ') || '';

      const result = await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
      });

      if (result.status === 'complete') {
        await setActiveSignUp({ session: result.createdSessionId });
        onClose();
      } else if (result.status === 'missing_requirements') {
        // Handle email verification if needed
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setPendingVerification(true);
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;

    setLoading(true);
    setError('');

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result.status === 'complete') {
        await setActiveSignUp({ session: result.createdSessionId });
        onClose();
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--background-elevated)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-overlay)',
    border: 'none',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 'var(--font-size-body)',
    fontFamily: 'var(--font-body)',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--background-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    transition: 'var(--transition-default)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 'var(--font-size-small)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--text-primary)',
    marginBottom: '6px',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 'var(--z-backdrop)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          ...cardStyle,
          width: '90%',
          maxWidth: '440px',
          maxHeight: '90vh',
          overflow: 'auto',
          zIndex: 'var(--z-modal)',
        }}
      >
        {/* Content */}
        <div style={{ padding: '24px 32px 24px 32px' }}>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              right: '16px',
              top: '16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              transition: 'var(--transition-default)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <X size={20} />
          </button>

          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <img 
              src="/logo.svg" 
              alt="Ollie Receipts" 
              style={{ 
                height: '32px',
                width: 'auto'
              }} 
            />
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h1
              style={{
                fontSize: 'calc(var(--font-size-h2) * 1.2)',
                fontWeight: 'var(--font-weight-semibold)',
                fontFamily: 'var(--font-heading)',
                color: 'var(--text-primary)',
                marginBottom: '4px',
              }}
            >
              {pendingVerification 
                ? 'Verify your email' 
                : mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p
              style={{
                fontSize: 'var(--font-size-small)',
                color: 'var(--text-secondary)',
                margin: 0,
              }}
            >
              {pendingVerification 
                ? 'Enter the code we sent to your email' 
                : mode === 'signin' ? 'Sign in to your account' : 'Start managing receipts in minutes'}
            </p>
          </div>

          {/* Google Sign In Button - only show when not in verification mode */}
          {!pendingVerification && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading || googleLoading}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 16px',
                  fontSize: 'var(--font-size-body)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--background-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  cursor: (loading || googleLoading) ? 'not-allowed' : 'pointer',
                  transition: 'var(--transition-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: (loading || googleLoading) ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loading && !googleLoading) {
                    e.currentTarget.style.backgroundColor = 'var(--background-muted)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && !googleLoading) {
                    e.currentTarget.style.backgroundColor = 'var(--background-elevated)';
                  }
                }}
              >
                {googleLoading ? (
                  <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <GoogleIcon />
                )}
                Continue with Google
              </button>

              {/* Divider */}
              <div style={{ position: 'relative', margin: '20px 0' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '1px',
                      backgroundColor: 'var(--border-default)',
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      backgroundColor: 'var(--background-elevated)',
                      padding: '0 8px',
                      fontSize: 'var(--font-size-tiny)',
                      textTransform: 'uppercase',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    or continue with email
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Error message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '12px',
                backgroundColor: 'var(--status-error-bg)',
                border: '1px solid var(--status-error-text)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
              }}
            >
              <AlertCircle
                size={16}
                style={{
                  color: 'var(--status-error-text)',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              />
              <p
                style={{
                  fontSize: 'var(--font-size-small)',
                  color: 'var(--status-error-text)',
                  margin: 0,
                }}
              >
                {error}
              </p>
            </div>
          )}

          {/* Form */}
          {pendingVerification ? (
            // Verification Code Form
            <form
              onSubmit={handleVerifyCode}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <p style={{ 
                  fontSize: 'var(--font-size-body)', 
                  color: 'var(--text-primary)',
                  margin: '0 0 4px 0',
                  fontWeight: 'var(--font-weight-medium)'
                }}>
                  Please check your email
                </p>
                <p style={{ 
                  fontSize: 'var(--font-size-small)', 
                  color: 'var(--text-secondary)',
                  margin: 0
                }}>
                  We sent a verification code to <strong>{email}</strong>
                </p>
              </div>

              <div>
                <label htmlFor="verificationCode" style={labelStyle}>
                  Verification code
                </label>
                <input
                  id="verificationCode"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  maxLength={6}
                  style={{
                    ...inputStyle,
                    textAlign: 'center',
                    fontSize: 'calc(var(--font-size-body) * 1.2)',
                    letterSpacing: '0.25em'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || verificationCode.length !== 6}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 16px',
                  fontSize: 'var(--font-size-body)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'white',
                  backgroundColor: (loading || verificationCode.length !== 6) ? 'var(--text-tertiary)' : 'var(--primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: (loading || verificationCode.length !== 6) ? 'not-allowed' : 'pointer',
                  transition: 'var(--transition-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (!loading && verificationCode.length === 6) {
                    e.currentTarget.style.backgroundColor = 'var(--primary-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && verificationCode.length === 6) {
                    e.currentTarget.style.backgroundColor = 'var(--primary)';
                  }
                }}
              >
                {loading ? (
                  <>
                    <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                    Verifying...
                  </>
                ) : (
                  'Verify email'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPendingVerification(false);
                  setVerificationCode('');
                  setError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--font-size-small)',
                  cursor: 'pointer',
                  padding: '8px',
                  textAlign: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                ← Back to sign up
              </button>
            </form>
          ) : (
            // Regular Sign In/Sign Up Form
            <form
              onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {mode === 'signup' && (
                <div>
                  <label htmlFor="fullName" style={labelStyle}>
                    Full name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    placeholder="John Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    style={inputStyle}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-default)';
                    }}
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" style={labelStyle}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                  }}
                />
              </div>

              <div>
                <label htmlFor="password" style={labelStyle}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 16px',
                  fontSize: 'var(--font-size-body)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'white',
                  backgroundColor: (loading || googleLoading) ? 'var(--text-tertiary)' : 'var(--primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: (loading || googleLoading) ? 'not-allowed' : 'pointer',
                  transition: 'var(--transition-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '4px',
                }}
                onMouseEnter={(e) => {
                  if (!loading && !googleLoading) {
                    e.currentTarget.style.backgroundColor = 'var(--primary-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && !googleLoading) {
                    e.currentTarget.style.backgroundColor = 'var(--primary)';
                  }
                }}
              >
                {loading ? (
                  <>
                    <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                    {mode === 'signin' ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  mode === 'signin' ? 'Sign in' : 'Create account'
                )}
              </button>
            </form>
          )}

          {/* Footer */}
          {!pendingVerification && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)', margin: 0 }}>
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin');
                    setError('');
                    setFullName('');
                    setEmail('');
                    setPassword('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontWeight: 'var(--font-weight-medium)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add keyframe animation for spinner */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
};

export default AuthModal;


