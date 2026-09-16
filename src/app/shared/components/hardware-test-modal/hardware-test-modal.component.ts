import { Component, EventEmitter, Input, OnInit, OnDestroy, Output, ElementRef, ViewChild } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-hardware-test-modal',
  templateUrl: './hardware-test-modal.component.html',
  styleUrls: ['./hardware-test-modal.component.css']
})
export class HardwareTestModalComponent implements OnInit, OnDestroy {
  @Input() meetingCode = 'm-101';
  @Input() meetingTitle = 'Reunión de equipo - Sync Diario';
  @Input() guestName = '';
  
  @Output() confirmed = new EventEmitter<{ micEnabled: boolean; camEnabled: boolean; guestName?: string }>();
  @Output() canceled = new EventEmitter<void>();

  @ViewChild('videoPreview', { static: false }) videoPreview!: ElementRef<HTMLVideoElement>;

  stream: MediaStream | null = null;
  isMicActive = true;
  isCamActive = true;
  audioLevel = 0; // 0 to 100%

  userAvatarUrl = 'https://ui-avatars.com/api/?name=Usuario&background=0D5A56&color=ffffff';
  userName = 'Usuario';
  userNameInput = '';

  availableCams: MediaDeviceInfo[] = [];
  availableMics: MediaDeviceInfo[] = [];
  selectedCamId = '';
  selectedMicId = '';

  private audioContext: AudioContext | null = null;
  private animFrameId: number | null = null;

  constructor(private authService: AuthService) {}

  async ngOnInit(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (this.guestName && this.guestName.trim()) {
      this.userNameInput = this.guestName.trim();
    } else if (user && user.name) {
      this.userNameInput = user.name;
    }

    this.updateUserAvatar();
    await this.loadDevices();
    await this.startHardwareTest();
  }

  onNameChanged(): void {
    this.updateUserAvatar();
  }

  private updateUserAvatar(): void {
    if (this.userNameInput.trim()) {
      this.userName = this.userNameInput.trim();
      this.userAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userName)}&background=0D5A56&color=ffffff&bold=true`;
    }
  }

  ngOnDestroy(): void {
    this.stopHardwareTest();
  }

  async loadDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableCams = devices.filter(d => d.kind === 'videoinput');
      this.availableMics = devices.filter(d => d.kind === 'audioinput');
      if (this.availableCams.length > 0) this.selectedCamId = this.availableCams[0].deviceId;
      if (this.availableMics.length > 0) this.selectedMicId = this.availableMics[0].deviceId;
    } catch (e) {
      console.warn('Enumerate devices failed', e);
    }
  }

  async startHardwareTest(): Promise<void> {
    this.stopHardwareTest();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: this.isCamActive ? (this.selectedCamId ? { deviceId: this.selectedCamId } : true) : false,
        audio: this.isMicActive ? (this.selectedMicId ? { deviceId: this.selectedMicId } : true) : false
      });

      if (this.videoPreview && this.stream && this.isCamActive) {
        this.videoPreview.nativeElement.srcObject = this.stream;
      }

      if (this.isMicActive && this.stream.getAudioTracks().length > 0) {
        this.setupAudioMeter(this.stream);
      }
    } catch (err) {
      console.warn('Could not access camera/mic for test', err);
    }
  }

  private setupAudioMeter(stream: MediaStream): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyzer = this.audioContext.createAnalyser();
      const microphone = this.audioContext.createMediaStreamSource(stream);
      const javascriptNode = this.audioContext.createScriptProcessor(2048, 1, 1);

      analyzer.smoothingTimeConstant = 0.8;
      analyzer.fftSize = 1024;

      microphone.connect(analyzer);
      analyzer.connect(javascriptNode);
      javascriptNode.connect(this.audioContext.destination);

      javascriptNode.onaudioprocess = () => {
        const array = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(array);
        let values = 0;
        const length = array.length;
        for (let i = 0; i < length; i++) {
          values += array[i];
        }
        const average = values / length;
        this.audioLevel = Math.min(100, Math.round((average / 128) * 100));
      };
    } catch (e) {
      console.warn('Audio meter setup failed', e);
    }
  }

  toggleMic(): void {
    this.isMicActive = !this.isMicActive;
    if (this.stream) {
      this.stream.getAudioTracks().forEach(t => t.enabled = this.isMicActive);
    }
  }

  toggleCam(): void {
    this.isCamActive = !this.isCamActive;
    if (this.stream) {
      this.stream.getVideoTracks().forEach(t => t.enabled = this.isCamActive);
    }
  }

  stopHardwareTest(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  onJoinConfirmed(): void {
    if (!this.userNameInput || !this.userNameInput.trim()) {
      alert('Por favor, ingresa tu nombre completo para unirte a la sala.');
      return;
    }
    const finalName = this.userNameInput.trim();
    this.stopHardwareTest();
    this.confirmed.emit({ 
      micEnabled: this.isMicActive, 
      camEnabled: this.isCamActive,
      guestName: finalName
    });
  }

  onCancel(): void {
    this.stopHardwareTest();
    this.canceled.emit();
  }

  openExternalTest(): void {
    window.open('https://screendesk.io/webcam-mic-test', '_blank', 'noopener,noreferrer');
  }
}
