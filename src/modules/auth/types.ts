export type LoginMode = 'user' | 'admin';

export type SessionPayload = {
  userId: string;
  membershipId: string;
  organizationId: string;
  organizationName: string;
  loginMode: LoginMode;
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
};

export type PendingLoginPayload = {
  userId: string;
};

export type MembershipSummary = {
  id: string;
  organizationId: string;
  organizationName: string;
  inviteCode: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
};

export type PostLoginResult =
  | { type: 'session'; payload: SessionPayload }
  | { type: 'no_active_organization' };
