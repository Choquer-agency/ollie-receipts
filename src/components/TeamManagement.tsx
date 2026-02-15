import React, { useState } from 'react';
import { useOrganization, useUser } from '@clerk/clerk-react';
import { AlertCircle, Loader2, Trash2, ChevronDown } from 'lucide-react';

type TabState = 'members' | 'invitations';
type OrgRole = 'org:admin' | 'org:accountant' | 'org:bookkeeper' | 'org:employee';

const ROLE_LABELS: Record<string, string> = {
  'org:admin': 'Admin',
  'org:accountant': 'Accountant',
  'org:bookkeeper': 'Bookkeeper',
  'org:employee': 'Employee',
};

const ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
  { value: 'org:employee', label: 'Employee' },
  { value: 'org:bookkeeper', label: 'Bookkeeper' },
  { value: 'org:accountant', label: 'Accountant' },
  { value: 'org:admin', label: 'Admin' },
];

const TeamManagement: React.FC = () => {
  const { user } = useUser();
  const { organization, memberships, invitations } = useOrganization({
    memberships: { pageSize: 50 },
    invitations: { status: ['pending'], pageSize: 50 },
  });

  const [activeTab, setActiveTab] = useState<TabState>('members');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('org:employee');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !inviteEmail.trim()) return;

    setInviting(true);
    setError('');
    setSuccess('');

    try {
      await organization.inviteMember({
        emailAddress: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteEmail('');
      setSuccess(`Invitation sent to ${inviteEmail.trim()}`);
      invitations?.revalidate?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: OrgRole) => {
    if (!organization) return;
    setLoadingAction(userId);
    setError('');

    try {
      await organization.updateMember({ userId, role: newRole });
      memberships?.revalidate?.();
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Failed to update role');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!organization) return;
    if (!confirm('Are you sure you want to remove this member?')) return;

    setLoadingAction(userId);
    setError('');

    try {
      await organization.removeMember(userId);
      memberships?.revalidate?.();
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Failed to remove member');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!invitations?.data) return;
    const invitation = invitations.data.find((inv: any) => inv.id === invitationId);
    if (!invitation) return;

    setLoadingAction(invitationId);
    setError('');

    try {
      await invitation.revoke();
      invitations.revalidate();
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Failed to revoke invitation');
    } finally {
      setLoadingAction(null);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: 'var(--font-size-body)',
    fontFamily: 'var(--font-body)',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--background-elevated)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    transition: 'var(--transition-default)',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none' as const,
    backgroundImage: 'none',
    paddingRight: '32px',
    position: 'relative' as const,
  };

  const membersList = memberships?.data || [];
  const invitationsList = invitations?.data || [];

  return (
    <div style={{
      backgroundColor: 'var(--background-elevated)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-raised)',
      overflow: 'hidden',
    }}>
      {/* Header */}
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

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: '32px',
        padding: '0 24px',
        borderBottom: '1px solid var(--border-default)',
      }}>
        {(['members', 'invitations'] as TabState[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
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
              borderBottomColor: activeTab === tab ? 'var(--primary)' : 'transparent',
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
              transition: 'var(--transition-default)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab) {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderBottomColor = 'var(--border-strong)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab) {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderBottomColor = 'transparent';
              }
            }}
          >
            {tab === 'members' ? 'Members' : 'Invitations'}
            <span style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-small)',
              fontWeight: 'var(--font-weight-semibold)',
              backgroundColor: 'var(--background-muted)',
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
            }}>
              {tab === 'members' ? membersList.length : invitationsList.length}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '24px' }}>
        {/* Error message */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '12px',
            backgroundColor: 'var(--status-error-bg)',
            border: '1px solid var(--status-error-text)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
          }}>
            <AlertCircle size={16} style={{ color: 'var(--status-error-text)', flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--status-error-text)', margin: 0 }}>
              {error}
            </p>
          </div>
        )}

        {/* Success message */}
        {success && (
          <div style={{
            padding: '12px',
            backgroundColor: 'var(--status-success-bg)',
            border: '1px solid var(--status-success-text)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
          }}>
            <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--status-success-text)', margin: 0 }}>
              {success}
            </p>
          </div>
        )}

        {activeTab === 'members' ? (
          <>
            {/* Invite form */}
            <form onSubmit={handleInvite} style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '24px',
              alignItems: 'flex-end',
            }}>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--font-size-small)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--text-primary)',
                  marginBottom: '6px',
                }}>
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  style={{ ...inputStyle, width: '100%' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--font-size-small)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--text-primary)',
                  marginBottom: '6px',
                }}>
                  Role
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                    style={selectStyle}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)',
                    pointerEvents: 'none',
                  }} />
                </div>
              </div>
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  fontSize: 'var(--font-size-body)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'white',
                  backgroundColor: (inviting || !inviteEmail.trim()) ? 'var(--text-tertiary)' : 'var(--primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: (inviting || !inviteEmail.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'var(--transition-default)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!inviting && inviteEmail.trim()) {
                    e.currentTarget.style.backgroundColor = 'var(--primary-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!inviting && inviteEmail.trim()) {
                    e.currentTarget.style.backgroundColor = 'var(--primary)';
                  }
                }}
              >
                {inviting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                Invite
              </button>
            </form>

            {/* Members list */}
            {!memberships?.data ? (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-body)' }}>Loading members...</p>
              </div>
            ) : membersList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-body)' }}>No members found.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: 'var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                {membersList.map((member: any) => {
                  const isCurrentUser = member.publicUserData?.userId === user?.id;
                  const isLoading = loadingAction === member.publicUserData?.userId;

                  return (
                    <div
                      key={member.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        backgroundColor: 'var(--background-elevated)',
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--background-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}>
                        {member.publicUserData?.imageUrl ? (
                          <img
                            src={member.publicUserData.imageUrl}
                            alt=""
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{
                            fontSize: 'var(--font-size-small)',
                            fontWeight: 'var(--font-weight-semibold)',
                            color: 'var(--text-secondary)',
                          }}>
                            {(member.publicUserData?.firstName?.[0] || member.publicUserData?.identifier?.[0] || '?').toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Name & email */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 'var(--font-size-body)',
                          fontWeight: 'var(--font-weight-medium)',
                          color: 'var(--text-primary)',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {member.publicUserData?.firstName && member.publicUserData?.lastName
                            ? `${member.publicUserData.firstName} ${member.publicUserData.lastName}`
                            : member.publicUserData?.identifier || 'Unknown'}
                          {isCurrentUser && (
                            <span style={{
                              fontSize: 'var(--font-size-small)',
                              color: 'var(--text-tertiary)',
                              marginLeft: '6px',
                            }}>
                              (you)
                            </span>
                          )}
                        </p>
                        <p style={{
                          fontSize: 'var(--font-size-small)',
                          color: 'var(--text-secondary)',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {member.publicUserData?.identifier || ''}
                        </p>
                      </div>

                      {/* Role selector */}
                      {isCurrentUser ? (
                        <span style={{
                          fontSize: 'var(--font-size-small)',
                          fontWeight: 'var(--font-weight-medium)',
                          color: 'var(--text-secondary)',
                          padding: '4px 10px',
                          backgroundColor: 'var(--background-muted)',
                          borderRadius: 'var(--radius-md)',
                        }}>
                          {ROLE_LABELS[member.role] || member.role}
                        </span>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <select
                            value={member.role}
                            onChange={(e) => handleChangeRole(member.publicUserData?.userId, e.target.value as OrgRole)}
                            disabled={isLoading}
                            style={{
                              ...selectStyle,
                              fontSize: 'var(--font-size-small)',
                              padding: '4px 28px 4px 10px',
                              opacity: isLoading ? 0.5 : 1,
                            }}
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-secondary)',
                            pointerEvents: 'none',
                          }} />
                        </div>
                      )}

                      {/* Remove button */}
                      {!isCurrentUser && (
                        <button
                          onClick={() => handleRemoveMember(member.publicUserData?.userId)}
                          disabled={isLoading}
                          title="Remove member"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            transition: 'var(--transition-default)',
                            color: 'var(--text-tertiary)',
                            opacity: isLoading ? 0.5 : 1,
                          }}
                          onMouseEnter={(e) => {
                            if (!isLoading) {
                              e.currentTarget.style.backgroundColor = 'var(--status-error-bg)';
                              e.currentTarget.style.color = 'var(--status-error-text)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--text-tertiary)';
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Invitations tab */
          <>
            {!invitations?.data ? (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-body)' }}>Loading invitations...</p>
              </div>
            ) : invitationsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-body)' }}>No pending invitations.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: 'var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                {invitationsList.map((invitation: any) => {
                  const isLoading = loadingAction === invitation.id;

                  return (
                    <div
                      key={invitation.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        backgroundColor: 'var(--background-elevated)',
                      }}
                    >
                      {/* Email icon placeholder */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--status-warning-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <span style={{
                          fontSize: 'var(--font-size-small)',
                          fontWeight: 'var(--font-weight-semibold)',
                          color: 'var(--status-warning-text)',
                        }}>
                          {(invitation.emailAddress?.[0] || '?').toUpperCase()}
                        </span>
                      </div>

                      {/* Email & role */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 'var(--font-size-body)',
                          fontWeight: 'var(--font-weight-medium)',
                          color: 'var(--text-primary)',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {invitation.emailAddress}
                        </p>
                        <p style={{
                          fontSize: 'var(--font-size-small)',
                          color: 'var(--text-secondary)',
                          margin: 0,
                        }}>
                          Invited as {ROLE_LABELS[invitation.role] || invitation.role}
                          {invitation.createdAt && (
                            <> · {new Date(invitation.createdAt).toLocaleDateString()}</>
                          )}
                        </p>
                      </div>

                      {/* Status badge */}
                      <span style={{
                        fontSize: 'var(--font-size-small)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--status-warning-text)',
                        padding: '4px 10px',
                        backgroundColor: 'var(--status-warning-bg)',
                        borderRadius: 'var(--radius-md)',
                      }}>
                        Pending
                      </span>

                      {/* Revoke button */}
                      <button
                        onClick={() => handleRevokeInvitation(invitation.id)}
                        disabled={isLoading}
                        style={{
                          fontSize: 'var(--font-size-small)',
                          fontWeight: 'var(--font-weight-medium)',
                          color: 'var(--status-error-text)',
                          backgroundColor: 'transparent',
                          border: '1px solid var(--status-error-text)',
                          borderRadius: 'var(--radius-md)',
                          padding: '4px 12px',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          transition: 'var(--transition-default)',
                          opacity: isLoading ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onMouseEnter={(e) => {
                          if (!isLoading) {
                            e.currentTarget.style.backgroundColor = 'var(--status-error-bg)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {isLoading && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                        Revoke
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TeamManagement;
