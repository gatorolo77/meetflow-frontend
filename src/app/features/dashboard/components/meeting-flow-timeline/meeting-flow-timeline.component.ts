import { Component } from '@angular/core';

export interface FlowStep {
  stepNumber: number;
  title: string;
  description: string;
  colorClass: string;
  iconType: string;
}

@Component({
  selector: 'app-meeting-flow-timeline',
  templateUrl: './meeting-flow-timeline.component.html',
  styleUrls: ['./meeting-flow-timeline.component.css']
})
export class MeetingFlowTimelineComponent {
  steps: FlowStep[] = [
    { stepNumber: 1, title: 'Creación de sala', description: 'El anfitrión crea la reunión.', colorClass: 'step-1', iconType: 'plus' },
    { stepNumber: 2, title: 'Generación de enlace', description: 'Comparte el enlace con los participantes.', colorClass: 'step-2', iconType: 'link' },
    { stepNumber: 3, title: 'Solicitud de ingreso', description: 'Los participantes solicitan unirse.', colorClass: 'step-3', iconType: 'user-plus' },
    { stepNumber: 4, title: 'Aprobación', description: 'El anfitrión aprueba o rechaza el acceso.', colorClass: 'step-4', iconType: 'check' },
    { stepNumber: 5, title: 'Reunión', description: 'Comunicación en tiempo real (audio, video, chat).', colorClass: 'step-5', iconType: 'video' },
    { stepNumber: 6, title: 'Reconexión', description: 'El sistema mantiene el estado ante interrupciones.', colorClass: 'step-6', iconType: 'refresh' },
    { stepNumber: 7, title: 'Finalización', description: 'La reunión finaliza.', colorClass: 'step-7', iconType: 'square' },
    { stepNumber: 8, title: 'Historial', description: 'La reunión queda registrada y disponible.', colorClass: 'step-8', iconType: 'clock' }
  ];
}
