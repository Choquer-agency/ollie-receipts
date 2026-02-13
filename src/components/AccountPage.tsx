import React, { useMemo, useState } from 'react';
import { RefreshCw, FolderOpen, AlertCircle, Zap, Trash2, ArrowRight, BarChart3 } from 'lucide-react';
import { CachedCategory, CategoryRule } from '../types';
import { categoryRulesApi } from '../services/apiService';

interface AccountPageProps {
  categories: CachedCategory[];
  rules: CategoryRule[];
  isQboConnected: boolean;
  onSyncCategories: () => Promise<void>;
  onRulesChanged: () => Promise<void>;
  isSyncing: boolean;
}

const AccountPage: React.FC<AccountPageProps> = ({
  categories,
  rules,
  isQboConnected,
  onSyncCategories,
  onRulesChanged,
  isSyncing,
}) => {
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const groups: Record<string, CachedCategory[]> = {};
    categories.forEach(cat => {
      const key = cat.subType || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(cat);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [categories]);

  // Build a map of category QB account ID → rules for that category
  const rulesByCategory = useMemo(() => {
    const map: Record<string, CategoryRule[]> = {};
    rules.forEach(rule => {
      if (!map[rule.qbAccountId]) map[rule.qbAccountId] = [];
      map[rule.qbAccountId].push(rule);
    });
    return map;
  }, [rules]);

  const activeRules = useMemo(() => rules.filter(r => r.isActive), [rules]);

  const analytics = useMemo(() => {
    const totalTimesApplied = rules.reduce((sum, r) => sum + r.timesApplied, 0);
    const topRules = [...rules]
      .filter(r => r.timesApplied > 0)
      .sort((a, b) => b.timesApplied - a.timesApplied)
      .slice(0, 5);
    const categoriesWithRules = new Set(rules.map(r => r.qbAccountId));
    const uncoveredCategories = categories.filter(c => !categoriesWithRules.has(c.id));
    return { totalTimesApplied, topRules, uncoveredCategories };
  }, [rules, categories]);

  const lastSynced = useMemo(() => {
    if (categories.length === 0) return null;
    const mostRecent = categories.reduce((latest, cat) => {
      const d = new Date(cat.lastSynced);
      return d > latest ? d : latest;
    }, new Date(0));
    return mostRecent.toLocaleString();
  }, [categories]);

  const formatSubType = (subType: string): string => {
    if (subType === 'Other') return 'Other';
    return subType
      .replace(/([A-Z])/g, ' $1')
      .replace(/^\s/, '')
      .replace(/\s(And|Or)\s/gi, () => ` & `);
  };

  const handleSync = async () => {
    setSyncResult(null);
    try {
      await onSyncCategories();
      setSyncResult('Categories synced successfully');
    } catch {
      setSyncResult('Failed to sync categories');
    }
    setTimeout(() => setSyncResult(null), 3000);
  };

  const handleDeleteRule = async (ruleId: string) => {
    setDeletingRuleId(ruleId);
    try {
      await categoryRulesApi.delete(ruleId);
      await onRulesChanged();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    } finally {
      setDeletingRuleId(null);
    }
  };

  const handleToggleRule = async (ruleId: string, currentActive: boolean) => {
    try {
      await categoryRulesApi.update(ruleId, { isActive: !currentActive });
      await onRulesChanged();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  if (!isQboConnected) {
    return (
      <div style={{
        backgroundColor: 'var(--background-elevated)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-raised)',
        padding: '48px',
        textAlign: 'center',
      }}>
        <AlertCircle size={32} style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }} />
        <h2 style={{
          fontSize: 'var(--font-size-h2)',
          fontWeight: 'var(--font-weight-semibold)',
          fontFamily: 'var(--font-heading)',
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}>
          Connect QuickBooks
        </h2>
        <p style={{
          fontSize: 'var(--font-size-body)',
          color: 'var(--text-secondary)',
        }}>
          Connect your QuickBooks account to sync and manage categories.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Rules Section */}
      <div style={{
        backgroundColor: 'var(--background-elevated)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-raised)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Zap size={20} style={{ color: 'var(--primary)' }} />
            <div>
              <h2 style={{
                fontSize: 'var(--font-size-h3)',
                fontWeight: 'var(--font-weight-semibold)',
                fontFamily: 'var(--font-heading)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                Category rules
              </h2>
              <p style={{
                fontSize: 'var(--font-size-small)',
                color: 'var(--text-tertiary)',
                margin: '2px 0 0 0',
              }}>
                Auto-categorize receipts based on vendor name
              </p>
            </div>
          </div>
          <span style={{
            fontSize: 'var(--font-size-small)',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--background-muted)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-md)',
          }}>
            {activeRules.length} active
          </span>
        </div>

        {rules.length === 0 ? (
          <div style={{
            padding: '32px 24px',
            textAlign: 'center',
          }}>
            <p style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--text-secondary)',
              marginBottom: '4px',
            }}>
              No rules yet
            </p>
            <p style={{
              fontSize: 'var(--font-size-small)',
              color: 'var(--text-tertiary)',
            }}>
              When you publish a receipt, you'll be prompted to create a rule for that vendor.
            </p>
          </div>
        ) : (
          <div>
            {rules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 24px',
                  borderBottom: '1px solid var(--border-default)',
                  opacity: rule.isActive ? 1 : 0.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flex: 1,
                    minWidth: 0,
                  }}>
                    <span style={{
                      fontSize: 'var(--font-size-body)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {rule.vendorPattern}
                    </span>
                    <ArrowRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    <span style={{
                      fontSize: 'var(--font-size-body)',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {rule.categoryName}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {rule.matchType === 'contains' && (
                      <span style={{
                        fontSize: 'var(--font-size-tiny)',
                        color: 'var(--text-tertiary)',
                        backgroundColor: 'var(--background-muted)',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-md)',
                      }}>
                        contains
                      </span>
                    )}
                    {rule.timesApplied > 0 && (
                      <span style={{
                        fontSize: 'var(--font-size-tiny)',
                        color: 'var(--text-tertiary)',
                      }}>
                        used {rule.timesApplied}x
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }}>
                  <button
                    onClick={() => handleToggleRule(rule.id, rule.isActive)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px 8px',
                      fontSize: 'var(--font-size-tiny)',
                      color: rule.isActive ? 'var(--text-tertiary)' : 'var(--primary)',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-md)',
                      transition: 'var(--transition-default)',
                    }}
                  >
                    {rule.isActive ? 'Pause' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    disabled={deletingRuleId === rule.id}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'var(--transition-default)',
                      opacity: deletingRuleId === rule.id ? 0.3 : 1,
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analytics Section */}
      {rules.length > 0 && (
        <div style={{
          backgroundColor: 'var(--background-elevated)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-raised)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-default)',
          }}>
            <BarChart3 size={20} style={{ color: 'var(--primary)' }} />
            <h2 style={{
              fontSize: 'var(--font-size-h3)',
              fontWeight: 'var(--font-weight-semibold)',
              fontFamily: 'var(--font-heading)',
              color: 'var(--text-primary)',
              margin: 0,
            }}>
              Rule insights
            </h2>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', gap: '32px' }}>
            <div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-heading)',
              }}>
                {activeRules.length}
              </div>
              <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-tertiary)' }}>
                Active rules
              </div>
            </div>
            <div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-heading)',
              }}>
                {analytics.totalTimesApplied}
              </div>
              <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-tertiary)' }}>
                Times applied
              </div>
            </div>
            <div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-heading)',
              }}>
                {analytics.uncoveredCategories.length}
              </div>
              <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-tertiary)' }}>
                Categories without rules
              </div>
            </div>
          </div>

          {analytics.topRules.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-default)' }}>
              <div style={{
                padding: '10px 24px',
                backgroundColor: 'var(--background-muted)',
                borderBottom: '1px solid var(--border-default)',
                fontSize: 'var(--font-size-small)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--text-secondary)',
              }}>
                Most used rules
              </div>
              {analytics.topRules.map(rule => (
                <div
                  key={rule.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 24px',
                    borderBottom: '1px solid var(--border-default)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: 'var(--font-size-body)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>
                      {rule.vendorPattern}
                    </span>
                    <ArrowRight size={12} style={{ color: 'var(--text-tertiary)' }} />
                    <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--text-secondary)' }}>
                      {rule.categoryName}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 'var(--font-size-small)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--primary)',
                  }}>
                    {rule.timesApplied}x
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Categories Section */}
      <div style={{
        backgroundColor: 'var(--background-elevated)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-raised)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FolderOpen size={20} style={{ color: 'var(--primary)' }} />
            <div>
              <h2 style={{
                fontSize: 'var(--font-size-h3)',
                fontWeight: 'var(--font-weight-semibold)',
                fontFamily: 'var(--font-heading)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                Categories
              </h2>
              {lastSynced && (
                <p style={{
                  fontSize: 'var(--font-size-small)',
                  color: 'var(--text-tertiary)',
                  margin: '2px 0 0 0',
                }}>
                  Last synced: {lastSynced}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {syncResult && (
              <span style={{
                fontSize: 'var(--font-size-small)',
                color: syncResult.includes('Failed') ? 'var(--status-error-text)' : 'var(--status-success-text)',
              }}>
                {syncResult}
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                height: '32px',
                fontSize: 'var(--font-size-small)',
                fontWeight: 'var(--font-weight-semibold)',
                fontFamily: 'var(--font-body)',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--background-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                opacity: isSyncing ? 0.6 : 1,
                transition: 'var(--transition-default)',
              }}
            >
              <RefreshCw
                size={14}
                style={{
                  animation: isSyncing ? 'spin 1s linear infinite' : 'none',
                }}
              />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>

        {/* Category count */}
        <div style={{
          padding: '12px 24px',
          backgroundColor: 'var(--background-muted)',
          borderBottom: '1px solid var(--border-default)',
          fontSize: 'var(--font-size-small)',
          color: 'var(--text-secondary)',
        }}>
          {categories.length} expense {categories.length === 1 ? 'category' : 'categories'} from QuickBooks
        </div>

        {/* Categories list */}
        {categories.length === 0 ? (
          <div style={{
            padding: '48px',
            textAlign: 'center',
          }}>
            <p style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
            }}>
              No categories cached yet.
            </p>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              style={{
                padding: '8px 20px',
                height: '40px',
                fontSize: 'var(--font-size-body)',
                fontWeight: 'var(--font-weight-semibold)',
                fontFamily: 'var(--font-body)',
                color: 'white',
                backgroundColor: 'var(--primary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'var(--transition-default)',
              }}
            >
              Sync from QuickBooks
            </button>
          </div>
        ) : (
          <div>
            {grouped.map(([subType, cats]) => (
              <div key={subType}>
                {/* Group header */}
                <div style={{
                  padding: '10px 24px',
                  backgroundColor: 'var(--background)',
                  borderBottom: '1px solid var(--border-default)',
                }}>
                  <span style={{
                    fontSize: 'var(--font-size-small)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--text-secondary)',
                  }}>
                    {formatSubType(subType)}
                  </span>
                  <span style={{
                    fontSize: 'var(--font-size-small)',
                    color: 'var(--text-tertiary)',
                    marginLeft: '8px',
                  }}>
                    ({cats.length})
                  </span>
                </div>

                {/* Category rows */}
                {cats.map((cat) => {
                  const catRules = rulesByCategory[cat.id] || [];
                  return (
                    <div key={cat.id}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 24px',
                          borderBottom: catRules.length > 0 ? 'none' : '1px solid var(--border-default)',
                          transition: 'var(--transition-default)',
                        }}
                      >
                        <span style={{
                          fontSize: 'var(--font-size-body)',
                          color: 'var(--text-primary)',
                        }}>
                          {cat.displayName}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {catRules.length > 0 && (
                            <span style={{
                              fontSize: 'var(--font-size-tiny)',
                              color: 'var(--primary)',
                              backgroundColor: 'var(--background-muted)',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--primary)',
                            }}>
                              {catRules.length} {catRules.length === 1 ? 'rule' : 'rules'}
                            </span>
                          )}
                          <span style={{
                            fontSize: 'var(--font-size-tiny)',
                            color: 'var(--text-tertiary)',
                            backgroundColor: 'var(--background-muted)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-md)',
                          }}>
                            {cat.id}
                          </span>
                        </div>
                      </div>
                      {/* Show associated vendor rules inline */}
                      {catRules.map((rule) => (
                        <div
                          key={rule.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 24px 6px 48px',
                            borderBottom: '1px solid var(--border-default)',
                            backgroundColor: 'var(--background)',
                          }}
                        >
                          <span style={{
                            fontSize: 'var(--font-size-small)',
                            color: 'var(--text-secondary)',
                          }}>
                            {rule.matchType === 'contains' ? 'Contains' : ''} "{rule.vendorPattern}"
                          </span>
                          {rule.timesApplied > 0 && (
                            <span style={{
                              fontSize: 'var(--font-size-tiny)',
                              color: 'var(--text-tertiary)',
                            }}>
                              {rule.timesApplied}x
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spin animation for sync icon */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AccountPage;
