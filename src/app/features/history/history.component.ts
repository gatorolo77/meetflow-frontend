import { Component } from '@angular/core';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css']
})
export class HistoryComponent {
  pastMeetings = [
    { title: 'Reunión de Equipo Q2', date: 'Ayer, 16:00', duration: '52 min', participants: 6, code: 'team-q2-sync' },
    { title: 'Demostración de Producto', date: '28 de Agosto, 11:30', duration: '40 min', participants: 4, code: 'demo-prod-v1' },
    { title: 'Reunión de Feedback UX', date: '25 de Agosto, 15:00', duration: '35 min', participants: 5, code: 'ux-review-meet' }
  ];
}
