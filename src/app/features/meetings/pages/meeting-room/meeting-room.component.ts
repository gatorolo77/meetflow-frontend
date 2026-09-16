import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { WebRtcService, RemotePeerStream } from '../../../../core/services/webrtc.service';
import { AuthService } from '../../../../core/services/auth.service';
import { JoinRequestService } from '../../../../core/services/join-request.service';
import { MeetingService } from '../../../../core/services/meeting.service';
import { JoinRequest } from '../../../../core/models/join-request.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-meeting-room',
  templateUrl: './meeting-room.component.html',
  styleUrls: ['./meeting-room.component.css']
})
export class MeetingRoomComponent implements OnInit, OnDestroy {
  meetingId = '8f3a7c2d-9b11-4e55-9c22-33f4d5e6a77b';
  meetingTitle = 'Sprint semanal';
  timerText = '00:14:32';

  isMicMuted = false;
  isCameraOff = false;
  isSharingScreen = false;
  showParticipants = false;
  showChat = false;
  showWaitingRoomPanel = false;

  spotlightParticipant: any = null;

  localStream: MediaStream | null = null;
  remoteStreams: RemotePeerStream[] = [];
  copiedCodeSuccess = false;

  pendingRequestsForRoom: JoinRequest[] = [];
  private subs: Subscription[] = [];

  chatMessages = [
    { sender: 'Ana García', time: '10:12', text: '¡Hola a todos! ¿Listos para comenzar?', isMe: false },
    { sender: 'Rodrigo Pérez', time: '10:13', text: 'Sí, yo estoy listo.', isMe: false },
    { sender: 'Martín López', time: '10:14', text: 'Perfecto, ya comparto la pantalla.', isMe: false },
    { sender: 'Sergio D.', time: '10:15', text: 'Genial. ¿Alguien tiene algún punto para sumar a la reunión?', isMe: true }
  ];
  newMessage = '';

  participantsList: any[] = [
    { name: 'Sergio D.', role: 'Anfitrión', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', isMic: true, isCam: true }
  ];

  showMeetingEndedModal = false;
  isHostEnding = false;
  private endCheckInterval: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private webrtcService: WebRtcService,
    private authService: AuthService,
    private joinRequestService: JoinRequestService,
    private meetingService: MeetingService
  ) {}

  async ngOnInit(): Promise<void> {
    const routeId = this.route.snapshot.paramMap.get('id');
    if (routeId) {
      this.meetingId = routeId;
    }

    // Resolver avatar y datos reales del Anfitrión desde AuthService
    this.syncHostProfile();
    
    // Asignar al anfitrión en primer plano en Spotlight por defecto
    this.spotlightParticipant = this.hostParticipant;
    this.loadSpotlight();
    this.updateMicrophoneStates();
    
    // 1. Initialize camera & mic for WebRTC
    this.localStream = await this.webrtcService.initLocalMedia(true, true);

    // 2. Connect WebRTC signaling P2P
    this.webrtcService.joinRoom(this.meetingId);

    // 3. Subscribe to WebRTC streams, pending requests, and meeting ended signals
    this.subs.push(
      this.webrtcService.localStream$.subscribe(stream => this.localStream = stream),
      this.webrtcService.remoteStreams$.subscribe(remotes => this.remoteStreams = remotes),
      this.authService.currentUser$.subscribe(user => {
        if (user) {
          const isUserHost = user.role === 'Anfitrión';
          if (isUserHost) {
            const host = this.participantsList.find(p => p.role === 'Anfitrión');
            if (host) {
              if (user.name) host.name = user.name;
              if (user.avatarUrl) host.avatar = user.avatarUrl;
            }
          } else {
            // Current user is a GUEST: ensure Host keeps their real profile picture
            this.syncHostProfile();

            const guestName = user.name || 'Invitado';
            let guestPart = this.participantsList.find(p => p.name === guestName);
            if (!guestPart) {
              this.participantsList.push({
                name: guestName,
                role: 'Invitado',
                avatar: user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(guestName)}&background=0284C7&color=ffffff&bold=true`,
                isMic: false,
                isCam: true
              });
            }
          }

          this.chatMessages.forEach(msg => {
            if (msg.isMe && user.name) {
              msg.sender = user.name;
            }
          });
        }
      }),
      this.joinRequestService.getPendingRequests().subscribe(requests => {
        this.pendingRequestsForRoom = requests.filter(r => 
          r.targetMeetingId === this.meetingId || 
          r.targetMeetingId.includes(this.meetingId) || 
          this.meetingId.includes(r.targetMeetingId)
        );
      }),
      this.joinRequestService.getApprovedRequests().subscribe(approvedList => {
        const roomApproved = approvedList.filter(r => 
          r.targetMeetingId === this.meetingId || 
          r.targetMeetingId.includes(this.meetingId) || 
          this.meetingId.includes(r.targetMeetingId)
        );

        roomApproved.forEach(req => {
          const existing = this.participantsList.find(p => p.name.trim().toLowerCase() === req.userName.trim().toLowerCase());
          if (!existing) {
            this.participantsList.push({
              name: req.userName,
              role: 'Invitado',
              avatar: req.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.userName)}&background=0284C7&color=ffffff&bold=true`,
              isMic: false,
              isCam: true
            });
          }
        });
        this.updateMicrophoneStates();
      }),
      this.webrtcService.meetingEnded$.subscribe(code => {
        if (code === this.meetingId || this.meetingId.includes(code)) {
          this.handleRoomEndedNotification();
        }
      })
    );

