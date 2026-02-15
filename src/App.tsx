import React, { useState, useEffect } from 'react';
import { useAuth, useOrganization } from '@clerk/clerk-react';
import { Receipt, ReceiptStatus, CachedCategory, CategoryRule, OrgRole } from './types';
import { connectToQuickBooks, checkQBOStatus } from './services/qboService';
import ReceiptList from './components/ReceiptList';
import ReceiptUpload from './components/ReceiptUpload';
import ReceiptReview from './components/ReceiptReview';
import AccountPage from './components/AccountPage';
import TeamManagement from './components/TeamManagement';
import AuditLog from './components/AuditLog';
import AuthModal from './components/AuthModal';
import UserMenu from './components/UserMenu';
import { CheckCircle2 } from 'lucide-react';
import { receiptApi, categoryApi, categoryRulesApi, setAuthToken, setTokenRefreshCallback } from './services/apiService';

type ViewState = 'list' | 'review';
type TabState = 'new' | 'processing' | 'posted' | 'account' | 'team' | 'audit';

// Outer App: handles Clerk loading + auth gating only.
// useOrganization() is NOT called here — it moves to SignedInApp
// so it never runs during OAuth callback processing.
const App: React.FC = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();
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

  // Show loading while Clerk initializes (including OAuth callback processing)
  if (!isLoaded) {
    return (
      <div style={{ minHeight: '100vh' }}>
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
              alignItems: 'center',
            }}>
              <img
                src="/logo.svg"
                alt="Ollie Receipts"
                style={{ height: '24px', width: 'auto' }}
              />
            </div>
          </div>
        </nav>
        <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px' }}>
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  // Not signed in: show welcome page
  if (!isSignedIn) {
    return (
      <div style={{ minHeight: '100vh', paddingBottom: '48px' }}>
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
                  style={{ height: '24px', width: 'auto' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              </div>
            </div>
          </div>
        </nav>

        <main style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '24px 16px',
        }}>
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
        </main>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </div>
    );
  }

  // Signed in: render the full dashboard (org hooks are safe to call here)
  return <SignedInApp />;
};

