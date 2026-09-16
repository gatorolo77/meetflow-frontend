import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { MeetingService } from '../../core/services/meeting.service';
import { Meeting } from '../../core/models/meeting.model';

@Component({
  selector: 'app-agenda',
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.css']
})
export class AgendaComponent implements OnInit {
  upcomingMeetings$: Observable<Meeting[]>;
  showClearModal = false;

  constructor(private meetingService: MeetingService) {
    this.upcomingMeetings$ = this.meetingService.getUpcomingMeetings();
  }

  ngOnInit(): void {}

  onDeleteMeeting(meetingId: string): void {
    this.meetingService.deleteMeeting(meetingId);
  }

  openClearModal(): void {
    this.showClearModal = true;
  }

  closeClearModal(): void {
    this.showClearModal = false;
  }

  confirmClearAgenda(): void {
    this.meetingService.clearAllMeetings();
    this.closeClearModal();
  }

  downloadPdfAndClear(): void {
    this.downloadPdf();
    setTimeout(() => {
      this.confirmClearAgenda();
    }, 600);
  }

  downloadPdf(): void {
    const sub = this.upcomingMeetings$.subscribe(meetings => {
      const dateStr = new Date().toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const timeStr = new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const printWindow = window.open('', '_blank', 'width=900,height=750');
      if (!printWindow) return;

      const rowsHtml = meetings.map((m, i) => `
        <tr>
          <td><strong>${i + 1}</strong></td>
          <td>${m.title} ${m.isLive ? '<span class="badge-live">EN VIVO</span>' : ''}</td>
          <td>${m.groupOrTeam}</td>
          <td>${m.hostName || 'Sergio D.'}</td>
          <td>${m.scheduledTime}</td>
          <td>${m.durationMinutes} min</td>
          <td><code>${m.code || m.id}</code></td>
        </tr>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Agenda de Reuniones - MeetFlow</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 32px;
              color: #1F2937;
              background-color: #FFFFFF;
            }
            .header-banner {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 3px solid #0D5A56;
              padding-bottom: 16px;
              margin-bottom: 20px;
            }
            .brand-name {
              font-size: 26px;
              font-weight: 800;
              color: #0D5A56;
            }
            .brand-name span {
              color: #F59E0B;
            }
            .doc-heading {
              font-size: 16px;
              font-weight: 700;
              color: #4B5563;
              text-align: right;
            }
            .meta-block {
              background-color: #F9FAFB;
              border: 1px solid #E5E7EB;
              border-radius: 8px;
              padding: 12px 16px;
              margin-bottom: 24px;
              font-size: 13px;
              color: #374151;
            }
            .meta-block strong {
              color: #0D5A56;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background-color: #0D5A56;
              color: #FFFFFF;
              font-weight: 700;
              text-align: left;
              padding: 10px 12px;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.03em;
            }
            td {
              padding: 12px;
              border-bottom: 1px solid #E5E7EB;
              font-size: 13px;
            }
            tr:nth-child(even) {
              background-color: #F9FAFB;
            }
            .badge-live {
              background-color: #10B981;
              color: white;
              font-size: 10px;
              font-weight: 800;
              padding: 2px 6px;
              border-radius: 4px;
              margin-left: 6px;
            }
            .empty-text {
              text-align: center;
              padding: 40px;
              color: #6B7280;
              font-style: italic;
            }
            .footer-info {
              margin-top: 40px;
              padding-top: 16px;
              border-top: 1px solid #E5E7EB;
              text-align: center;
              font-size: 11px;
              color: #9CA3AF;
            }
            @media print {
              body { padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <div class="brand-name">Meet<span>Flow</span></div>
            <div class="doc-heading">Reporte Oficial de Agenda de Reuniones</div>
          </div>

          <div class="meta-block">
            <div><strong>Fecha de Emisión:</strong> ${dateStr} - ${timeStr}</div>
            <div><strong>Total de reuniones registradas:</strong> ${meetings.length}</div>
          </div>

          ${meetings.length === 0 ? `
            <div class="empty-text">No hay reuniones programadas en la agenda actualmente.</div>
          ` : `
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Título de la Reunión</th>
                  <th>Equipo / Grupo</th>
                  <th>Anfitrión</th>
                  <th>Horario / Fecha</th>
                  <th>Duración</th>
                  <th>Código de Reunión</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          `}

          <div class="footer-info">
            Documento generado automáticamente desde la plataforma MeetFlow.
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
    });
    sub.unsubscribe();
  }
}
