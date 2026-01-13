import React, { useState, useEffect, useRef } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { User, LogOut, ChevronDown, Unlink } from 'lucide-react';
import { disconnectQBO, checkQBOStatus } from '../services/qboService';

interface UserMenuProps {
  onDisconnectQBO?: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ onDisconnectQBO }) => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [isOpen, setIsOpen] = useState(false);
  const [isQboConnected, setIsQboConnected] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check QB connection status when menu opens
  useEffect(() => {
    if (isOpen) {
      checkQBOStatus().then(status => {
        setIsQboConnected(status.connected);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) return null;

  const getDisplayName = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    return user.primaryEmailAddress?.emailAddress || 'User';
  };
  
  const handleDisconnectQBO = async () => {
    const success = await disconnectQBO();
    if (success) {
      setIsQboConnected(false);
      if (onDisconnectQBO) {
        onDisconnectQBO();
      }
      setIsOpen(false);
    }
  };

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px 6px 6px',
          backgroundColor: 'transparent',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          transition: 'var(--transition-default)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--background-muted)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {/* Avatar - SVG Icon */}
        <div
          style={{
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgZmlsbD0iIzAwMDAwMCIgdmlld0JveD0iMCAwIDI1NiAyNTYiPjxwYXRoIGQ9Ik0yMzAuOTIsMjEyYy0xNS4yMy0yNi4zMy0zOC43LTQ1LjIxLTY2LjA5LTU0LjE2YTcyLDcyLDAsMSwwLTczLjY2LDBDNjMuNzgsMTY2Ljc4LDQwLjMxLDE4NS42NiwyNS4wOCwyMTJhOCw4LDAsMSwwLDEzLjg1LDhjMTguODQtMzIuNTYsNTIuMTQtNTIsODkuMDctNTJzNzAuMjMsMTkuNDQsODkuMDcsNTJhOCw4LDAsMSwwLDEzLjg1LThaTTcyLDk2YTU2LDU2LDAsMSwxLDU2LDU2QTU2LjA2LDU2LjA2LDAsMCwxLDcyLDk2WiI+PC9wYXRoPjwvc3ZnPg=="
            alt="User"
            style={{
              width: '32px',
              height: '32px',
            }}
          />
        </div>

        {/* User Name */}
        <span
          style={{
            fontSize: 'var(--font-size-body)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--text-primary)',
            maxWidth: '150px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            backgroundColor: 'transparent',
          }}
        >
          {getDisplayName()}
        </span>

        {/* Chevron */}
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-secondary)',
            transition: 'var(--transition-default)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            backgroundColor: 'var(--background-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-raised)',
            minWidth: '220px',
            overflow: 'hidden',
            zIndex: 'var(--z-dropdown)',
          }}
        >
          {/* User Info */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-default)',
            }}
          >
            <p
              style={{
                fontSize: 'var(--font-size-body)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--text-primary)',
                marginBottom: '2px',
                backgroundColor: 'transparent',
              }}
            >
              {getDisplayName()}
            </p>
            <p
              style={{
                fontSize: 'var(--font-size-small)',
                color: 'var(--text-secondary)',
              }}
            >
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </div>

          {/* Menu Items */}
          <div style={{ padding: '8px' }}>
            {/* Account Settings (Future) */}
            <button
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'var(--transition-default)',
                fontSize: 'var(--font-size-body)',
                color: 'var(--text-primary)',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--background-muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <User size={16} style={{ color: 'var(--text-secondary)' }} />
              <span>Account settings</span>
            </button>

            {/* Disconnect QuickBooks */}
            {isQboConnected && (
              <button
                onClick={handleDisconnectQBO}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'var(--transition-default)',
                  fontSize: 'var(--font-size-body)',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--background-muted)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Unlink size={16} style={{ color: 'var(--text-secondary)' }} />
                <span>Disconnect QuickBooks</span>
              </button>
            )}

            {/* Sign Out */}
            <button
              onClick={() => signOut()}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'var(--transition-default)',
                fontSize: 'var(--font-size-body)',
                color: 'var(--status-error-text)',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--status-error-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;



