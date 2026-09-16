import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { OutreachService, OutreachResponse } from '../../../../core/services/outreach.service';
import { MeetingService } from '../../../../core/services/meeting.service';
import { Meeting } from '../../../../core/models/meeting.model';

@Component({
  selector: 'app-outreach-modal',
  templateUrl: './outreach-modal.component.html',
  styleUrls: ['./outreach-modal.component.css']
})
export class OutreachModalComponent implements OnInit {
  @Output() closed = new EventEmitter<void>();

  meetingTitle = 'Sync Diario de Desarrollo';
  meetingCode = '';
  campaignName = 'Lote Invitados Especiales';
  scheduledTime = 'Hoy, 16:30';
  
  selectedFile: File | null = null;
  fileDragOver = false;

  isSubmitting = false;
  errorMessage = '';
  successResponse: OutreachResponse | null = null;

  existingMeetings: Meeting[] = [];

  constructor(
    private outreachService: OutreachService,
    private meetingService: MeetingService
  ) {}

  ngOnInit(): void {
    this.meetingService.getUpcomingMeetings().subscribe(meetings => {
      this.existingMeetings = meetings;
    });
    this.meetingCode = 'm-' + Math.floor(100 + Math.random() * 900);
  }

  selectExistingMeeting(m: Meeting): void {
    this.meetingTitle = m.title;
    this.meetingCode = m.code || m.id;
    if (m.scheduledTime) {
      this.scheduledTime = m.scheduledTime;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      this.errorMessage = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.fileDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.fileDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.fileDragOver = false;
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
      const file = event.dataTransfer.files[0];
      if (file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text')) {
        this.selectedFile = file;
        this.errorMessage = '';
      } else {
        this.errorMessage = 'Por favor, selecciona un archivo válido con extensión .csv';
      }
    }
  }

  removeSelectedFile(): void {
    this.selectedFile = null;
  }

  onSubmitOutreach(): void {
    this.errorMessage = '';

    if (!this.meetingTitle.trim()) {
      this.errorMessage = 'Por favor, ingresa el título de la reunión.';
      return;
    }

    if (!this.meetingCode.trim()) {
      this.errorMessage = 'Por favor, ingresa o genera un código para la reunión.';
      return;
    }

    if (!this.selectedFile) {
      this.errorMessage = 'Por favor, selecciona o arrastra un archivo .csv con la lista de invitados.';
      return;
    }

    this.isSubmitting = true;

    this.outreachService.uploadOutreachCsv(
      this.selectedFile,
      this.meetingTitle.trim(),
      this.meetingCode.trim(),
      this.campaignName.trim(),
      this.scheduledTime.trim()
    ).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.successResponse = res;
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = 'Error al enviar las invitaciones. Verifica el archivo CSV e intenta de nuevo.';
      }
    });
  }

  onClose(): void {
    this.closed.emit();
  }
}