// Inner component: only rendered when isLoaded && isSignedIn.
// Safe to call useOrganization() here since the user is authenticated.
const SignedInApp: React.FC = () => {
  const { getToken } = useAuth();
  const { organization, membership } = useOrganization();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [view, setView] = useState<ViewState>('list');
  const [activeTab, setActiveTab] = useState<TabState>('new');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isQboConnected, setIsQboConnected] = useState(false);
  const [qboConnectionNeedsRefresh, setQboConnectionNeedsRefresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cachedCategories, setCachedCategories] = useState<CachedCategory[]>([]);
  const [isSyncingCategories, setIsSyncingCategories] = useState(false);
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);

  // Derive org context and permissions
  const isInOrg = !!organization;
  const orgRole = (membership?.role as OrgRole) || null;
  const isAdmin = orgRole === 'org:admin';
  const isAccountant = orgRole === 'org:accountant';
  const isBookkeeper = orgRole === 'org:bookkeeper';
  const isEmployee = orgRole === 'org:employee';
  const canReview = !isInOrg || isAdmin || isAccountant || isBookkeeper;
  const canPublish = !isInOrg || isAdmin || isAccountant || isBookkeeper;
  const canManageTeam = isInOrg && (isAdmin || isAccountant);
  const canViewAudit = isInOrg && (isAdmin || isAccountant);
  const canConnectQBO = !isInOrg || isAdmin || isAccountant;

  // Load data on mount and when org context changes
  useEffect(() => {
    const loadReceipts = async () => {
      try {
        const token = await getToken();
        if (token) {
          setAuthToken(token);
          const data = await receiptApi.getAll();
          if (Array.isArray(data)) {
            setReceipts(data);
          } else {
            console.warn('API returned non-array data:', data);
            setReceipts([]);
          }

          // Check QuickBooks connection status
          const qboStatus = await checkQBOStatus();
          setIsQboConnected(qboStatus.connected);

          // Sync categories and load rules in background when QB is connected
          if (qboStatus.connected) {
            categoryApi.sync()
              .then(() => Promise.all([categoryApi.getAll(), categoryRulesApi.getAll()]))
              .then(([cats, rules]) => {
                setCachedCategories(cats);
                setCategoryRules(rules);
              })
              .catch(err => console.error('Category sync failed (non-fatal):', err));
          }
        }
      } catch (error) {
        console.error('Failed to load receipts:', error);
        setReceipts([]);
      } finally {
        setLoading(false);
      }
    };

    loadReceipts();
  }, [getToken, organization?.id]);

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
    if (!canReview) return;
    setSelectedReceipt(receipt);
    setView('review');
  };

  const handleUpdateReceipt = async (updated: Receipt) => {
    try {
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
        paidBy: updated.paid_by ?? undefined,
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
    try {
      const success = await connectToQuickBooks();
      setIsQboConnected(success);
      if (success) {
        setQboConnectionNeedsRefresh(false);
      }
    } catch (error) {
      console.error('Failed to connect to QuickBooks:', error);
      setIsQboConnected(false);
    }
  };

  const handleQboConnectionError = () => {
    console.warn('QuickBooks connection error detected, marking for refresh');
    setIsQboConnected(false);
    setQboConnectionNeedsRefresh(true);
  };

  const handleSyncCategories = async () => {
    setIsSyncingCategories(true);
    try {
      await categoryApi.sync();
      const cats = await categoryApi.getAll();
      setCachedCategories(cats);
    } catch (error) {
      console.error('Failed to sync categories:', error);
    } finally {
      setIsSyncingCategories(false);
    }
  };

  const refreshRules = async () => {
    try {
      const rules = await categoryRulesApi.getAll();
      setCategoryRules(rules);
    } catch (error) {
      console.error('Failed to refresh rules:', error);
    }
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
    id: TabState,
    label: string,
    count?: number,
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
      {count !== undefined && (
        <span style={{
          padding: '2px 8px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-small)',
          fontWeight: 'var(--font-weight-semibold)',
          backgroundColor: 'var(--background-muted)',
          color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
        }}>
          {formatCount(count)}
        </span>
      )}
    </button>
  );

  // Render QBO connect button (only admin in org mode, or always in solo mode)
  const renderQboButton = () => {
    if (!canConnectQBO) return null;

    if (qboConnectionNeedsRefresh) {
      return (
        <button
          onClick={handleConnectQBO}
          style={{
            fontSize: 'var(--font-size-body)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'white',
            backgroundColor: '#FF6B00',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            transition: 'var(--transition-default)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          Reconnect QuickBooks
        </button>
      );
    }

    if (!isQboConnected) {
      return (
        <button
          onClick={handleConnectQBO}
          style={{
            fontSize: 'var(--font-size-body)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'white',
            backgroundColor: '#00C020',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            transition: 'var(--transition-default)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          Connect QuickBooks
        </button>
      );
    }

    return (
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
    );
  };

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
              {isInOrg && (
                <span style={{
                  fontSize: 'var(--font-size-small)',
                  color: 'var(--text-secondary)',
                  marginLeft: '8px',
                }}>
                  {organization?.name}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {renderQboButton()}
              <UserMenu onDisconnectQBO={() => {
                setIsQboConnected(false);
                setQboConnectionNeedsRefresh(false);
              }} />
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
        {loading ? (
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
                  width: '100%',
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
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '32px' }}>
                    {canManageTeam && (
                      <TabButton
                        id="team"
                        label="Team"
                        isActive={activeTab === 'team'}
                      />
                    )}
                    {canViewAudit && (
                      <TabButton
                        id="audit"
                        label="Activity"
                        isActive={activeTab === 'audit'}
                      />
                    )}
                    <TabButton
                      id="account"
                      label="Account"
                      count={cachedCategories.length}
                      isActive={activeTab === 'account'}
                    />
                  </div>
                </div>
             </div>

             {activeTab === 'account' ? (
                <AccountPage
                  categories={cachedCategories}
                  rules={categoryRules}
                  isQboConnected={isQboConnected}
                  onSyncCategories={handleSyncCategories}
                  onRulesChanged={refreshRules}
                  isSyncing={isSyncingCategories}
                />
             ) : activeTab === 'team' && canManageTeam ? (
                <TeamManagement />
             ) : activeTab === 'audit' && canViewAudit ? (
                <AuditLog />
             ) : (
               <>
                 {activeTab === 'new' && (
                    <ReceiptUpload onUploadComplete={handleUploadComplete} />
                 )}
                 <div style={{ marginTop: '16px' }}>
                    <ReceiptList
                      receipts={getCurrentList()}
                      onSelect={handleSelectReceipt}
                      showUploadedBy={isInOrg && !isEmployee}
                    />
                 </div>
               </>
             )}
          </div>
        ) : (
          selectedReceipt && (
            <ReceiptReview
              receipt={selectedReceipt}
              onUpdate={handleUpdateReceipt}
              onBack={handleBackToList}
              onQboConnectionError={handleQboConnectionError}
              cachedCategories={cachedCategories}
              onRuleCreated={refreshRules}
              canPublish={canPublish}
              isInOrg={isInOrg}
            />
          )
        )}
      </main>
    </div>
  );
};

export default App;
