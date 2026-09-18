import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'meetflow_auth_user';
  private readonly apiUrl = `${environment.apiUrl}/users`;

  private registeredUsers: User[] = [
    {
      id: 'u-1',
      name: 'Sergio D.',
      email: 'sergio.d@meetflow.com',
      role: 'Anfitrión',
      avatarUrl: 'https://ui-avatars.com/api/?name=Sergio+D&background=0D5A56&color=ffffff&bold=true'
    },
    {
      id: 'u-2',
      name: 'Ana García',
      email: 'ana.garcia@meetflow.com',
      role: 'Anfitrión',
      avatarUrl: 'https://ui-avatars.com/api/?name=Ana+Garcia&background=0284C7&color=ffffff&bold=true'
    },
    {
      id: 'u-3',
      name: 'Diego Morales',
      email: 'diego.morales@meetflow.com',
      role: 'Anfitrión',
      avatarUrl: 'https://ui-avatars.com/api/?name=Diego+Morales&background=A4613B&color=ffffff&bold=true'
    }
  ];

  private currentUserSubject = new BehaviorSubject<User | null>(this.loadUserFromStorage());
  currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  private loadUserFromStorage(): User | null {
    const savedSession = sessionStorage.getItem(this.STORAGE_KEY);
    if (savedSession) {
      try {
        return JSON.parse(savedSession);
      } catch (e) {}
    }
    const savedLocal = localStorage.getItem(this.STORAGE_KEY);
    if (savedLocal) {
      try {
        return JSON.parse(savedLocal);
      } catch (e) {}
    }
    return null;
  }

  private readonly APPROVED_HOSTS_KEY = 'meetflow_approved_hosts';

  private loadApprovedHosts(): User[] {
    const saved = localStorage.getItem(this.APPROVED_HOSTS_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  }

  registerApprovedHost(name: string, email: string, avatarUrl?: string): void {
    const currentApproved = this.loadApprovedHosts();
    const normalizedEmail = email.trim().toLowerCase();
    const avatar = avatarUrl || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80`;

    const existingIndex = currentApproved.findIndex(u => u.email.toLowerCase() === normalizedEmail);
    if (existingIndex >= 0) {
      currentApproved[existingIndex] = { ...currentApproved[existingIndex], name: name.trim(), avatarUrl: avatar };
    } else {
      const newHost: User = {
        id: 'host-' + Date.now(),
        name: name.trim(),
        email: normalizedEmail,
        role: 'Anfitrión',
        avatarUrl: avatar
      };
      currentApproved.unshift(newHost);
    }
    localStorage.setItem(this.APPROVED_HOSTS_KEY, JSON.stringify(currentApproved));
  }

  getRegisteredUsers(): User[] {
    const approved = this.loadApprovedHosts();
    const merged = [...approved];
    this.registeredUsers.forEach(r => {
      if (!merged.some(m => m.email.toLowerCase() === r.email.toLowerCase())) {
        merged.push(r);
      }
    });
    return merged;
  }

  getHostProfile(): User | null {
    const savedHost = localStorage.getItem('meetflow_host_profile');
    if (savedHost) {
      try { return JSON.parse(savedHost); } catch (e) {}
    }
    const savedUser = localStorage.getItem(this.STORAGE_KEY);
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u.role === 'Anfitrión') return u;
      } catch (e) {}
    }
    const registered = this.getRegisteredUsers();
    return registered.find(u => u.role === 'Anfitrión') || null;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.getValue();
  }

  isLoggedIn(): boolean {
    return !!this.currentUserSubject.getValue();
  }

  isGuest(): boolean {
    const user = this.currentUserSubject.getValue();
    return user ? user.role === 'Invitado' : false;
  }

  login(email: string, password?: string, customAvatarUrl?: string): Observable<{ success: boolean; message?: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    if (password !== undefined && (!password || !password.trim())) {
      return of({ success: false, message: 'Por favor, ingresa tu contraseña.' });
    }

    let user = this.getRegisteredUsers().find(u => u.email.toLowerCase() === normalizedEmail);

    if (user) {
      if (customAvatarUrl) {
        user = { ...user, avatarUrl: customAvatarUrl };
      }
      this.syncUserWithBackend(user.email, user.name, user.avatarUrl);
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      if (user.role === 'Anfitrión') {
        localStorage.setItem('meetflow_host_profile', JSON.stringify(user));
      }
      this.currentUserSubject.next(user);
      return of({ success: true });
    }

    if (normalizedEmail.includes('@')) {
      const nameFromEmail = normalizedEmail.split('@')[0].replace('.', ' ');
      const formattedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
      const newUser: User = {
        id: 'u-' + Date.now(),
        name: formattedName,
        email: normalizedEmail,
        role: 'Anfitrión',
        avatarUrl: customAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(formattedName)}&background=A4613B&color=ffffff&bold=true`
      };
      this.syncUserWithBackend(newUser.email, newUser.name, newUser.avatarUrl);
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(newUser));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newUser));
      this.currentUserSubject.next(newUser);
      return of({ success: true });
    }

    return of({ success: false, message: 'Por favor, ingresa un correo electrónico válido.' });
  }

  loginAsGuest(guestName: string, customAvatarUrl?: string): Observable<{ success: boolean }> {
    const name = guestName.trim() || 'Invitado MeetFlow';
    const avatar = customAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0284C7&color=ffffff&bold=true`;
    const guestUser: User = {
      id: 'guest-' + Date.now(),
      name: name,
      email: `invitado_${Date.now()}@meetflow.guest`,
      role: 'Invitado',
      avatarUrl: avatar
    };

    // Sync guest with Spring Boot backend
    this.http.post<any>(`${this.apiUrl}/guest`, {
      name: guestUser.name,
      avatarUrl: guestUser.avatarUrl
    }).pipe(
      catchError(() => of(null))
    ).subscribe();

    // Store guest session in sessionStorage and clear localStorage host user to prevent role leakage
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(guestUser));
    localStorage.removeItem(this.STORAGE_KEY);
    this.currentUserSubject.next(guestUser);
    return of({ success: true });
  }

  loginWebmaster(email: string, password?: string): Observable<{ success: boolean; message?: string }> {
    const wmUser: User = {
      id: 'webmaster-1',
      name: 'Webmaster Principal',
      email: email || 'webmaster@meetflow.com',
      role: 'Webmaster',
      avatarUrl: 'https://ui-avatars.com/api/?name=Webmaster+Admin&background=0D5A56&color=ffffff&bold=true'
    };

    this.http.post<any>(`${environment.apiUrl}/webmaster/login`, {
      email,
      password
    }).pipe(
      catchError(() => of(null))
    ).subscribe();

    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(wmUser));
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(wmUser));
    this.currentUserSubject.next(wmUser);
    return of({ success: true });
  }

  private syncUserWithBackend(email: string, name: string, avatarUrl?: string): void {
    this.http.post<any>(`${this.apiUrl}/login`, {
      email,
      name,
      avatarUrl
    }).pipe(
      catchError(() => of(null))
    ).subscribe();
  }

  logout(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.STORAGE_KEY);
    this.currentUserSubject.next(null);
  }
}
