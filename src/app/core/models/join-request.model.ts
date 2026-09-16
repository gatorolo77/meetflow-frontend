export type JoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface JoinRequest {
  id: string;
  userName: string;
  avatarUrl?: string;
  targetMeetingTitle: string;
  targetMeetingId: string;
  requestedAt: Date;
  status: JoinRequestStatus;
}
