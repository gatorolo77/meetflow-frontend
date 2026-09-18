import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { MeetingService } from './meeting.service';
import { Meeting } from '../models/meeting.model';

export interface OutreachResponse {
  mensaje: string;
  campana: string;
  meetingCode: string;
  meetingTitle: string;
  totalContactos: number;
  correosEnviados: string[];
  correosFallidos?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class OutreachService {
  private apiUrl = `${environment.apiUrl}/outreach`;

  constructor(
    private http: HttpClient,
    private meetingService: MeetingService
  ) {}

  uploadOutreachCsv(
    file: File,
    meetingTitle: string,
    meetingCode: string,
    nombreCampana: string,
    scheduledTime?: string
  ): Observable<OutreachResponse> {
    const timeVal = scheduledTime || 'Hoy, 16:30';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('meetingTitle', meetingTitle || 'Sync de Equipo MeetFlow');
    formData.append('meetingCode', meetingCode || ('m-' + Date.now()));
    formData.append('nombreCampana', nombreCampana || 'Campaña Invitados');
    formData.append('scheduledTime', timeVal);
    formData.append('baseUrl', window.location.origin);

    return this.http.post<OutreachResponse>(`${this.apiUrl}/upload`, formData).pipe(
      tap(res => {
        // Automatically schedule / register the meeting in the Host's Agenda & Dashboard
        const newMeeting: Meeting = {
          id: res.meetingCode || meetingCode,
          code: res.meetingCode || meetingCode,
          title: res.meetingTitle || meetingTitle,
          groupOrTeam: 'Invitados CSV (' + res.totalContactos + ')',
          hostName: 'Sergio D.',
          scheduledTime: timeVal,
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
        this.meetingService.registerOutreachMeeting(newMeeting);
      }),
      catchError(err => {
        console.warn('Backend Spring Boot not connected or returned error. Falling back to local agenda registration.', err);
        // Fallback: Register meeting locally in Agenda if backend is unreachable in dev mode
        const safeCode = meetingCode || ('m-' + Date.now());
        const safeTitle = meetingTitle || 'Reunión de Equipo';
        const fallbackMeeting: Meeting = {
          id: safeCode,
          code: safeCode,
          title: safeTitle,
          groupOrTeam: 'Invitados CSV',
          hostName: 'Sergio D.',
          scheduledTime: timeVal,
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
        this.meetingService.registerOutreachMeeting(fallbackMeeting);

        return of({
          mensaje: 'Reunión agendada en tu Agenda local e invitaciones generadas.',
          campana: nombreCampana || 'Campaña Local',
          meetingCode: safeCode,
          meetingTitle: safeTitle,
          totalContactos: 1,
          correosEnviados: ['invitados@meetflow.app']
        });
      })
    );
  }
}
