import React, { useState, useEffect } from 'react';
import { AuditLogEntry } from '../types';
import { orgApi } from '../services/apiService';

const FIELD_LABELS: Record<string, string> = {
  vendorName: 'vendor name',
  transactionDate: 'date',
  subtotal: 'subtotal',
  tax: 'tax',
  total: 'total',
  currency: 'currency',
  suggestedCategory: 'category',
  description: 'description',
  documentType: 'document type',
  taxTreatment: 'tax treatment',
  taxRate: 'tax rate',
  publishTarget: 'publish target',
  isPaid: 'paid status',
  paymentAccountId: 'payment account',
  qbAccountId: 'expense account',
  paidBy: 'paid by',
  status: 'status',
  imageUrl: 'image',
  originalFilename: 'filename',
};

const ACTION_FILTERS = [
  { label: 'All activity', value: '' },
  { label: 'Uploads', value: 'receipt.upload' },
  { label: 'Updates', value: 'receipt.update' },
  { label: 'Deletions', value: 'receipt.delete' },
  { label: 'Publishing', value: 'receipt.publish' },
  { label: 'QuickBooks', value: 'qbo.connect' },
];

const AuditLog: React.FC = () => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    orgApi.getAuditLog({ page, limit: 50, action: actionFilter || undefined })
      .then(data => {
        setEntries(data.entries);
        setTotalPages(data.pagination.totalPages);
      })
      .catch(err => console.error('Error fetching audit log:', err))
      .finally(() => setLoading(false));
  }, [page, actionFilter]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFieldNames = (fields?: string[]) => {
    if (!fields || fields.length === 0) return '';
    return fields
      .map(f => FIELD_LABELS[f] || f)
      .join(', ');
  };

  const getDescription = (entry: AuditLogEntry): { main: string; sub?: string } => {
    const d = entry.details || {};
    const vendor = d.vendorName;
    const filename = d.filename;
    const total = d.total != null ? `$${Number(d.total).toFixed(2)}` : null;

    switch (entry.action) {
      case 'receipt.upload': {
        const name = vendor ? `"${vendor}"` : (filename ? `(${filename})` : '');
        const file = vendor && filename ? ` (${filename})` : '';
        return { main: `Uploaded receipt ${name}${file}` };
      }
      case 'receipt.update': {
        const name = vendor ? `"${vendor}"` : '';
        const fields = formatFieldNames(d.fields);
        return {
          main: name ? `Updated receipt ${name}` : 'Updated a receipt',
          sub: fields || undefined,
        };
      }
      case 'receipt.delete': {
        const name = vendor ? `"${vendor}"` : '';
        const amount = total ? ` (${total})` : '';
        return { main: name ? `Deleted receipt ${name}${amount}` : 'Deleted a receipt' };
      }
      case 'receipt.publish': {
        const name = vendor ? `"${vendor}"` : 'a receipt';
        const target = d.publishTarget || 'Expense';
        const amount = total ? `${total} ` : '';
        return { main: `Published ${name} — ${amount}as ${target}` };
      }
      case 'qbo.connect': {
        const company = d.companyName ? ` (${d.companyName})` : '';
        return { main: `Connected QuickBooks${company}` };
      }
      case 'qbo.disconnect': {
        const company = d.companyName ? ` (${d.companyName})` : '';
        return { main: `Disconnected QuickBooks${company}` };
      }
      case 'member.invite':
        return { main: 'Invited a member' };
      case 'member.remove':
        return { main: 'Removed a member' };
      default:
        return { main: entry.action };
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--background-elevated)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-raised)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '24px',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h2 style={{
            fontSize: 'var(--font-size-h2)',
            fontWeight: 'var(--font-weight-semibold)',
            fontFamily: 'var(--font-heading)',
            color: 'var(--text-primary)',
            margin: 0,
          }}>
            Activity log
          </h2>
          <p style={{
            fontSize: 'var(--font-size-body)',
            color: 'var(--text-secondary)',
            marginTop: '4px',
          }}>
            Track all team activity
          </p>
        </div>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--background-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-body)',
            color: 'var(--text-primary)',
          }}
        >
          {ACTION_FILTERS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No activity yet</p>
        </div>
      ) : (
        <div>
          {entries.map((entry) => {
            const desc = getDescription(entry);
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 24px',
                  borderBottom: '1px solid var(--border-default)',
                  gap: '16px',
                }}
              >
                <div style={{
                  width: '120px',
                  flexShrink: 0,
                  fontSize: 'var(--font-size-small)',
                  color: 'var(--text-tertiary)',
                }}>
                  {formatDate(entry.created_at)}
                </div>
                <div style={{
                  width: '120px',
                  flexShrink: 0,
                  fontSize: 'var(--font-size-body)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {entry.user_name || 'System'}
                </div>
                <div style={{
                  flex: 1,
                  fontSize: 'var(--font-size-body)',
                  color: 'var(--text-primary)',
                }}>
                  {desc.main}
                  {desc.sub && (
                    <span style={{
                      fontSize: 'var(--font-size-small)',
                      color: 'var(--text-tertiary)',
                      marginLeft: '6px',
                    }}>
                      — {desc.sub}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              padding: '16px',
            }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: '6px 12px',
                  fontSize: 'var(--font-size-small)',
                  backgroundColor: 'var(--background-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  color: page === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                }}
              >
                Previous
              </button>
              <span style={{
                padding: '6px 12px',
                fontSize: 'var(--font-size-small)',
                color: 'var(--text-secondary)',
              }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: '6px 12px',
                  fontSize: 'var(--font-size-small)',
                  backgroundColor: 'var(--background-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  color: page === totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)',
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLog;
