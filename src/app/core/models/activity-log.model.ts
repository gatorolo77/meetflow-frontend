export type ActivityType = 'JOIN_REQUEST' | 'MEETING_CREATED' | 'USER_ADMITTED' | 'CHAT_MESSAGE' | 'USER_LEFT';

export interface ActivityLogItem {
  id: string;
  type: ActivityType;
  description: string;
  timestampRelative: string;
  iconType: string;
}
