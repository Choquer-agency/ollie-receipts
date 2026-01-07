import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, AlertCircle, Calendar, Link as LinkIcon, Calculator, Percent, Info } from 'lucide-react';
import { Receipt, ReceiptStatus, QuickBooksAccount, PaymentAccount, TaxTreatment } from '../types';
import { fetchAccounts, fetchPaymentAccounts, publishReceipt } from '../services/qboService';
import StatusBadge from './StatusBadge';

interface ReceiptReviewProps {
  receipt: Receipt;
  onUpdate: (updated: Receipt) => void;
  onBack: () => void;
}

interface InputGroupProps {
  label: string;
  children?: React.ReactNode;
  required?: boolean;
}

const InputGroup: React.FC<InputGroupProps> = ({ label, children, required = false }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    gap: '16px',
    alignItems: 'center',
    marginBottom: '16px',
  }}>
    <label style={{
      fontSize: 'var(--font-size-small)',
      fontWeight: 'var(--font-weight-semibold)',
      color: 'var(--text-secondary)',
    }}>
      {label} {required && <span style={{ color: 'var(--status-error-text)' }}>*</span>}
    </label>
    <div style={{ width: '100%' }}>{children}</div>
  </div>
);

const TAX_RATES = [
  { label: 'Manual / Extracted', value: -1 },
  { label: 'No Tax (0%)', value: 0 },
  { label: 'GST (5%)', value: 0.05 },
  { label: 'HST Ontario (13%)', value: 0.13 },
  { label: 'HST BC/Atlantic (15%)', value: 0.15 },
  { label: 'PST/GST (12%)', value: 0.12 },
];

