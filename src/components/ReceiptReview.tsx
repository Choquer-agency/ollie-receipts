import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, AlertCircle, Calendar, Link as LinkIcon, Calculator, Percent, Info, Zap, X, Check } from 'lucide-react';
import { Receipt, ReceiptStatus, QuickBooksAccount, PaymentAccount, TaxTreatment, CachedCategory, OrgMember } from '../types';
import { fetchAccounts, fetchPaymentAccounts, publishReceipt, isQBOConnectionError } from '../services/qboService';
import { categoryRulesApi, orgApi } from '../services/apiService';
import StatusBadge from './StatusBadge';

interface ReceiptReviewProps {
  receipt: Receipt;
  onUpdate: (updated: Receipt) => void;
  onBack: () => void;
  onQboConnectionError?: () => void;
  cachedCategories?: CachedCategory[];
  onRuleCreated?: () => Promise<void>;
  canPublish?: boolean;
  isInOrg?: boolean;
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

// Helper function to convert ISO date to yyyy-MM-dd format for HTML date input
const formatDateForInput = (dateString: string | undefined): string => {
  if (!dateString) return '';
  try {
    // Convert ISO date (2026-01-06T00:00:00.000Z) to yyyy-MM-dd format
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const ReceiptReview: React.FC<ReceiptReviewProps> = ({ receipt, onUpdate, onBack, onQboConnectionError, cachedCategories, onRuleCreated, canPublish = true, isInOrg = false }) => {
  // Debug: Log the receipt prop to see what data we're receiving
  console.log('ReceiptReview received receipt:', receipt);
  console.log('Receipt total:', receipt.total, 'Receipt tax:', receipt.tax, 'Receipt tax_rate:', receipt.tax_rate);
  
  // Helper to safely parse numeric values that might come as strings
  const safeParseNumber = (value: any): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : parseFloat(String(value));
    return isNaN(parsed) ? undefined : parsed;
  };

  const [formData, setFormData] = useState<Partial<Receipt>>(() => {
    // Parse numeric fields to ensure they're numbers, not strings
    const total = safeParseNumber(receipt.total);
    const tax = safeParseNumber(receipt.tax);
    const subtotal = safeParseNumber(receipt.subtotal);
    
    return {
      // Start with receipt data
      ...receipt,
      // Ensure numeric fields are actually numbers
      total,
      tax,
      subtotal,
      // Override/set defaults only for fields that are null/undefined
      document_type: receipt.document_type || 'Receipt',
      publish_target: receipt.publish_target || 'Expense',
      is_paid: receipt.is_paid !== undefined ? receipt.is_paid : true,
      currency: receipt.currency || 'CAD',
      tax_treatment: receipt.tax_treatment || 'Inclusive',
      tax_rate: (tax && tax > 0) ? -1 : 0,
      // Override transaction_date with properly formatted version for HTML date input
      transaction_date: formatDateForInput(receipt.transaction_date)
    };
  });
  
  // Debug: Log formData after initialization
  console.log('formData initialized:', formData);
  console.log('formData total:', formData.total, 'formData tax:', formData.tax, 'formData tax_rate:', formData.tax_rate);
  
  const [expenseAccounts, setExpenseAccounts] = useState<QuickBooksAccount[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);

  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rulePrompt, setRulePrompt] = useState<{
    vendorName: string;
    categoryName: string;
    qbAccountId: string;
    receiptId: string;
    mode: 'create' | 'update';
    existingRuleId?: string;
  } | null>(null);
  const [isCreatingRule, setIsCreatingRule] = useState(false);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        // Use cached categories for expense accounts when available
        if (cachedCategories && cachedCategories.length > 0) {
          const mapped: QuickBooksAccount[] = cachedCategories.map(cat => ({
            id: cat.id,
            name: cat.name,
            type: cat.type,
          }));
          setExpenseAccounts(mapped);
        } else {
          const expenses = await fetchAccounts();
          setExpenseAccounts(expenses);
        }

        // Payment accounts still require a live fetch
        const payments = await fetchPaymentAccounts();
        setPaymentAccounts(payments);

        if (!formData.payment_account_id && payments.length > 0) {
          setFormData(prev => ({ ...prev, payment_account_id: payments.find(p => p.type === 'Credit Card')?.id || payments[0].id }));
        }
      } catch (err: any) {
        console.error('Error fetching QuickBooks accounts:', err);
        const isConnectionError = isQBOConnectionError(err);
        const is500 = err.response?.status === 500;
        if (isConnectionError || is500) {
          setError('QuickBooks connection expired. Please reconnect to continue.');
          if (onQboConnectionError) {
            onQboConnectionError();
          }
        } else {
          setError('Failed to load QuickBooks accounts. Please try again.');
        }
      }
    };
    loadAccounts();
  }, []);

  // Load org members for "Paid by" dropdown
  useEffect(() => {
    if (isInOrg) {
      orgApi.getMembers()
        .then(members => setOrgMembers(members))
        .catch(err => console.error('Error fetching org members:', err));
    }
  }, [isInOrg]);

  const calculateTax = useCallback((total: number, rate: number, treatment: TaxTreatment) => {
    if (rate <= 0 || treatment === 'No Tax') return 0;
    
    if (treatment === 'Inclusive') {
      return total - (total / (1 + rate));
    } else {
      return total * rate;
    }
  }, []);

  const getTaxCalculationText = useCallback(() => {
    // Debug: Check the raw values before conversion
    console.log('getTaxCalculationText - RAW formData.total:', formData.total, 'type:', typeof formData.total);
    console.log('getTaxCalculationText - RAW formData.tax_rate:', formData.tax_rate, 'type:', typeof formData.tax_rate);
    console.log('getTaxCalculationText - RAW formData.tax:', formData.tax, 'type:', typeof formData.tax);
    
    // Safely convert to numbers - handle both strings and numbers
    const parseToNumber = (value: any): number => {
      if (typeof value === 'number' && !isNaN(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };
    
    const total = parseToNumber(formData.total);
    const rate = parseToNumber(formData.tax_rate);
    const tax = parseToNumber(formData.tax);
    const treatment = formData.tax_treatment || 'Inclusive';
    
    // Debug logging
    console.log('getTaxCalculationText debug:', { total, rate, tax, treatment });
    
    // Don't show calculation if rate is not set, is manual, or No Tax
    if (rate === -1 || rate === 0 || total === 0) {
      console.log('Returning null because:', { rateIsNegativeOne: rate === -1, rateIsZero: rate === 0, totalIsZero: total === 0 });
      return null;
    }
    
    const ratePercent = (rate * 100).toFixed(rate * 100 === Math.floor(rate * 100) ? 0 : 1);
    const taxRateLabel = TAX_RATES.find(r => r.value === rate)?.label.split('(')[0].trim() || 'Tax';
    
    if (treatment === 'Inclusive') {
      const subtotal = total - tax;
      const result = `$${total.toFixed(2)} includes $${tax.toFixed(2)} ${taxRateLabel} (${ratePercent}%) → Subtotal: $${subtotal.toFixed(2)}`;
      console.log('Returning calculation text:', result);
      return result;
    } else {
      const newTotal = total + tax;
      const result = `$${total.toFixed(2)} + $${tax.toFixed(2)} ${taxRateLabel} (${ratePercent}%) → Total: $${newTotal.toFixed(2)}`;
      console.log('Returning calculation text:', result);
      return result;
    }
  }, [formData.total, formData.tax_rate, formData.tax, formData.tax_treatment]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let newValue: any = value;
    
    // Convert numeric fields to actual numbers, not strings
    if (name === 'total' || name === 'tax' || name === 'tax_rate' || name === 'subtotal') {
      newValue = safeParseNumber(value);
    }

    setFormData(prev => {
      const updated = { ...prev, [name]: newValue };
      
      if (name === 'tax') {
        updated.tax_rate = -1;
      }

      if (name === 'tax_rate' && newValue !== -1 && newValue !== undefined) {
        const total = safeParseNumber(prev.total) || 0;
        const rate = newValue;
        const treatment = prev.tax_treatment || 'Inclusive';
        updated.tax = safeParseNumber(calculateTax(total, rate, treatment).toFixed(2));
      }

      if (name === 'total' && prev.tax_rate !== undefined && prev.tax_rate !== -1 && newValue !== undefined) {
        const total = newValue;
        const rate = safeParseNumber(prev.tax_rate) || 0;
        const treatment = prev.tax_treatment || 'Inclusive';
        updated.tax = safeParseNumber(calculateTax(total, rate, treatment).toFixed(2));
      }

      if (name === 'tax_treatment' && prev.tax_rate !== undefined && prev.tax_rate !== -1) {
        const total = safeParseNumber(prev.total) || 0;
        const rate = safeParseNumber(prev.tax_rate) || 0;
        const treatment = newValue as TaxTreatment;
        updated.tax = safeParseNumber(calculateTax(total, rate, treatment).toFixed(2));
      }
      
      return updated;
    });
  };

  const handleCategoryChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleChange(e);
    setRulePrompt(null);

    const selectedAccountId = e.target.value;
    const vendorName = formData.vendor_name?.trim();
    if (!vendorName || !selectedAccountId || !onRuleCreated) return;

    const selectedAccount = expenseAccounts.find(a => a.id === selectedAccountId);
    const categoryName = selectedAccount?.name?.replace(/^\d+\s*-\s*/, '') || '';

    try {
      const existingMatch = await categoryRulesApi.match(vendorName);
      if (!existingMatch) {
        setRulePrompt({
          vendorName,
          categoryName,
          qbAccountId: selectedAccountId,
          receiptId: receipt.id,
          mode: 'create',
        });
      } else if (existingMatch.qbAccountId !== selectedAccountId) {
        setRulePrompt({
          vendorName,
          categoryName,
          qbAccountId: selectedAccountId,
          receiptId: receipt.id,
          mode: 'update',
          existingRuleId: existingMatch.ruleId,
        });
      }
    } catch {
      // Non-fatal: if match check fails, just skip the prompt
    }
  };

  const handleTogglePaid = (checked: boolean) => {
     setFormData(prev => ({ 
       ...prev, 
       is_paid: checked,
       // Auto-sync publish_target: Paid -> Expense, Unpaid -> Bill
       publish_target: checked ? 'Expense' : 'Bill'
     }));
  };

  const handleSave = () => {
    // Clean up data before sending to API - convert to camelCase for backend
    const updatedData = {
      // Backend expects camelCase field names
      imageUrl: formData.image_url,
      status: ReceiptStatus.REVIEWED,
      originalFilename: formData.original_filename,
      vendorName: formData.vendor_name,
      transactionDate: formData.transaction_date && formData.transaction_date.trim() !== '' 
        ? formData.transaction_date 
        : undefined,
      subtotal: formData.subtotal !== undefined ? parseFloat(String(formData.subtotal)) : undefined,
      tax: formData.tax !== undefined ? parseFloat(String(formData.tax)) : undefined,
      total: formData.total !== undefined ? parseFloat(String(formData.total)) : undefined,
      currency: formData.currency,
      suggestedCategory: formData.suggested_category,
      description: formData.description,
      documentType: formData.document_type,
      taxTreatment: formData.tax_treatment,
      taxRate: formData.tax_rate !== undefined ? parseFloat(String(formData.tax_rate)) : undefined,
      publishTarget: formData.publish_target,
      isPaid: formData.is_paid,
      paymentAccountId: formData.payment_account_id,
      qbAccountId: formData.qb_account_id,
    };
    
    // Create a receipt object with both camelCase (for display) and the original receipt data
    const receiptForUpdate = {
      ...receipt,
      ...formData,
      status: ReceiptStatus.REVIEWED,
      total: updatedData.total,
      tax: updatedData.tax,
      subtotal: updatedData.subtotal,
      tax_rate: updatedData.taxRate,
    } as Receipt;
    
    onUpdate(receiptForUpdate);
    onBack();
  };

  const handlePublish = async () => {
    if (!formData.qb_account_id) {
      setError("Please select a Category (Expense Account).");
      return;
    }
    
    if (!formData.payment_account_id) {
      setError("Please select a Payment Method.");
      return;
    }

    setIsPublishing(true);
    setError(null);

    try {
      const selectedPaymentAccount = paymentAccounts.find(a => a.id === formData.payment_account_id);
      const paymentAccountType = selectedPaymentAccount?.type as 'Bank' | 'Credit Card' | undefined;
      const selectedAccount = expenseAccounts.find(a => a.id === formData.qb_account_id);
      const qbTxnId = await publishReceipt(receipt, formData.qb_account_id, formData.payment_account_id, paymentAccountType);

      // Create a properly formatted receipt object
      const publishedReceipt = {
        ...receipt,
        ...formData,
        qb_transaction_id: qbTxnId,
        status: ReceiptStatus.PUBLISHED,
        // Update category to reflect the actual selected account name (strip "ID - " prefix)
        suggested_category: selectedAccount?.name?.replace(/^\d+\s*-\s*/, '') || formData.suggested_category,
        // Ensure numeric fields are numbers
        total: formData.total !== undefined ? parseFloat(String(formData.total)) : undefined,
        tax: formData.tax !== undefined ? parseFloat(String(formData.tax)) : undefined,
        subtotal: formData.subtotal !== undefined ? parseFloat(String(formData.subtotal)) : undefined,
        tax_rate: formData.tax_rate !== undefined ? parseFloat(String(formData.tax_rate)) : undefined,
      } as Receipt;
      
      onUpdate(publishedReceipt);
      onBack();
    } catch (err) {
      setError("Failed to publish to QuickBooks. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCreateRule = async () => {
    if (!rulePrompt) return;
    setIsCreatingRule(true);
    try {
      if (rulePrompt.mode === 'update' && rulePrompt.existingRuleId) {
        await categoryRulesApi.update(rulePrompt.existingRuleId, {
          qbCategoryId: rulePrompt.qbAccountId,
        });
      } else {
        await categoryRulesApi.create({
          vendorPattern: rulePrompt.vendorName,
          qbCategoryId: rulePrompt.qbAccountId,
          matchType: 'exact',
          receiptId: rulePrompt.receiptId,
        });
      }
      if (onRuleCreated) await onRuleCreated();
    } catch (err) {
      console.error('Failed to save category rule:', err);
    } finally {
      setIsCreatingRule(false);
      setRulePrompt(null);
    }
  };

  const handleDismissRulePrompt = () => {
    setRulePrompt(null);
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
              fontWeight: 'var(--font-weight-semibold)',
              fontFamily: 'var(--font-body)',
              color: 'var(--text-primary)',
              margin: 0,
            }}>
              {formData.vendor_name || 'Review Receipt'}
            </h2>
            <StatusBadge status={formData.status || ReceiptStatus.UPLOADED} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {canPublish && (
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
            )}
            {canPublish && receipt.status !== ReceiptStatus.PUBLISHED && (
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
                fontSize: '1.35rem',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-heading)',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '4px',
                letterSpacing: '0',
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
                        onChange={handleCategoryChange}
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
                     {receipt.auto_categorized && formData.qb_account_id && !rulePrompt && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '6px',
                          fontSize: 'var(--font-size-tiny)',
                          color: 'var(--primary)',
                        }}>
                          <Zap size={12} />
                          <span>Auto-categorized by rule</span>
                        </div>
                     )}
                     {rulePrompt && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '6px',
                          fontSize: 'var(--font-size-tiny)',
                          color: 'var(--primary)',
                        }}>
                          <Zap size={12} />
                          <span>
                            {rulePrompt.mode === 'update' ? 'Update' : 'Always'}{' '}
                            <strong>{rulePrompt.vendorName}</strong> → <strong>{rulePrompt.categoryName}</strong>
                          </span>
                          <button
                            onClick={handleCreateRule}
                            disabled={isCreatingRule}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              opacity: isCreatingRule ? 0.5 : 1,
                            }}
                            title={rulePrompt.mode === 'update' ? 'Update rule' : 'Create rule'}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={handleDismissRulePrompt}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-tertiary)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Dismiss"
                          >
                            <X size={14} />
                          </button>
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
                fontSize: '1.35rem',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-heading)',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '4px',
                letterSpacing: '0',
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
                backgroundColor: 'var(--background)',
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
                     fontFamily: 'var(--font-body)',
                     color: 'var(--primary)',
                     textTransform: 'uppercase',
                     letterSpacing: '0',
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
                fontSize: '1.35rem',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-heading)',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '4px',
                letterSpacing: '0',
              }}>
                Payment
              </h3>
              
              <InputGroup label="Paid">
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                        onClick={() => handleTogglePaid(true)}
                        style={{
                          flex: 1,
                          padding: 'var(--spacing-2)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--font-size-small)',
                          fontWeight: 'var(--font-weight-semibold)',
                          border: '1px solid',
                          borderColor: formData.is_paid ? 'var(--primary)' : 'var(--border-default)',
                          backgroundColor: formData.is_paid ? 'var(--primary)' : 'var(--background-elevated)',
                          color: formData.is_paid ? 'white' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'var(--transition-default)',
                          boxShadow: formData.is_paid ? 'var(--shadow-raised)' : 'none',
                        }}
                    >
                        Yes
                    </button>
                    <button 
                        onClick={() => handleTogglePaid(false)}
                        style={{
                          flex: 1,
                          padding: 'var(--spacing-2)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--font-size-small)',
                          fontWeight: 'var(--font-weight-semibold)',
                          border: '1px solid',
                          borderColor: !formData.is_paid ? 'var(--primary)' : 'var(--border-default)',
                          backgroundColor: !formData.is_paid ? 'var(--primary)' : 'var(--background-elevated)',
                          color: !formData.is_paid ? 'white' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'var(--transition-default)',
                          boxShadow: !formData.is_paid ? 'var(--shadow-raised)' : 'none',
                        }}
                    >
                        No
                    </button>
                 </div>
              </InputGroup>

              <InputGroup label="Payment method" required>
                <div style={{ position: 'relative' }}>
                    <select
                        name="payment_account_id"
                        value={formData.payment_account_id || ''}
                        onChange={handleChange}
                        style={{
                          ...inputBaseStyle,
                          borderColor: !formData.payment_account_id
                            ? 'var(--danger)'
                            : inputBaseStyle.borderColor
                        }}
                        required
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

              <InputGroup label="Paid by">
                {isInOrg && orgMembers.length > 0 ? (
                  <select
                    name="paid_by"
                    value={formData.paid_by || ''}
                    onChange={handleChange}
                    style={inputBaseStyle}
                  >
                    <option value="">Select team member...</option>
                    {orgMembers.map(m => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="paid_by"
                    value={formData.paid_by || ''}
                    onChange={handleChange}
                    placeholder="Who paid for this?"
                    style={inputBaseStyle}
                  />
                )}
              </InputGroup>

              <InputGroup label="Publish to">
                 <select
                    name="publish_target"
                    value={formData.publish_target}
                    onChange={(e) => {
                      const target = e.target.value as 'Expense' | 'Bill';
                      setFormData(prev => ({
                        ...prev,
                        publish_target: target,
                        // Sync is_paid with publish_target
                        is_paid: target === 'Expense'
                      }));
                    }}
                    style={inputBaseStyle}
                 >
                    <option value="Expense">Expense (Credit Card/Cash)</option>
                    <option value="Bill">Bill (Accounts Payable)</option>
                 </select>
                 <small style={{
                   color: 'var(--text-tertiary)',
                   fontSize: '0.75rem',
                   marginTop: '4px',
                   display: 'block'
                 }}>
                   {formData.publish_target === 'Expense'
                     ? 'Direct expense transaction'
                     : 'Bill with auto-payment applied'
                   }
                 </small>
              </InputGroup>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ReceiptReview;

