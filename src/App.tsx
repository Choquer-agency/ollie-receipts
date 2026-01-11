import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Receipt, ReceiptStatus } from './types';
import { connectToQuickBooks } from './services/qboService';
import ReceiptList from './components/ReceiptList';
import ReceiptUpload from './components/ReceiptUpload';
import ReceiptReview from './components/ReceiptReview';
import AuthModal from './components/AuthModal';
import UserMenu from './components/UserMenu';
import { CheckCircle2 } from 'lucide-react';
import { receiptApi, setAuthToken, setTokenRefreshCallback } from './services/apiService';

const App: React.FC = () => {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [view, setView] = useState<'list' | 'review'>('list');
  const [activeTab, setActiveTab] = useState<'new' | 'processing' | 'posted'>('new');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isQboConnected, setIsQboConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Close auth modal when user signs in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setShowAuthModal(false);
    }
  }, [isLoaded, isSignedIn]);

  // Set up token refresh callback for API service
  useEffect(() => {
    setTokenRefreshCallback(async () => {
      try {
        const token = await getToken();
        return token;
      } catch (error) {
        console.error('Token refresh callback failed:', error);
        return null;
      }
    });
  }, [getToken]);

  useEffect(() => {
    const loadReceipts = async () => {
      if (!isLoaded || !isSignedIn) {
        setLoading(false);
        return;
      }

      try {
        const token = await getToken();
        if (token) {
          setAuthToken(token);
          const data = await receiptApi.getAll();
          // Ensure we always have an array
          if (Array.isArray(data)) {
            setReceipts(data);
          } else {
            console.warn('API returned non-array data:', data);
            setReceipts([]);
          }
        }
      } catch (error) {
        console.error('Failed to load receipts:', error);
        setReceipts([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    loadReceipts();
  }, [isLoaded, isSignedIn, getToken]);

  const handleUploadComplete = (receipt: Receipt) => {
    setReceipts(prev => {
      const exists = prev.some(r => r.id === receipt.id);
      if (exists) {
        return prev.map(r => r.id === receipt.id ? receipt : r);
      }
      return [receipt, ...prev];
    });
  };

  const handleSelectReceipt = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setView('review');
  };

  const handleUpdateReceipt = async (updated: Receipt) => {
    try {
      // Transform snake_case to camelCase for API
      // Convert null to undefined (Zod's .optional() accepts undefined but not null)
      const apiData: any = {
        imageUrl: updated.image_url,
        status: updated.status,
        originalFilename: updated.original_filename ?? undefined,
        vendorName: updated.vendor_name ?? undefined,
        transactionDate: updated.transaction_date ?? undefined,
        subtotal: updated.subtotal ?? undefined,
        tax: updated.tax ?? undefined,
        total: updated.total ?? undefined,
        currency: updated.currency ?? undefined,
        suggestedCategory: updated.suggested_category ?? undefined,
        description: updated.description ?? undefined,
        documentType: updated.document_type ?? undefined,
        taxTreatment: updated.tax_treatment ?? undefined,
        taxRate: updated.tax_rate ?? undefined,
        publishTarget: updated.publish_target ?? undefined,
        isPaid: updated.is_paid ?? undefined,
        paymentAccountId: updated.payment_account_id ?? undefined,
        qbAccountId: updated.qb_account_id ?? undefined,
      };
      
      await receiptApi.update(updated.id, apiData);
      setReceipts(prev => prev.map(r => r.id === updated.id ? updated : r));
    } catch (error: any) {
      console.error('Failed to update receipt:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
    }
  };

  const handleBackToList = () => {
    setSelectedReceipt(null);
    setView('list');
  };

  const handleConnectQBO = async () => {
    const success = await connectToQuickBooks();
    setIsQboConnected(success);
  };

  const formatCount = (count: number) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return count.toString();
  };

  const newReceipts = receipts.filter(r => 
    r.status === ReceiptStatus.OCR_COMPLETE || 
    r.status === ReceiptStatus.REVIEWED || 
    r.status === ReceiptStatus.ERROR
  );
  const processingReceipts = receipts.filter(r => r.status === ReceiptStatus.UPLOADED);
  const postedReceipts = receipts.filter(r => r.status === ReceiptStatus.PUBLISHED);

  const getCurrentList = () => {
    switch (activeTab) {
      case 'processing': return processingReceipts;
      case 'posted': return postedReceipts;
      case 'new': default: return newReceipts;
    }
  };

  const TabButton = ({ 
    id, 
    label, 
    count, 
    isActive 
  }: { 
    id: typeof activeTab, 
    label: string, 
    count: number, 
    isActive: boolean 
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '16px 4px',
        fontSize: 'var(--font-size-body)',
        fontWeight: 'var(--font-weight-semibold)',
        fontFamily: 'var(--font-body)',
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: '2px solid',
        borderBottomColor: isActive ? 'var(--primary)' : 'transparent',
        color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
        transition: 'var(--transition-default)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = 'var(--text-primary)';
          e.currentTarget.style.borderBottomColor = 'var(--border-strong)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.borderBottomColor = 'transparent';
        }
      }}
    >
      {label}
      <span style={{
        padding: '2px 8px',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--font-size-small)',
        fontWeight: 'var(--font-weight-semibold)',
        backgroundColor: isActive ? 'var(--background-muted)' : 'var(--background-muted)',
        color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
      }}>
        {formatCount(count)}
      </span>
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '48px' }}>
      {/* Top Navbar */}
      <nav style={{
        backgroundColor: 'var(--background-elevated)',
        borderBottom: '1px solid var(--border-default)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 16px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            height: '64px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <img 
                src="/logo.svg" 
                alt="Ollie Receipts" 
                style={{ 
                  height: '24px',
                  width: 'auto'
                }} 
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               {!isSignedIn ? (
                 <button 
                   onClick={() => setShowAuthModal(true)}
                   style={{
                     fontSize: 'var(--font-size-body)',
                     fontWeight: 'var(--font-weight-semibold)',
                     color: 'white',
                     backgroundColor: 'var(--primary)',
                     padding: '8px 16px',
                     borderRadius: 'var(--radius-md)',
                     border: 'none',
                     cursor: 'pointer',
                     transition: 'var(--transition-default)',
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.backgroundColor = 'var(--primary-hover)';
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.backgroundColor = 'var(--primary)';
                   }}
                 >
                   Sign in
                 </button>
               ) : (
                 <>
                   {!isQboConnected ? (
                     <button 
                      onClick={handleConnectQBO}
                      style={{
                        fontSize: 'var(--font-size-body)',
                        fontWeight: 'var(--font-weight-semibold)',
                        color: 'white',
                        backgroundColor: '#00C020',
                        width: '150px',
                        height: '206px',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'var(--transition-default)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                     >
                       Connect QuickBooks
                     </button>
                   ) : (
                     <span style={{
                       display: 'flex',
                       alignItems: 'center',
                       gap: '6px',
                       fontSize: 'var(--font-size-small)',
                       fontWeight: 'var(--font-weight-semibold)',
                       color: 'var(--status-success-text)',
                       backgroundColor: 'var(--status-success-bg)',
                       padding: '4px 10px',
                       borderRadius: 'var(--radius-md)',
                       border: '1px solid var(--status-success-text)',
                     }}>
                        <CheckCircle2 size={12} /> QBO Connected
                     </span>
                   )}
                   <UserMenu />
                 </>
               )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '24px 16px',
      }}>
        {!isSignedIn ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 16px',
          }}>
            <h2 style={{
              fontSize: 'var(--font-size-h2)',
              fontWeight: 'var(--font-weight-bold)',
              fontFamily: 'var(--font-heading)',
              color: 'var(--text-primary)',
              marginBottom: '16px',
            }}>
              Welcome to Ollie
            </h2>
            <p style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--text-secondary)',
              marginBottom: '24px',
            }}>
              Please sign in to manage your receipts
            </p>
            <button 
              onClick={() => setShowAuthModal(true)}
              style={{
                fontSize: 'var(--font-size-body)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'white',
                backgroundColor: 'var(--primary)',
                padding: '12px 24px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                transition: 'var(--transition-default)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary)';
              }}
            >
              Sign in to get started
            </button>
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
          </div>
        ) : view === 'list' ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}>
             <div style={{
               borderBottom: '1px solid var(--border-default)',
               marginBottom: '24px',
             }}>
                <div style={{
                  display: 'flex',
                  gap: '32px',
                }}>
                  <TabButton 
                    id="new" 
                    label="New receipts" 
                    count={newReceipts.length} 
                    isActive={activeTab === 'new'} 
                  />
                  <TabButton 
                    id="processing" 
                    label="Processing" 
                    count={processingReceipts.length} 
                    isActive={activeTab === 'processing'} 
                  />
                  <TabButton 
                    id="posted" 
                    label="Posted receipts" 
                    count={postedReceipts.length} 
                    isActive={activeTab === 'posted'} 
                  />
                </div>
             </div>

             {activeTab === 'new' && (
                <ReceiptUpload onUploadComplete={handleUploadComplete} />
             )}

             <div style={{ marginTop: '16px' }}>
                <ReceiptList receipts={getCurrentList()} onSelect={handleSelectReceipt} />
             </div>
          </div>
        ) : (
          selectedReceipt && (
            <ReceiptReview 
              receipt={selectedReceipt} 
              onUpdate={handleUpdateReceipt} 
              onBack={handleBackToList} 
            />
          )
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
};

export default App;

