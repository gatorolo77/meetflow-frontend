import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface PendingHost {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebmasterService {
  private readonly apiUrl = `${environment.apiUrl}/webmaster`;
  private pendingHostsSubject = new BehaviorSubject<PendingHost[]>([]);
  public pendingHosts$ = this.pendingHostsSubject.asObservable();
  public pendingHostsCount$ = this.pendingHosts$.pipe(map(hosts => hosts.length));

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.loadPendingHosts();
  }

  loadPendingHosts(): Observable<PendingHost[]> {
    this.http.get<PendingHost[]>(`${this.apiUrl}/hosts/pending`).pipe(
      catchError(() => {
        // Fallback mock pending hosts if backend offline or initial load
        return of([
          {
            id: 101,
            name: 'Roberto Mendoza',
            email: 'roberto.mendoza@empresa.com',
            role: 'HOST',
            status: 'PENDING_APPROVAL',
            avatarUrl: 'https://ui-avatars.com/api/?name=Roberto+Mendoza&background=D97706&color=ffffff&bold=true'
          },
          {
            id: 102,
            name: 'Valeria Soler',
            email: 'valeria.soler@startup.io',
            role: 'HOST',
            status: 'PENDING_APPROVAL',
            avatarUrl: 'https://ui-avatars.com/api/?name=Valeria+Soler&background=2563EB&color=ffffff&bold=true'
          }
        ]);
      })
    ).subscribe(hosts => {
      this.pendingHostsSubject.next(hosts || []);
    });
    return this.pendingHosts$;
  }

  getPendingHosts(): Observable<PendingHost[]> {
    return this.pendingHosts$;
  }

  sendHostInvitation(email: string): Observable<{ email: string; token: string; activationLink: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    return this.http.post<any>(`${this.apiUrl}/hosts/invite`, { email: normalizedEmail }).pipe(
      catchError(() => {
        const token = Math.random().toString(36).substring(2, 10);
        const link = `${window.location.origin}/webmaster/login?email=${encodeURIComponent(normalizedEmail)}&token=${token}`;
        return of({ email: normalizedEmail, token, activationLink: link });
      })
    );
  }

  applyForHost(name: string, email: string, avatarUrl?: string): Observable<PendingHost> {
    const hostName = name.trim();
    const hostEmail = email.trim().toLowerCase();
    const avatar = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(hostName)}&background=0D5A56&color=ffffff&bold=true`;

    const newHost: PendingHost = {
      id: Date.now(),
      name: hostName,
      email: hostEmail,
      role: 'HOST',
      status: 'PENDING_APPROVAL',
      avatarUrl: avatar
    };

    return this.http.post<any>(`${this.apiUrl}/hosts/apply`, {
      name: hostName,
      email: hostEmail,
      avatarUrl: avatar
    }).pipe(
      catchError(() => of(newHost)),
      map(res => {
        const createdHost: PendingHost = res && res.id ? res : newHost;
        const current = this.pendingHostsSubject.getValue();
        const exists = current.some(h => h.email.toLowerCase() === hostEmail);
        if (!exists) {
          this.pendingHostsSubject.next([createdHost, ...current]);
        }
        return createdHost;
      })
    );
  }

  approveHost(host: PendingHost): Observable<any> {
    // Register host into AuthService and localStorage so they immediately appear on Login screen
    this.authService.registerApprovedHost(host.name, host.email, host.avatarUrl);

    return this.http.put(`${this.apiUrl}/hosts/${host.id}/approve`, {}).pipe(
      catchError(() => of(null)),
      map(res => {
        const current = this.pendingHostsSubject.getValue();
        const updated = current.filter(h => h.id !== host.id);
        this.pendingHostsSubject.next(updated);
        return res;
      })
    );
  }

  rejectHost(host: PendingHost): Observable<any> {
    return this.http.put(`${this.apiUrl}/hosts/${host.id}/reject`, {}).pipe(
      catchError(() => of(null)),
      map(res => {
        const current = this.pendingHostsSubject.getValue();
        const updated = current.filter(h => h.id !== host.id);
        this.pendingHostsSubject.next(updated);
        return res;
      })
    );
  }
}