    // Cargar cola de turnos y foco al iniciar
    this.loadSpeakQueue();
    this.loadSpotlight();

    // Listen to native window storage events from other tabs
    window.addEventListener('storage', (event) => {
      if (event.key === 'meetflow_meeting_ended_' + this.meetingId) {
        this.handleRoomEndedNotification();
      }
      if (event.key === 'meetflow_speak_queue_' + this.meetingId) {
        this.loadSpeakQueue();
      }
      if (event.key === 'meetflow_spotlight_' + this.meetingId) {
        this.loadSpotlight();
      }
      if (event.key === 'meetflow_host_profile' || event.key === 'meetflow_auth_user') {
        this.syncHostProfile();
      }
      if (event.key === 'meetflow_guest_left_' + this.meetingId) {
        this.handleGuestLeftNotification();
      }
    });

    // Fallback periodic check for cross-tab host ending, speakQueue, spotlight, host avatar & guest departure updates
    this.endCheckInterval = setInterval(() => {
      if (localStorage.getItem('meetflow_meeting_ended_' + this.meetingId)) {
        this.handleRoomEndedNotification();
      }
      this.loadSpeakQueue();
      this.loadSpotlight();
      this.syncHostProfile();
      this.handleGuestLeftNotification();
    }, 1000);
  }

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    if (this.authService.isGuest()) {
      this.notifyGuestLeft(this.currentUserName);
    }
  }

  ngOnDestroy(): void {
    if (this.endCheckInterval) {
      clearInterval(this.endCheckInterval);
    }
    if (this.authService.isGuest()) {
      this.notifyGuestLeft(this.currentUserName);
    }
    this.subs.forEach(s => s.unsubscribe());
    this.webrtcService.leaveRoom();
  }

  handleRoomEndedNotification(): void {
    this.showMeetingEndedModal = true;
    this.webrtcService.leaveRoom();
  }

  notifyGuestLeft(guestName: string): void {
    if (!guestName || guestName === 'Anfitrión') return;
    const data = { name: guestName, timestamp: Date.now() };
    localStorage.setItem('meetflow_guest_left_' + this.meetingId, JSON.stringify(data));
    this.joinRequestService.removeApprovedRequest(guestName, this.meetingId);
    this.removeParticipantByName(guestName);
  }

  handleGuestLeftNotification(): void {
    const saved = localStorage.getItem('meetflow_guest_left_' + this.meetingId);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data && data.name) {
          this.removeParticipantByName(data.name);
        }
      } catch (e) {}
    }
  }

  removeParticipantByName(name: string): void {
    const cleanName = name.trim().toLowerCase();
    const initialLen = this.participantsList.length;
    this.participantsList = this.participantsList.filter(p => p.name.trim().toLowerCase() !== cleanName);

    // If spotlight was on the participant who left, reset spotlight to host
    if (this.spotlightParticipant && this.spotlightParticipant.name.trim().toLowerCase() === cleanName) {
      this.spotlightParticipant = this.hostParticipant;
      if (this.isHost) {
        localStorage.setItem('meetflow_spotlight_' + this.meetingId, JSON.stringify(this.hostParticipant.name));
      }
    }

    // Remove from speak queue if present
    const qIdx = this.speakQueue.findIndex(nameInQueue => nameInQueue.trim().toLowerCase() === cleanName);
    if (qIdx > -1) {
      this.speakQueue.splice(qIdx, 1);
      this.syncSpeakQueue();
    }

    if (this.participantsList.length !== initialLen) {
      this.updateMicrophoneStates();
    }
  }

  leaveMeeting(): void {
    if (!this.authService.isGuest()) {
      // Host ends the meeting for everyone
      this.webrtcService.endMeeting(this.meetingId);
      localStorage.setItem('meetflow_meeting_ended_' + this.meetingId, Date.now().toString());
      this.meetingService.endMeeting(this.meetingId);
      this.webrtcService.leaveRoom();
      this.router.navigate(['/dashboard']);
    } else {
      // Guest leaves individually
      const guestName = this.currentUserName;
      this.notifyGuestLeft(guestName);
      this.webrtcService.leaveRoom();
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }

  confirmMeetingEnded(): void {
    this.webrtcService.leaveRoom();
    if (this.authService.isGuest()) {
      this.authService.logout();
      this.router.navigate(['/login']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  copyMeetingCode(): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(this.meetingId).then(() => {
        this.copiedCodeSuccess = true;
        setTimeout(() => {
          this.copiedCodeSuccess = false;
        }, 2000);
      });
    }
  }

  admitGuest(requestId: string): void {
    const req = this.pendingRequestsForRoom.find(r => r.id === requestId);
    if (req) {
      this.participantsList.push({
        name: req.userName,
        role: 'Invitado',
        avatar: req.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.userName)}&background=0284C7&color=ffffff&bold=true`,
        isMic: false,
        isCam: true
      });
      this.updateMicrophoneStates();
    }
    this.joinRequestService.approveRequest(requestId);
  }

  rejectGuest(requestId: string): void {
    this.joinRequestService.rejectRequest(requestId);
  }

  toggleMic(): void {
    this.isMicMuted = !this.isMicMuted;
    this.webrtcService.toggleMicrophone(!this.isMicMuted);
    this.updateMicrophoneStates();
  }

  toggleCamera(): void {
    this.isCameraOff = !this.isCameraOff;
    this.webrtcService.toggleCamera(!this.isCameraOff);
    this.participantsList[0].isCam = !this.isCameraOff;
  }

  toggleScreenShare(): void {
    this.isSharingScreen = !this.isSharingScreen;
  }

  toggleParticipants(): void {
    this.showParticipants = !this.showParticipants;
  }

  toggleChat(): void {
    this.showChat = !this.showChat;
  }

  toggleWaitingRoom(): void {
    this.showWaitingRoomPanel = !this.showWaitingRoomPanel;
  }

  sendMessage(): void {
    if (this.newMessage.trim()) {
      this.chatMessages.push({
        sender: 'Sergio D.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: this.newMessage.trim(),
        isMe: true
      });
      this.newMessage = '';
    }
  }

  // Nombre del usuario actual en la sesión
  get currentUserName(): string {
    const user = this.authService.getCurrentUser();
    if (user && user.name) {
      return user.name;
    }
    return this.authService.isGuest() ? 'Invitado' : 'Sergio D.';
  }

  // Obtener el stream de la cámara web para el participante (o nulo si la cámara está apagada/stream no disponible)
  getParticipantStream(participant: any): MediaStream | null {
    if (!participant) return null;

    // Si es el usuario actual en la sesión
    if (participant.name === this.currentUserName) {
      return (!this.isCameraOff && this.localStream) ? this.localStream : null;
    }

    // Si es el anfitrión y el usuario actual es el anfitrión
    if (participant.role === 'Anfitrión' && this.isHost) {
      return (!this.isCameraOff && this.localStream) ? this.localStream : null;
    }

    // Si tiene un stream de video directo asignado
    if (participant.stream) {
      return participant.stream;
    }

    // Buscar en los streams remotos P2P recibidos vía WebRTC
    const remote = this.remoteStreams.find(r => r.peerId === participant.id || r.peerId === participant.name);
    if (remote && remote.stream) {
      return remote.stream;
    }

    return null;
  }

  // Cola de turnos para pedir la palabra (nombres de invitados en orden cronológico)
  speakQueue: string[] = [];

  // Alternar pedido de palabra para el usuario actual (desde su propio botón)
  toggleMyRequestToSpeak(): void {
    if (this.isHost) return; // El anfitrión no requiere pedir la palabra
    this.toggleRequestToSpeak(this.currentUserName);
  }

  // Solicitar o alternar turno para pedir la palabra
  toggleRequestToSpeak(guestName: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const index = this.speakQueue.indexOf(guestName);
    if (index > -1) {
      this.speakQueue.splice(index, 1);
    } else {
      this.speakQueue.push(guestName);
    }
    this.syncSpeakQueue();
  }

  private syncSpeakQueue(): void {
    try {
      localStorage.setItem('meetflow_speak_queue_' + this.meetingId, JSON.stringify(this.speakQueue));
    } catch (e) {}
  }

  private loadSpeakQueue(): void {
    try {
      const saved = localStorage.getItem('meetflow_speak_queue_' + this.meetingId);
      if (saved) {
        this.speakQueue = JSON.parse(saved);
      }
    } catch (e) {}
  }

  // Obtener posición en la cola de turnos (1-based, 0 si no solicitó)
  getQueuePosition(guestName: string): number {
    const index = this.speakQueue.indexOf(guestName);
    return index > -1 ? index + 1 : 0;
  }

  // Obtener el color del degradé según el turno (1º: Rojo, 2º: Naranja, 3º+: Ámbar/Amarillo)
  getQueueColor(guestName: string): string {
    const pos = this.getQueuePosition(guestName);
    if (pos === 1) return '#EF4444'; // 1º: Rojo brillante
    if (pos === 2) return '#F97316'; // 2º: Naranja intenso
    if (pos === 3) return '#F59E0B'; // 3º: Naranja-Amarillo (Ámbar)
    if (pos >= 4) return '#EAB308'; // 4º+: Amarillo
    return '';
  }

  // Actualización automática de micrófonos según rol y foco (Spotlight)
  updateMicrophoneStates(): void {
    this.participantsList.forEach(p => {
      if (p.role === 'Anfitrión') {
        p.isMic = !this.isMicMuted;
      } else {
        // Invitados: activado automáticamente solo si están en primer plano (Spotlight)
        p.isMic = (this.spotlightParticipant?.name === p.name);
      }
    });
  }

  // Asignar al escenario central en Spotlight, activar su micrófono y removerlo de la cola de espera
  setSpotlight(participant: any): void {
    if (!this.isHost) {
      return; // Solo el anfitrión puede cambiar el foco / otorgar la palabra
    }
    this.spotlightParticipant = participant;
    localStorage.setItem('meetflow_spotlight_' + this.meetingId, JSON.stringify(participant.name));
    
    // Al otorgarle la palabra, se remueve de la cola de turnos y los demás avanzan en el degradé
    const index = this.speakQueue.indexOf(participant.name);
    if (index > -1) {
      this.speakQueue.splice(index, 1);
      this.syncSpeakQueue();
    }
    
    this.updateMicrophoneStates();
  }

  // Sincronizar reactivamente el perfil del Anfitrión en todas las pantallas
  syncHostProfile(): void {
    const hostPart = this.participantsList.find(p => p.role === 'Anfitrión');
    if (hostPart) {
      const hostUser = this.authService.getHostProfile();
      if (hostUser) {
        if (hostUser.avatarUrl && hostPart.avatar !== hostUser.avatarUrl) {
          hostPart.avatar = hostUser.avatarUrl;
        }
        if (hostUser.name && hostPart.name !== hostUser.name) {
          hostPart.name = hostUser.name;
        }
      }
    }
  }

  // Cargar foco (Spotlight) sincronizado desde localStorage
  loadSpotlight(): void {
    const saved = localStorage.getItem('meetflow_spotlight_' + this.meetingId);
    if (saved) {
      try {
        const name = JSON.parse(saved);
        const found = this.participantsList.find(p => p.name === name);
        if (found && this.spotlightParticipant?.name !== found.name) {
          this.spotlightParticipant = found;
          this.updateMicrophoneStates();
        }
      } catch (e) {}
    }
  }

  // Getter del anfitrión
  get hostParticipant(): any {
    return this.participantsList.find(p => p.role === 'Anfitrión') || this.participantsList[0];
  }

  // Getter de la lista de invitados
  get guestParticipants(): any[] {
    return this.participantsList.filter(p => p.role !== 'Anfitrión');
  }

  // Getter de rol de Anfitrión vs Invitado
  get isHost(): boolean {
    const user = this.authService.getCurrentUser();
    if (user && user.role) {
      return user.role === 'Anfitrión';
    }
    return !this.authService.isGuest();
  }
}
