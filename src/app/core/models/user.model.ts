export type UserRole = 'Anfitrión' | 'Co-Anfitrión' | 'Participante' | 'Invitado' | 'Webmaster';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
}
