import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Meeting, LiveMeetingMetrics } from '../models/meeting.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MeetingService {
  private apiUrl = `${environment.apiUrl}/meetings`;

  private upcomingMeetingsSubject = new BehaviorSubject<Meeting[]>([
    {
      id: 'm-101',
      code: 'team-dev-2026',
      title: 'Reunión de equipo',
      groupOrTeam: 'Equipo de Desarrollo',
      hostName: 'Sergio D.',
      scheduledTime: 'Hoy, 15:30',
      durationMinutes: 45,
      isLive: true,
      participants: [
        { id: 'u1', name: 'Ana García', role: 'PARTICIPANT', isMicActive: true, isCameraActive: true, isSharingScreen: false, connectionQuality: 'EXCELLENT', joinedAt: new Date() },
        { id: 'u2', name: 'Diego Morales', role: 'PARTICIPANT', isMicActive: true, isCameraActive: true, isSharingScreen: true, connectionQuality: 'EXCELLENT', joinedAt: new Date() },
        { id: 'u3', name: 'Lucía Fernández', role: 'PARTICIPANT', isMicActive: false, isCameraActive: true, isSharingScreen: false, connectionQuality: 'GOOD', joinedAt: new Date() },
        { id: 'u4', name: 'Martín López', role: 'PARTICIPANT', isMicActive: true, isCameraActive: false, isSharingScreen: false, connectionQuality: 'EXCELLENT', joinedAt: new Date() }
      ]
    },
    {
      id: 'm-102',
      code: 'client-a-pres',
      title: 'Presentación a cliente',
      groupOrTeam: 'Cliente A',
      hostName: 'Sergio D.',
      scheduledTime: 'Mañana, 10:00',
      durationMinutes: 60,
      isLive: false,
      participants: [
        { id: 'u1', name: 'Ana García', role: 'PARTICIPANT', isMicActive: false, isCameraActive: false, isSharingScreen: false, connectionQuality: 'EXCELLENT', joinedAt: new Date() },
        { id: 'u5', name: 'Carlos Ruiz', role: 'PARTICIPANT', isMicActive: false, isCameraActive: false, isSharingScreen: false, connectionQuality: 'EXCELLENT', joinedAt: new Date() }
      ]
    },
    {
      id: 'm-103',
      code: 'phoenix-rev',
      title: 'Revisión de proyecto',
      groupOrTeam: 'Proyecto Phoenix',
      hostName: 'Sergio D.',
      scheduledTime: 'Vie, 13 Jun',
      durationMinutes: 30,
      isLive: false,
      participants: [
        { id: 'u2', name: 'Diego Morales', role: 'PARTICIPANT', isMicActive: false, isCameraActive: false, isSharingScreen: false, connectionQuality: 'EXCELLENT', joinedAt: new Date() },
        { id: 'u3', name: 'Lucía Fernández', role: 'PARTICIPANT', isMicActive: false, isCameraActive: false, isSharingScreen: false, connectionQuality: 'EXCELLENT', joinedAt: new Date() },
        { id: 'u4', name: 'Martín López', role: 'PARTICIPANT', isMicActive: false, isCameraActive: false, isSharingScreen: false, connectionQuality: 'EXCELLENT', joinedAt: new Date() }
      ]
    }
  ]);

  private liveMetricsSubject = new BehaviorSubject<LiveMeetingMetrics>({
    connectedParticipants: 8,
    activeMicrophones: 5,
    activeCameras: 6,
    screenShares: 2,
    connectionQualityLabel: 'Óptima (Excelente)'
  });

  constructor(private http: HttpClient) {
    this.loadFromStorage();
    this.refreshMeetingsFromBackend();
  }

  private loadFromStorage(): void {
    const saved = localStorage.getItem('meetflow_upcoming_meetings');
    if (saved) {
      try {
        const meetings = JSON.parse(saved);
        this.upcomingMeetingsSubject.next(meetings);
      } catch (e) {
        this.saveToStorage(this.upcomingMeetingsSubject.getValue());
      }
    } else {
      this.saveToStorage(this.upcomingMeetingsSubject.getValue());
    }
  }

  private saveToStorage(meetings: Meeting[]): void {
    localStorage.setItem('meetflow_upcoming_meetings', JSON.stringify(meetings));
  }

  refreshMeetingsFromBackend(): void {
    this.http.get<any[]>(this.apiUrl).pipe(
      tap(backendRooms => {
        if (backendRooms && backendRooms.length > 0) {
          const mapped: Meeting[] = backendRooms.map(r => ({
            id: r.code || ('m-' + r.id),
            code: r.code,
            title: r.title,
            groupOrTeam: r.teamName || 'General',
            hostName: r.hostName || 'Sergio D.',
            scheduledTime: 'En curso',
            durationMinutes: 60,
            isLive: r.isLive,
            participants: [
              { id: 'u1', name: 'Ana García', role: 'PARTICIPANT', isMicActive: true, isCameraActive: true, isSharingScreen: false, connectionQuality: 'EXCELLENT', joinedAt: new Date() },
              { id: 'u2', name: 'Diego Morales', role: 'PARTICIPANT', isMicActive: true, isCameraActive: true, isSharingScreen: true, connectionQuality: 'EXCELLENT', joinedAt: new Date() }
            ]
          }));
          this.upcomingMeetingsSubject.next(mapped);
          this.saveToStorage(mapped);
        }
      }),
      catchError(err => {
        console.log('Backend Spring Boot not connected yet. Using fallback mock meetings.');
        return of([]);
      })
    ).subscribe();
  }

  getUpcomingMeetings(): Observable<Meeting[]> {
    return this.upcomingMeetingsSubject.asObservable();
  }

  getLiveMetrics(): Observable<LiveMeetingMetrics> {
    return this.liveMetricsSubject.asObservable();
  }

  createMeeting(title: string, groupOrTeam: string): Meeting {
    const randomCode = Math.random().toString(36).substring(2, 7) + '-' + Math.random().toString(36).substring(2, 6);
    const newMeeting: Meeting = {
      id: 'm-' + Date.now(),
      code: randomCode,
      title: title || 'Nueva Reunión MeetFlow',
      groupOrTeam: groupOrTeam || 'Equipo General',
      hostName: 'Sergio D.',
      scheduledTime: 'Ahora mismo',
      durationMinutes: 60,
      isLive: true,
      participants: [
        {
          id: 'host-1',
          name: 'Sergio D.',
          role: 'HOST',
          isMicActive: true,
          isCameraActive: true,
          isSharingScreen: false,
          connectionQuality: 'EXCELLENT',
          joinedAt: new Date()
        }
      ]
    };

    // Attempt POST to Spring Boot Backend
    this.http.post<any>(this.apiUrl, {
      title: newMeeting.title,
      team: newMeeting.groupOrTeam,
      hostName: newMeeting.hostName,
      code: newMeeting.id
    }).pipe(
      catchError(() => of(null))
    ).subscribe();

    const current = this.upcomingMeetingsSubject.getValue();
    const updated = [newMeeting, ...current];
    this.upcomingMeetingsSubject.next(updated);
    this.saveToStorage(updated);
    return newMeeting;
  }

  endMeeting(meetingCode: string): void {
    this.http.put(`${this.apiUrl}/${meetingCode}/end`, {}).pipe(
      catchError(() => of(null))
    ).subscribe();

    const current = this.upcomingMeetingsSubject.getValue();
    const updated = current.map(m => {
      if (m.id === meetingCode || m.code === meetingCode) {
        return { ...m, isLive: false };
      }
      return m;
    });
    this.upcomingMeetingsSubject.next(updated);
    this.saveToStorage(updated);
  }

  registerOutreachMeeting(meeting: Meeting): void {
    const current = this.upcomingMeetingsSubject.getValue();
    let updated: Meeting[];
    const existingIndex = current.findIndex(m => m.id === meeting.id || m.code === meeting.code);
    if (existingIndex >= 0) {
      current[existingIndex] = meeting;
      updated = [...current];
    } else {
      updated = [meeting, ...current];
    }
    this.upcomingMeetingsSubject.next(updated);
    this.saveToStorage(updated);
  }

  deleteMeeting(meetingId: string): void {
    const current = this.upcomingMeetingsSubject.getValue();
    const updated = current.filter(m => m.id !== meetingId && m.code !== meetingId);
    this.upcomingMeetingsSubject.next(updated);
    this.saveToStorage(updated);
  }

  clearAllMeetings(): void {
    this.upcomingMeetingsSubject.next([]);
    this.saveToStorage([]);
  }
}
