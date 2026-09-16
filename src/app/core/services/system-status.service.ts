import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SystemHealthSummary } from '../models/system-status.model';
import { ActivityLogItem } from '../models/activity-log.model';

@Injectable({
  providedIn: 'root'
})
export class SystemStatusService {
  private systemHealthSubject = new BehaviorSubject<SystemHealthSummary>({
    overallOperational: true,
    services: [
      { id: 's1', name: 'Conexión en tiempo real', status: 'OPTIMAL', statusText: 'Óptimo', icon: 'activity' },
      { id: 's2', name: 'Servidores de señalización', status: 'OPTIMAL', statusText: 'Óptimo', icon: 'server' },
      { id: 's3', name: 'Transferencia de medios', status: 'OPTIMAL', statusText: 'Óptimo', icon: 'radio' },
      { id: 's4', name: 'Chat en tiempo real', status: 'OPTIMAL', statusText: 'Óptimo', icon: 'message-square' }
    ]
  });

  private recentActivitySubject = new BehaviorSubject<ActivityLogItem[]>([
    { id: 'a1', type: 'JOIN_REQUEST', description: 'Ana García solicitó unirse a "Reunión de equipo"', timestampRelative: 'Hace 2 min', iconType: 'check-circle' },
    { id: 'a2', type: 'MEETING_CREATED', description: 'Reunión "Presentación a cliente" creada', timestampRelative: 'Hace 15 min', iconType: 'video' },
    { id: 'a3', type: 'USER_ADMITTED', description: 'Rodrigo Pérez fue admitido en "Reunión de proyecto"', timestampRelative: 'Hace 32 min', iconType: 'user-check' },
    { id: 'a4', type: 'CHAT_MESSAGE', description: 'Martín López envió un mensaje en "Reunión de equipo"', timestampRelative: 'Hace 45 min', iconType: 'message-square' }
  ]);

  getSystemHealth(): Observable<SystemHealthSummary> {
    return this.systemHealthSubject.asObservable();
  }

  getRecentActivity(): Observable<ActivityLogItem[]> {
    return this.recentActivitySubject.asObservable();
  }
}
