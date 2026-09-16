import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { JoinRequest } from '../models/join-request.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class JoinRequestService {
  private readonly STORAGE_KEY = 'meetflow_join_requests';
  private readonly apiUrl = `${environment.apiUrl}/requests`;
  private lastRawStorage = '';

  private joinRequestsSubject = new BehaviorSubject<JoinRequest[]>([]);

  constructor(
    private ngZone: NgZone,
    private http: HttpClient
  ) {
    this.loadFromStorage();

    // Sync from Spring Boot Backend
    this.fetchBackendRequests();

    // Listen to native window storage events from other tabs
    window.addEventListener('storage', (event) => {
      if (event.key === this.STORAGE_KEY) {
        this.ngZone.run(() => {
          this.loadFromStorage();
        });
      }
    });

    // Fallback periodic check every 1.5s inside Angular Zone for cross-tab reactivity
    setInterval(() => {
      this.checkStorageDiff();
    }, 1500);
  }

  private fetchBackendRequests(): void {
    this.http.get<any[]>(`${this.apiUrl}/pending`).pipe(
      catchError(() => of([]))
    ).subscribe(backendReqs => {
      if (backendReqs && backendReqs.length > 0) {
        const mapped: JoinRequest[] = backendReqs.map(r => ({
          id: 'backend-' + r.id,
          userName: r.applicantName,
          avatarUrl: r.avatarUrl,
          targetMeetingTitle: r.targetMeetingTitle || `Sala (${r.targetMeetingCode})`,
          targetMeetingId: r.targetMeetingCode,
          requestedAt: new Date(r.requestedAt || Date.now()),
          status: r.status as any
        }));
        
        const current = this.joinRequestsSubject.getValue();
        const merged = [...current];
        mapped.forEach(m => {
          const existing = merged.find(c => c.id === m.id || (c.userName.trim().toLowerCase() === m.userName.trim().toLowerCase() && c.targetMeetingId === m.targetMeetingId));
          if (!existing) {
            merged.push(m);
          }
        });
        this.saveToStorage(merged);
      }
    });
  }

  private checkStorageDiff(): void {
    const currentRaw = localStorage.getItem(this.STORAGE_KEY) || '';
    if (currentRaw !== this.lastRawStorage) {
      this.ngZone.run(() => {
        this.loadFromStorage();
      });
    }
  }

  private loadFromStorage(): void {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    this.lastRawStorage = saved || '';
    if (saved) {
      try {
        const parsed: JoinRequest[] = JSON.parse(saved);
        this.previousPendingCount = parsed.filter(r => r.status === 'PENDING').length;
        this.joinRequestsSubject.next(parsed);
        return;
      } catch (e) {}
    }

    // Start with empty seeds so host dashboard shows only real live join requests
    const defaultSeeds: JoinRequest[] = [];
    this.previousPendingCount = 0;
    this.saveToStorage(defaultSeeds);
  }

  private previousPendingCount = -1;

  playNotificationChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      // First Chime Tone (Soft High Bell - 880 Hz / A5)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain1.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);

      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.35);

      // Second Chime Tone (1174.66 Hz / D6 - Harmony)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.18, audioCtx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.55);

      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);

      osc2.start(audioCtx.currentTime + 0.12);
      osc2.stop(audioCtx.currentTime + 0.55);
    } catch (err) {
      console.warn('Audio chime playback omitted:', err);
    }
  }

  private saveToStorage(requests: JoinRequest[]): void {
    const raw = JSON.stringify(requests);
    this.lastRawStorage = raw;

    const currentPendingCount = requests.filter(r => r.status === 'PENDING').length;
    if (this.previousPendingCount >= 0 && currentPendingCount > this.previousPendingCount) {
      this.playNotificationChime();
    }
    this.previousPendingCount = currentPendingCount;

    this.joinRequestsSubject.next(requests);
    try {
      localStorage.setItem(this.STORAGE_KEY, raw);
    } catch (e) {}
  }

  getJoinRequests(): Observable<JoinRequest[]> {
    return this.joinRequestsSubject.asObservable();
  }

  getPendingRequests(): Observable<JoinRequest[]> {
    return this.joinRequestsSubject.pipe(
      map(requests => requests.filter(r => r.status === 'PENDING'))
    );
  }

  getApprovedRequests(): Observable<JoinRequest[]> {
    return this.joinRequestsSubject.pipe(
      map(requests => requests.filter(r => r.status === 'APPROVED'))
    );
  }

  getPendingCount(): Observable<number> {
    return this.getPendingRequests().pipe(
      map(pending => pending.length)
    );
  }

  createRequest(userName: string, targetMeetingId: string, avatarUrl?: string): JoinRequest {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    let current: JoinRequest[] = [];
    if (saved) {
      try { current = JSON.parse(saved); } catch (e) { current = this.joinRequestsSubject.getValue(); }
    } else {
      current = this.joinRequestsSubject.getValue();
    }

    const trimmedName = userName.trim();
    // Check if a request already exists for this userName and targetMeetingId
    const existing = current.find(r => 
      r.userName.trim().toLowerCase() === trimmedName.toLowerCase() && 
      (r.targetMeetingId === targetMeetingId || r.targetMeetingId.includes(targetMeetingId) || targetMeetingId.includes(r.targetMeetingId))
    );

    if (existing) {
      return existing;
    }

    const avatar = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(trimmedName)}&background=E7F1F0&color=0F5A56&bold=true`;

    const newReq: JoinRequest = {
      id: 'req-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userName: trimmedName,
      avatarUrl: avatar,
      targetMeetingTitle: `Sala de reunión (${targetMeetingId})`,
      targetMeetingId: targetMeetingId,
      requestedAt: new Date(),
      status: 'PENDING'
    };

    // Sync to Spring Boot Backend
    this.http.post<any>(this.apiUrl, {
      name: newReq.userName,
      meetingCode: newReq.targetMeetingId,
      meetingTitle: newReq.targetMeetingTitle,
      avatarUrl: newReq.avatarUrl
    }).pipe(
      catchError(() => of(null))
    ).subscribe();

    const updated = [newReq, ...current];
    this.saveToStorage(updated);
    return newReq;
  }

  watchRequest(requestId: string): Observable<JoinRequest | undefined> {
    return this.joinRequestsSubject.pipe(
      map(requests => requests.find(r => r.id === requestId))
    );
  }

  approveRequest(requestId: string): void {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    let current: JoinRequest[] = this.joinRequestsSubject.getValue();
    if (saved) {
      try { current = JSON.parse(saved); } catch (e) {}
    }

    if (requestId.startsWith('backend-')) {
      const numericId = requestId.replace('backend-', '');
      this.http.put(`${this.apiUrl}/${numericId}/approve`, {}).pipe(catchError(() => of(null))).subscribe();
    }

    const updated = current.map(req => {
      if (req.id === requestId) {
        return { ...req, status: 'APPROVED' as const };
      }
      return req;
    });
    this.saveToStorage(updated);
  }

  rejectRequest(requestId: string): void {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    let current: JoinRequest[] = this.joinRequestsSubject.getValue();
    if (saved) {
      try { current = JSON.parse(saved); } catch (e) {}
    }

    if (requestId.startsWith('backend-')) {
      const numericId = requestId.replace('backend-', '');
      this.http.put(`${this.apiUrl}/${numericId}/reject`, {}).pipe(catchError(() => of(null))).subscribe();
    }

    const updated = current.map(req => {
      if (req.id === requestId) {
        return { ...req, status: 'REJECTED' as const };
      }
      return req;
    });
    this.saveToStorage(updated);
  }

  removeApprovedRequest(userName: string, targetMeetingId: string): void {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    let current: JoinRequest[] = this.joinRequestsSubject.getValue();
    if (saved) {
      try { current = JSON.parse(saved); } catch (e) {}
    }

    const cleanName = userName.trim().toLowerCase();
    const updated = current.filter(req => 
      !(req.userName.trim().toLowerCase() === cleanName && 
        (req.targetMeetingId === targetMeetingId || req.targetMeetingId.includes(targetMeetingId) || targetMeetingId.includes(req.targetMeetingId)))
    );
    this.saveToStorage(updated);
  }
}


