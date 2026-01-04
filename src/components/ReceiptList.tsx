import React from 'react';
import { Receipt, ReceiptStatus } from '../types';
import StatusBadge from './StatusBadge';
import { FileText, BrainCircuit, Square } from 'lucide-react';

interface ReceiptListProps {
  receipts: Receipt[];
  onSelect: (receipt: Receipt) => void;
}

const ReceiptList: React.FC<ReceiptListProps> = ({ receipts, onSelect }) => {
  // Sort: Needs Review (OCR_COMPLETE) first, then Reviewed, then date descending
  const sortedReceipts = [...receipts].sort((a, b) => {
    const score = (status: ReceiptStatus) => {
      if (status === ReceiptStatus.OCR_COMPLETE) return 3;
      if (status === ReceiptStatus.REVIEWED) return 2;
      if (status === ReceiptStatus.UPLOADED) return 1;
      return 0;
    };
    const scoreDiff = score(b.status) - score(a.status);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '--';
    return `CAD ${amount.toFixed(2)}`;
  };

  if (receipts.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        paddingTop: '64px',
        paddingBottom: '64px',
        backgroundColor: 'var(--background-elevated)',
        borderRadius: 'var(--radius-xl)',
        border: '2px dashed var(--border-default)',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'var(--background-muted)',
          marginBottom: 'var(--spacing-4)',
          color: 'var(--text-tertiary)',
        }}>
          <FileText size={32} />
        </div>
        <h3 style={{
          fontSize: 'var(--font-size-h3)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-heading)',
        }}>
          No receipts found
        </h3>
        <p style={{
          color: 'var(--text-secondary)',
          marginTop: 'var(--spacing-1)',
          fontSize: 'var(--font-size-body)',
        }}>
          This list is empty.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--background-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-raised)',
      overflow: 'hidden',
    }}>
      <div style={{ minWidth: '100%', overflowX: 'auto' }}>
        <div style={{ minWidth: '900px' }}>
          
          {/* Header Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-default)',
            backgroundColor: 'var(--background-muted)',
            fontSize: 'var(--font-size-small)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            <div style={{ width: '40px' }}></div> 
            <div style={{ width: '128px' }}>Status</div>
            <div style={{ width: '128px' }}>Date</div>
            <div style={{ flex: 1 }}>Supplier</div>
            <div style={{ width: '256px' }}>Category</div>
            <div style={{ width: '128px', textAlign: 'right' }}>Total</div>
            <div style={{ width: '96px', textAlign: 'right' }}>Tax</div>
            <div style={{ width: '128px' }}></div>
          </div>

          <div>
            {sortedReceipts.map((receipt) => {
              const isReady = receipt.status === ReceiptStatus.REVIEWED;
              
              return (
                <div 
                  key={receipt.id} 
                  onClick={() => onSelect(receipt)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--border-default)',
                    cursor: 'pointer',
                    transition: 'var(--transition-default)',
                    backgroundColor: 'var(--background-elevated)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--background-muted)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--background-elevated)';
                  }}
                >
                  {/* Left Icons */}
                  <div style={{
                    width: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: 'var(--text-tertiary)',
                    marginRight: '16px',
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--status-success-text)',
                    }}></div>
                    <Square size={16} style={{ color: 'var(--border-default)' }} />
                  </div>

                  {/* Status */}
                  <div style={{ width: '128px', flexShrink: 0 }}>
                    <StatusBadge status={receipt.status} />
                  </div>

                  {/* Date */}
                  <div style={{
                    width: '128px',
                    flexShrink: 0,
                    fontSize: 'var(--font-size-body)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--text-primary)',
                  }}>
                    {formatDate(receipt.transaction_date || receipt.created_at)}
                  </div>

                  {/* Supplier */}
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '16px' }}>
                    <p style={{
                      fontSize: 'var(--font-size-body)',
                      fontWeight: 'var(--font-weight-bold)',
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {receipt.vendor_name || 'Unknown Vendor'}
                    </p>
                  </div>

                  {/* Category */}
                  <div style={{ width: '256px', flexShrink: 0, paddingRight: '16px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--background-elevated)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-secondary)',
                      fontSize: 'var(--font-size-body)',
                      borderRadius: 'var(--radius-md)',
                      padding: '6px 12px',
                      boxShadow: 'var(--shadow-raised)',
                    }}>
                      <span style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginRight: '8px',
                      }}>
                        {receipt.suggested_category || 'Uncategorized'}
                      </span>
                      <BrainCircuit size={14} style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                  </div>

                  {/* Total */}
                  <div style={{
                    width: '128px',
                    flexShrink: 0,
                    textAlign: 'right',
                    fontSize: 'var(--font-size-body)',
                    fontWeight: 'var(--font-weight-bold)',
                    color: 'var(--text-primary)',
                  }}>
                    {formatCurrency(receipt.total)}
                  </div>

                  {/* Tax */}
                  <div style={{
                    width: '96px',
                    flexShrink: 0,
                    textAlign: 'right',
                    fontSize: 'var(--font-size-body)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--text-secondary)',
                  }}>
                    {formatCurrency(receipt.tax)}
                  </div>

                  {/* Action Button */}
                  <div style={{
                    width: '128px',
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    paddingLeft: '16px',
                  }}>
                    {receipt.status === ReceiptStatus.PUBLISHED ? (
                       <button 
                        disabled 
                        style={{
                          padding: '6px 16px',
                          fontSize: 'var(--font-size-small)',
                          fontWeight: 'var(--font-weight-bold)',
                          color: 'var(--text-tertiary)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--background-muted)',
                          cursor: 'not-allowed',
                        }}
                       >
                         Published
                       </button>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(receipt);
                        }}
                        style={{
                          padding: '6px 16px',
                          fontSize: 'var(--font-size-small)',
                          fontWeight: 'var(--font-weight-bold)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid',
                          borderColor: isReady ? 'var(--primary)' : 'var(--border-strong)',
                          backgroundColor: 'var(--background-elevated)',
                          color: isReady ? 'var(--primary)' : 'var(--text-tertiary)',
                          cursor: 'pointer',
                          transition: 'var(--transition-default)',
                          boxShadow: 'var(--shadow-raised)',
                        }}
                        onMouseEnter={(e) => {
                          if (isReady) {
                            e.currentTarget.style.backgroundColor = 'var(--background-muted)';
                          } else {
                            e.currentTarget.style.borderColor = 'var(--text-tertiary)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--background-elevated)';
                          e.currentTarget.style.borderColor = isReady ? 'var(--primary)' : 'var(--border-strong)';
                          e.currentTarget.style.color = isReady ? 'var(--primary)' : 'var(--text-tertiary)';
                        }}
                      >
                        Publish
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptList;

