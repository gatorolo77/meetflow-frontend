export type MeetingRole = 'HOST' | 'CO_HOST' | 'PARTICIPANT';

export type ConnectionQuality = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export interface Participant {
  id: string;
  name: string;
  avatarUrl?: string;
  role: MeetingRole;
  isMicActive: boolean;
  isCameraActive: boolean;
  isSharingScreen: boolean;
  connectionQuality: ConnectionQuality;
  joinedAt: Date;
}

export interface Meeting {
  id: string;
  code: string;
  title: string;
  description?: string;
  groupOrTeam: string;
  hostName: string;
  scheduledTime: string;
  durationMinutes: number;
  isLive: boolean;
  participants: Participant[];
  maxParticipants?: number;
}

export interface LiveMeetingMetrics {
  connectedParticipants: number;
  activeMicrophones: number;
  activeCameras: number;
  screenShares: number;
  connectionQualityLabel: string;
}
