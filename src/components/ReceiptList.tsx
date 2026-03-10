import React, { useState } from 'react';
import { Receipt, ReceiptStatus } from '../types';
import StatusBadge from './StatusBadge';
import { FileText, Square, CheckSquare, Trash2 } from 'lucide-react';

interface ReceiptListProps {
  receipts: Receipt[];
  onSelect: (receipt: Receipt) => void;
  onDeleteMultiple?: (ids: string[]) => Promise<void>;
}

const ReceiptList: React.FC<ReceiptListProps> = ({ receipts, onSelect, onDeleteMultiple }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const formatCurrency = (amount?: number | null) => {
    if (amount === undefined || amount === null || isNaN(Number(amount))) return '--';
    return `CAD ${Number(amount).toFixed(2)}`;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === receipts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(receipts.map(r => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!onDeleteMultiple || selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      await onDeleteMultiple(Array.from(selectedIds));
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    } catch {
      // Error handling is done in parent
    } finally {
      setIsDeleting(false);
    }
  };

  const allSelected = receipts.length > 0 && selectedIds.size === receipts.length;

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
      {/* Bulk action bar */}
      {selectedIds.size > 0 && onDeleteMultiple && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 24px',
          backgroundColor: 'var(--background-muted)',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <span style={{
            fontSize: 'var(--font-size-small)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--text-secondary)',
          }}>
            {selectedIds.size} {selectedIds.size === 1 ? 'receipt' : 'receipts'} selected
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {showDeleteConfirm ? (
              <>
                <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                  Delete {selectedIds.size} {selectedIds.size === 1 ? 'receipt' : 'receipts'}?
                </span>
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  style={{
                    padding: '4px 12px',
                    fontSize: 'var(--font-size-small)',
                    fontWeight: 'var(--font-weight-semibold)',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    color: 'white',
                    backgroundColor: 'var(--status-error-text)',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    opacity: isDeleting ? 0.7 : 1,
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    padding: '4px 12px',
                    fontSize: 'var(--font-size-small)',
                    fontWeight: 'var(--font-weight-semibold)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  padding: '4px 12px',
                  fontSize: 'var(--font-size-small)',
                  fontWeight: 'var(--font-weight-semibold)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--status-error-text)',
                  color: 'var(--status-error-text)',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Trash2 size={14} />
                Delete
              </button>
            )}
          </div>
        </div>
      )}

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
            <div
              style={{ width: '40px', cursor: onDeleteMultiple ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '12px' }}
              onClick={(e) => {
                if (!onDeleteMultiple) return;
                e.stopPropagation();
                toggleSelectAll();
              }}
            >
              <div style={{ width: '8px' }}></div>
              {allSelected ? (
                <CheckSquare size={16} style={{ color: 'var(--primary)' }} />
              ) : (
                <Square size={16} style={{ color: 'var(--border-default)' }} />
              )}
            </div>
            <div style={{ width: '128px' }}>Status</div>
            <div style={{ width: '128px' }}>Date</div>
            <div style={{ flex: 1 }}>Supplier</div>
            <div style={{ width: '200px' }}>Category</div>
            <div style={{ width: '128px', textAlign: 'right' }}>Total</div>
            <div style={{ width: '96px', textAlign: 'right' }}>Tax</div>
            <div style={{ width: '128px' }}></div>
          </div>

          <div>
            {sortedReceipts.map((receipt) => {
              const isReady = receipt.status === ReceiptStatus.REVIEWED;
              const isSelected = selectedIds.has(receipt.id);

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
                    backgroundColor: isSelected ? 'var(--background-muted)' : 'var(--background-elevated)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--background-muted)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--background-elevated)';
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
                    <div
                      onClick={(e) => {
                        if (!onDeleteMultiple) return;
                        e.stopPropagation();
                        toggleSelect(receipt.id);
                      }}
                      style={{ cursor: onDeleteMultiple ? 'pointer' : 'default' }}
                    >
                      {isSelected ? (
                        <CheckSquare size={16} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <Square size={16} style={{ color: 'var(--border-default)' }} />
                      )}
                    </div>
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
                  <div style={{ width: '200px', flexShrink: 0, paddingRight: '16px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
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
                      }}>
                        {receipt.suggested_category || 'Uncategorized'}
                      </span>
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