const ReceiptReview: React.FC<ReceiptReviewProps> = ({ receipt, onUpdate, onBack }) => {
  const [formData, setFormData] = useState<Partial<Receipt>>({ 
    document_type: 'Receipt',
    publish_target: 'Expense',
    is_paid: true,
    currency: 'CAD',
    tax_treatment: 'Inclusive',
    tax_rate: (receipt.tax && receipt.tax > 0) ? -1 : 0,
    ...receipt 
  });
  
  const [expenseAccounts, setExpenseAccounts] = useState<QuickBooksAccount[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAccounts(), fetchPaymentAccounts()]).then(([expenses, payments]) => {
      setExpenseAccounts(expenses);
      setPaymentAccounts(payments);
      
      if (!formData.payment_account_id && payments.length > 0) {
        setFormData(prev => ({ ...prev, payment_account_id: payments.find(p => p.type === 'Credit Card')?.id || payments[0].id }));
      }
    });
  }, []);

  const calculateTax = useCallback((total: number, rate: number, treatment: TaxTreatment) => {
    if (rate <= 0 || treatment === 'No Tax') return 0;
    
    if (treatment === 'Inclusive') {
      return total - (total / (1 + rate));
    } else {
      return total * rate;
    }
  }, []);

  const getTaxCalculationText = useCallback(() => {
    // Safely convert to numbers, default to 0 if invalid
    const total = typeof formData.total === 'number' && !isNaN(formData.total) ? formData.total : 0;
    const rate = typeof formData.tax_rate === 'number' && !isNaN(formData.tax_rate) ? formData.tax_rate : 0;
    const tax = typeof formData.tax === 'number' && !isNaN(formData.tax) ? formData.tax : 0;
    const treatment = formData.tax_treatment || 'Inclusive';
    
    // Don't show calculation if rate is not set, is manual, or No Tax
    if (rate === -1 || rate === 0 || total === 0) return null;
    
    const ratePercent = (rate * 100).toFixed(rate * 100 === Math.floor(rate * 100) ? 0 : 1);
    const taxRateLabel = TAX_RATES.find(r => r.value === rate)?.label.split('(')[0].trim() || 'Tax';
    
    if (treatment === 'Inclusive') {
      const subtotal = total - tax;
      return `$${total.toFixed(2)} includes $${tax.toFixed(2)} ${taxRateLabel} (${ratePercent}%) → Subtotal: $${subtotal.toFixed(2)}`;
    } else {
      const newTotal = total + tax;
      return `$${total.toFixed(2)} + $${tax.toFixed(2)} ${taxRateLabel} (${ratePercent}%) → Total: $${newTotal.toFixed(2)}`;
    }
  }, [formData.total, formData.tax_rate, formData.tax, formData.tax_treatment]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let newValue: any = value;
    
    if (name === 'total' || name === 'tax' || name === 'tax_rate') {
      const parsed = parseFloat(value);
      newValue = isNaN(parsed) ? undefined : parsed;
    }

    setFormData(prev => {
      const updated = { ...prev, [name]: newValue };
      
      if (name === 'tax') {
        updated.tax_rate = -1;
      }

      if (name === 'tax_rate' && newValue !== -1 && newValue !== undefined) {
        const total = prev.total || 0;
        const rate = newValue;
        const treatment = prev.tax_treatment || 'Inclusive';
        updated.tax = parseFloat(calculateTax(total, rate, treatment).toFixed(2));
      }

      if (name === 'total' && prev.tax_rate !== undefined && prev.tax_rate !== -1 && newValue !== undefined) {
        const total = newValue;
        const rate = prev.tax_rate;
        const treatment = prev.tax_treatment || 'Inclusive';
        updated.tax = parseFloat(calculateTax(total, rate, treatment).toFixed(2));
      }

      if (name === 'tax_treatment' && prev.tax_rate !== undefined && prev.tax_rate !== -1) {
        const total = prev.total || 0;
        const rate = prev.tax_rate;
        const treatment = newValue as TaxTreatment;
        updated.tax = parseFloat(calculateTax(total, rate, treatment).toFixed(2));
      }
      
      return updated;
    });
  };

  const handleTogglePaid = (checked: boolean) => {
     setFormData(prev => ({ ...prev, is_paid: checked }));
  };

  const handleSave = () => {
    // Clean up data before sending to API
    const updatedData = {
      ...receipt,
      ...formData,
      status: ReceiptStatus.REVIEWED,
      // Ensure transaction_date is either a valid yyyy-MM-dd string or undefined (not empty string)
      transaction_date: formData.transaction_date && formData.transaction_date.trim() !== '' 
        ? formData.transaction_date 
        : undefined,
    };
    
    onUpdate(updatedData as Receipt);
    onBack();
  };

  const handlePublish = async () => {
    if (!formData.qb_account_id) {
      setError("Please select a Category (Expense Account).");
      return;
    }
    
    setIsPublishing(true);
    setError(null);

    try {
      const qbTxnId = await publishReceipt(receipt, formData.qb_account_id);
      onUpdate({
        ...receipt,
        ...formData,
        qb_transaction_id: qbTxnId,
        status: ReceiptStatus.PUBLISHED
      } as Receipt);
      onBack();
    } catch (err) {
      setError("Failed to publish to QuickBooks. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  const inputBaseStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--spacing-2)',
    backgroundColor: 'var(--background-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-body)',
    fontFamily: 'var(--font-body)',
    color: 'var(--text-primary)',
    outline: 'none',
  };

  const buttonBaseStyle: React.CSSProperties = {
    padding: 'var(--button-padding-sm)',
    fontSize: 'var(--font-size-small)',
    fontWeight: 'var(--font-weight-semibold)',
    fontFamily: 'var(--font-body)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'var(--transition-default)',
    border: 'none',
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 7rem)',
      backgroundColor: 'var(--background-elevated)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-raised)',
      overflow: 'hidden',
      border: '1px solid var(--border-default)',
    }}>
      
      {/* Header */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-default)',
        backgroundColor: 'var(--background-elevated)',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={onBack} 
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                transition: 'var(--transition-default)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <ArrowLeft size={20} />
            </button>
            <h2 style={{
              fontSize: 'var(--font-size-body)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--text-primary)',
              margin: 0,
            }}>
              {formData.vendor_name || 'Review Receipt'}
            </h2>
            <StatusBadge status={formData.status || ReceiptStatus.UPLOADED} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
                onClick={handleSave}
                style={{
                  ...buttonBaseStyle,
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--background-elevated)',
                  border: '1px solid var(--border-strong)',
                }}
            >
                Save
            </button>
            {receipt.status !== ReceiptStatus.PUBLISHED && (
                <button 
                    onClick={handlePublish}
                    disabled={isPublishing}
                    style={{
                      ...buttonBaseStyle,
                      color: 'white',
                      backgroundColor: 'var(--primary)',
                      opacity: isPublishing ? 0.7 : 1,
                    }}
                >
                    {isPublishing ? 'Publishing...' : 'Publish'}
                </button>
            )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'row',
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Left: Image Preview */}
        <div style={{
          width: '50%',
          height: '100%',
          backgroundColor: '#E8E6E0',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          borderRight: '1px solid var(--border-default)',
        }}>
           <div style={{
             flex: 1,
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             padding: '32px',
             overflow: 'hidden',
           }}>
              <img 
                src={receipt.image_url} 
                alt="Receipt" 
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  boxShadow: 'var(--shadow-overlay)',
                }}
              />
           </div>
           <div style={{
             position: 'absolute',
             bottom: '16px',
             left: 0,
             right: 0,
             display: 'flex',
             justifyContent: 'center',
             gap: '8px',
             opacity: 0.5,
             transition: 'var(--transition-default)',
           }}>
               <div style={{
                 backgroundColor: 'rgba(0,0,0,0.5)',
                 color: 'white',
                 padding: '4px 12px',
                 borderRadius: 'var(--radius-md)',
                 fontSize: 'var(--font-size-small)',
                 backdropFilter: 'blur(8px)',
               }}>
                 Page 1 of 1
               </div>
           </div>
        </div>

        {/* Right: Form */}
        <div style={{
          width: '50%',
          height: '100%',
          backgroundColor: 'var(--background-elevated)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}>
          <div style={{
            padding: '24px',
            paddingBottom: '80px',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
          }}>
            {error && (
              <div style={{
                padding: '12px',
                marginBottom: '16px',
                backgroundColor: 'var(--status-error-bg)',
                color: 'var(--status-error-text)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-body)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: '1px solid var(--status-error-text)',
              }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {/* Item Details Section */}
            <div>
              <h3 style={{
                fontSize: '0.9rem',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-heading)',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '4px',
              }}>
                Item Details
              </h3>
              
              <InputGroup label="Item ID">
                 <input 
                    disabled 
                    value={receipt.id.slice(0, 12)} 
                    style={{
                      ...inputBaseStyle,
                      backgroundColor: 'var(--background-muted)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                 />
              </InputGroup>

              <InputGroup label="Type">
                 <select 
                    name="document_type"
                    value={formData.document_type}
                    onChange={handleChange}
                    style={inputBaseStyle}
                 >
                    <option value="Receipt">Receipt</option>
                    <option value="Invoice">Invoice</option>
                    <option value="Credit Note">Credit Note</option>
                 </select>
              </InputGroup>

              <InputGroup label="Date">
                 <div style={{ position: 'relative' }}>
                    <input 
                        type="date" 
                        name="transaction_date"
                        value={formData.transaction_date || ''}
                        onChange={handleChange}
                        style={{
                          ...inputBaseStyle,
                          paddingLeft: '36px',
                        }}
                    />
                    <Calendar style={{
                      position: 'absolute',
                      left: '10px',
                      top: '10px',
                      color: 'var(--text-tertiary)',
                    }} size={16} />
                 </div>
              </InputGroup>

              <InputGroup label="Supplier">
                 <input 
                    type="text" 
                    name="vendor_name"
                    value={formData.vendor_name || ''}
                    onChange={handleChange}
                    style={{
                      ...inputBaseStyle,
                      fontWeight: 'var(--font-weight-semibold)',
                    }}
                 />
              </InputGroup>

              <InputGroup label="Category" required>
                 <div style={{ position: 'relative' }}>
                     <select 
                        name="qb_account_id"
                        value={formData.qb_account_id || ''}
                        onChange={handleChange}
                        style={inputBaseStyle}
                     >
                        <option value="">Select category...</option>
                        {expenseAccounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                     </select>
                     {formData.suggested_category && !formData.qb_account_id && (
                        <div style={{
                          position: 'absolute',
                          right: '32px',
                          top: '8px',
                          fontSize: 'var(--font-size-tiny)',
                          backgroundColor: 'var(--background-muted)',
                          color: 'var(--primary)',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--primary)',
                        }}>
                           AI: {formData.suggested_category.slice(0, 15)}...
                        </div>
                     )}
                 </div>
              </InputGroup>

              <InputGroup label="Description">
                 <textarea 
                    name="description"
                    value={formData.description || ''}
                    onChange={handleChange}
                    rows={2}
                    style={{
                      ...inputBaseStyle,
                      resize: 'none',
                    }}
                    placeholder="Add a description..."
                 />
              </InputGroup>
            </div>

            {/* Amount Section */}
            <div>
              <h3 style={{
                fontSize: '0.9rem',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-heading)',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '4px',
              }}>
                Amount
              </h3>
              
              <InputGroup label="Currency">
                 <select 
                    name="currency"
                    value={formData.currency || 'CAD'}
                    onChange={handleChange}
                    style={inputBaseStyle}
                 >
                    <option value="CAD">CAD — Canadian Dollar</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                 </select>
              </InputGroup>

              <InputGroup label="Total Amount">
                 <div style={{ position: 'relative' }}>
                    <input 
                        type="number"
                        step="0.01"
                        name="total"
                        value={formData.total || ''}
                        onChange={handleChange}
                        style={{
                          ...inputBaseStyle,
                          paddingLeft: '36px',
                          fontWeight: 'var(--font-weight-bold)',
                        }}
                    />
                    <span style={{
                      position: 'absolute',
                      left: '12px',
                      top: '8px',
                      color: 'var(--text-tertiary)',
                      fontSize: 'var(--font-size-body)',
                    }}>$</span>
                 </div>
              </InputGroup>

              <div style={{
                backgroundColor: 'var(--background-muted)',
                padding: '20px',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-default)',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px',
                }}>
                   <Calculator size={14} style={{ color: 'var(--primary)' }} />
                   <h4 style={{
                     fontSize: 'var(--font-size-small)',
                     fontWeight: 'var(--font-weight-bold)',
                     color: 'var(--primary)',
                     textTransform: 'uppercase',
                     letterSpacing: '0.1em',
                   }}>Tax Breakdown</h4>
                </div>

                <InputGroup label="Does the total already include tax?">
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                         onClick={() => handleChange({ target: { name: 'tax_treatment', value: 'Inclusive' }} as any)}
                         style={{
                           flex: 1,
                           padding: 'var(--spacing-2)',
                           borderRadius: 'var(--radius-md)',
                           fontSize: 'var(--font-size-small)',
                           fontWeight: 'var(--font-weight-semibold)',
                           border: '1px solid',
                           borderColor: formData.tax_treatment === 'Inclusive' ? 'var(--primary)' : 'var(--border-default)',
                           backgroundColor: formData.tax_treatment === 'Inclusive' ? 'var(--primary)' : 'var(--background-elevated)',
                           color: formData.tax_treatment === 'Inclusive' ? 'white' : 'var(--text-secondary)',
                           cursor: 'pointer',
                           transition: 'var(--transition-default)',
                           boxShadow: formData.tax_treatment === 'Inclusive' ? 'var(--shadow-raised)' : 'none',
                         }}
                      >
                         Yes
                      </button>
                      <button 
                         onClick={() => handleChange({ target: { name: 'tax_treatment', value: 'Exclusive' }} as any)}
                         style={{
                           flex: 1,
                           padding: 'var(--spacing-2)',
                           borderRadius: 'var(--radius-md)',
                           fontSize: 'var(--font-size-small)',
                           fontWeight: 'var(--font-weight-semibold)',
                           border: '1px solid',
                           borderColor: formData.tax_treatment === 'Exclusive' ? 'var(--primary)' : 'var(--border-default)',
                           backgroundColor: formData.tax_treatment === 'Exclusive' ? 'var(--primary)' : 'var(--background-elevated)',
                           color: formData.tax_treatment === 'Exclusive' ? 'white' : 'var(--text-secondary)',
                           cursor: 'pointer',
                           transition: 'var(--transition-default)',
                           boxShadow: formData.tax_treatment === 'Exclusive' ? 'var(--shadow-raised)' : 'none',
                         }}
                      >
                         No
                      </button>
                   </div>
                </InputGroup>

                <InputGroup label="Tax Rate">
                   <div style={{ position: 'relative' }}>
                      <select 
                        name="tax_rate"
                        value={formData.tax_rate}
                        onChange={handleChange}
                        style={{
                          ...inputBaseStyle,
                          fontWeight: 'var(--font-weight-semibold)',
                        }}
                      >
                        {TAX_RATES.map(rate => (
                          <option key={rate.label} value={rate.value}>{rate.label}</option>
                        ))}
                      </select>
                      <Percent style={{
                        position: 'absolute',
                        right: '12px',
                        top: '10px',
                        color: 'var(--text-tertiary)',
                        pointerEvents: 'none',
                      }} size={14} />
                   </div>
                </InputGroup>

                <InputGroup label="Tax Amount">
                   <div>
                      <div style={{ position: 'relative' }}>
                        <input 
                          type="number"
                          step="0.01"
                          name="tax"
                          value={formData.tax || ''}
                          onChange={handleChange}
                          style={{
                            ...inputBaseStyle,
                            paddingLeft: '36px',
                            fontWeight: 'var(--font-weight-semibold)',
                          }}
                          placeholder="0.00"
                        />
                        <span style={{
                          position: 'absolute',
                          left: '12px',
                          top: '8px',
                          color: 'var(--text-tertiary)',
                          fontSize: 'var(--font-size-body)',
                        }}>$</span>
                      </div>
                      {getTaxCalculationText() && (
                        <p style={{
                          fontSize: 'var(--font-size-tiny)',
                          color: 'var(--text-tertiary)',
                          marginTop: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                           <Info size={10} /> {getTaxCalculationText()}
                        </p>
                      )}
                   </div>
                </InputGroup>
              </div>
            </div>

            {/* Payment Section */}
            <div>
              <h3 style={{
                fontSize: '0.9rem',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-heading)',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '4px',
              }}>
                Payment
              </h3>
              
              <InputGroup label="Paid">
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                        onClick={() => handleTogglePaid(true)}
                        style={{
                          padding: '6px 16px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--font-size-small)',
                          fontWeight: 'var(--font-weight-semibold)',
                          border: '1px solid',
                          borderColor: formData.is_paid ? 'var(--primary)' : 'var(--border-strong)',
                          backgroundColor: formData.is_paid ? 'var(--primary)' : 'var(--background-elevated)',
                          color: formData.is_paid ? 'white' : 'var(--text-primary)',
                          cursor: 'pointer',
                          transition: 'var(--transition-default)',
                        }}
                    >
                        Yes
                    </button>
                    <button 
                        onClick={() => handleTogglePaid(false)}
                        style={{
                          padding: '6px 16px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--font-size-small)',
                          fontWeight: 'var(--font-weight-semibold)',
                          border: '1px solid',
                          borderColor: !formData.is_paid ? 'var(--primary)' : 'var(--border-strong)',
                          backgroundColor: !formData.is_paid ? 'var(--primary)' : 'var(--background-elevated)',
                          color: !formData.is_paid ? 'white' : 'var(--text-primary)',
                          cursor: 'pointer',
                          transition: 'var(--transition-default)',
                        }}
                    >
                        No
                    </button>
                 </div>
              </InputGroup>

              {formData.is_paid && (
                  <InputGroup label="Payment method">
                    <div style={{ position: 'relative' }}>
                        <select 
                            name="payment_account_id"
                            value={formData.payment_account_id || ''}
                            onChange={handleChange}
                            style={inputBaseStyle}
                        >
                            <option value="">Select payment method...</option>
                            {paymentAccounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                        <LinkIcon style={{
                          position: 'absolute',
                          right: '12px',
                          top: '10px',
                          color: 'var(--text-tertiary)',
                          pointerEvents: 'none',
                        }} size={14} />
                    </div>
                  </InputGroup>
              )}

              <InputGroup label="Publish to">
                 <select 
                    name="publish_target"
                    value={formData.publish_target}
                    onChange={handleChange}
                    style={inputBaseStyle}
                 >
                    <option value="Expense">Expense (Credit Card / Cash)</option>
                    <option value="Bill">Bill (Accounts Payable)</option>
                 </select>
              </InputGroup>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptReview;

