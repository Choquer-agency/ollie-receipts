import React from 'react';
import { OrganizationProfile } from '@clerk/clerk-react';

const TeamManagement: React.FC = () => {
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
      }}>
        <h2 style={{
          fontSize: 'var(--font-size-h2)',
          fontWeight: 'var(--font-weight-semibold)',
          fontFamily: 'var(--font-heading)',
          color: 'var(--text-primary)',
          margin: 0,
        }}>
          Team management
        </h2>
        <p style={{
          fontSize: 'var(--font-size-body)',
          color: 'var(--text-secondary)',
          marginTop: '4px',
        }}>
          Invite team members and manage roles. Bookkeepers can review and publish receipts. Employees can only upload.
        </p>
      </div>
      <div style={{ padding: '24px' }}>
        <OrganizationProfile
          appearance={{
            elements: {
              rootBox: { width: '100%' },
              card: {
                border: 'none',
                boxShadow: 'none',
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default TeamManagement;
