import React from 'react';
import { ReceiptStatus } from '../types';

interface StatusBadgeProps {
  status: ReceiptStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStyles = (s: ReceiptStatus): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      display: 'inline-block',
      padding: '6px 12px',
      borderRadius: 'var(--radius-md)',
      fontSize: 'var(--font-size-small)',
      fontWeight: 'var(--font-weight-semibold)',
      fontFamily: 'var(--font-body)',
      border: '1px solid',
    };

    switch (s) {
      case ReceiptStatus.UPLOADED:
        return {
          ...baseStyles,
          backgroundColor: 'var(--status-info-bg)',
          color: 'var(--status-info-text)',
          borderColor: 'var(--status-info-text)',
        };
      case ReceiptStatus.OCR_COMPLETE:
        return {
          ...baseStyles,
          backgroundColor: 'var(--status-warning-bg)',
          color: 'var(--status-warning-text)',
          borderColor: 'var(--status-warning-text)',
        };
      case ReceiptStatus.REVIEWED:
        return {
          ...baseStyles,
          backgroundColor: 'var(--status-success-bg)',
          color: 'var(--status-success-text)',
          borderColor: 'var(--status-success-text)',
        };
      case ReceiptStatus.PUBLISHED:
        return {
          ...baseStyles,
          backgroundColor: 'var(--status-draft-bg)',
          color: 'var(--status-draft-text)',
          borderColor: 'var(--status-draft-text)',
        };
      case ReceiptStatus.ERROR:
        return {
          ...baseStyles,
          backgroundColor: 'var(--status-error-bg)',
          color: 'var(--status-error-text)',
          borderColor: 'var(--status-error-text)',
        };
      default:
        return {
          ...baseStyles,
          backgroundColor: 'var(--status-draft-bg)',
          color: 'var(--status-draft-text)',
          borderColor: 'var(--status-draft-text)',
        };
    }
  };

  const getLabel = (s: ReceiptStatus) => {
    switch (s) {
      case ReceiptStatus.UPLOADED: return 'Processing';
      case ReceiptStatus.OCR_COMPLETE: return 'To review';
      case ReceiptStatus.REVIEWED: return 'Ready';
      case ReceiptStatus.PUBLISHED: return 'Published';
      case ReceiptStatus.ERROR: return 'Error';
      default: return s;
    }
  };

  return (
    <span style={getStyles(status)}>
      {getLabel(status)}
    </span>
  );
};

export default StatusBadge;

