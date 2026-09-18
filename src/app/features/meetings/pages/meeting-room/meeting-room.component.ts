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
  timerText = '00:00:00';
  private timerInterval: any;
  private meetingStartTime = 0;

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

  chatMessages: { sender: string; time: string; text: string; isMe: boolean }[] = [];
  newMessage = '';
  unreadChatCount = 0;

  participantsList: any[] = [];
  private latestApprovedRequests: JoinRequest[] = [];

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
      this.meetingService.getUpcomingMeetings().subscribe(meetings => {
        const found = meetings.find(m => m.code === routeId || m.id === routeId);
        if (found) {
          this.meetingTitle = found.title;
        } else {
          this.meetingTitle = `Reunión (${routeId})`;
        }
      });
    }

    const qParams = this.route.snapshot.queryParams;
    const modeParam = qParams['mode'];
    const guestNameParam = qParams['guestName'] || qParams['name'];

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || modeParam === 'GUEST') {
      const nameToUse = guestNameParam || 'Invitado Cloudflare';
      this.authService.loginAsGuest(nameToUse).subscribe();
    }

    // Inicializar lista unificada de participantes sin avatares hardcodeados
    this.reconcileParticipantsList();
    
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
          this.reconcileParticipantsList();
          this.chatMessages.forEach(msg => {
            if (msg.isMe && user.name) {
              msg.sender = user.name;
            }
          });
        }
      }),
      this.joinRequestService.getPendingRequests().subscribe(requests => {
        if (!this.isHost) {
          this.pendingRequestsForRoom = [];
          return;
        }
        this.pendingRequestsForRoom = requests.filter(r => 
          r.targetMeetingId === this.meetingId || 
          r.targetMeetingId.includes(this.meetingId) || 
          this.meetingId.includes(r.targetMeetingId)
        );
      }),
      this.joinRequestService.getApprovedRequests().subscribe(approvedList => {
        this.latestApprovedRequests = approvedList || [];
        this.reconcileParticipantsList();
      }),
      this.webrtcService.meetingEnded$.subscribe(code => {
        if (code === this.meetingId || this.meetingId.includes(code)) {
          this.handleRoomEndedNotification();
        }
      }),
      this.webrtcService.spotlightChanged$.subscribe(name => {
        if (name) {
          const found = this.participantsList.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
          if (found) {
            this.spotlightParticipant = found;
            this.updateMicrophoneStates();
          }
        }
      }),
      this.webrtcService.speakQueueChanged$.subscribe(data => {
        if (data && (data.roomCode === this.meetingId || data.roomCode.includes(this.meetingId) || this.meetingId.includes(data.roomCode))) {
          const prevCount = this.speakQueue ? this.speakQueue.length : 0;
          this.speakQueue = data.speakQueue || [];
          try {
            localStorage.setItem('meetflow_speak_queue_' + this.meetingId, JSON.stringify(this.speakQueue));
          } catch (e) {}
          if (this.isHost && this.speakQueue.length > prevCount) {
            this.joinRequestService.playNotificationChime();
          }
          this.updateMicrophoneStates();
        }
      }),
      this.webrtcService.guestLeft$.subscribe(data => {
        if (data && (data.roomCode === this.meetingId || data.roomCode.includes(this.meetingId) || this.meetingId.includes(data.roomCode))) {
          if (data.guestName) {
            this.removeParticipantByName(data.guestName);
          }
        }
      }),
      this.webrtcService.chatMessage$.subscribe(data => {
        if (data && (data.roomCode === this.meetingId || data.roomCode.includes(this.meetingId) || this.meetingId.includes(data.roomCode))) {
          const currentName = this.currentUserName.trim().toLowerCase();
          const isMine = data.sender.trim().toLowerCase() === currentName;
          if (!isMine) {
            this.chatMessages.push({
              sender: data.sender,
              time: data.time,
              text: data.text,
              isMe: false
            });
            this.saveChatMessages();
            this.scrollChatToBottom();
            if (!this.showChat) {
              this.unreadChatCount++;
            }
          }
        }
      })
    );

    // Cargar cola de turnos, foco y mensajes de chat al iniciar
    this.loadSpeakQueue();
    this.loadSpotlight();
    this.loadChatMessages();

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
        this.reconcileParticipantsList();
      }
      if (event.key === 'meetflow_guest_left_' + this.meetingId) {
        this.handleGuestLeftNotification();
      }
      if (event.key === 'meetflow_chat_messages_' + this.meetingId) {
        this.loadChatMessages();
      }
    });

    // Iniciar temporizador dinámico en vivo de la reunión
    this.startMeetingTimer();

    // Fallback periodic check for cross-tab host ending, speakQueue, spotlight, host avatar & guest departure updates
    this.endCheckInterval = setInterval(() => {
      if (localStorage.getItem('meetflow_meeting_ended_' + this.meetingId)) {
        this.handleRoomEndedNotification();
      }
      this.reconcileParticipantsList();
      this.loadSpeakQueue();
      this.loadSpotlight();
    }, 1200);
  }

  private startMeetingTimer(): void {
    const key = 'meetflow_meeting_start_' + this.meetingId;
    let saved = localStorage.getItem(key);
    if (!saved) {
      saved = Date.now().toString();
      try {
        localStorage.setItem(key, saved);
      } catch (e) {}
    }
    this.meetingStartTime = Number(saved) || Date.now();

    this.updateTimerText();
    this.timerInterval = setInterval(() => {
      this.updateTimerText();
    }, 1000);
  }

  private updateTimerText(): void {
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.meetingStartTime) / 1000));
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;

    const pad = (n: number) => String(n).padStart(2, '0');
    this.timerText = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    if (this.authService.isGuest()) {
      this.notifyGuestLeft(this.currentUserName);
    }
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
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
    const cleanName = guestName.trim();
    
    // Mantener la lista acumulativa de invitados salientes en localStorage
    let currentLeft: string[] = [];
    const saved = localStorage.getItem('meetflow_guest_left_' + this.meetingId);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          currentLeft = parsed;
        } else if (parsed && parsed.name) {
          currentLeft = [parsed.name];
        }
      } catch (e) {}
    }
    if (!currentLeft.some(n => n.toLowerCase() === cleanName.toLowerCase())) {
      currentLeft.push(cleanName);
    }
    localStorage.setItem('meetflow_guest_left_' + this.meetingId, JSON.stringify(currentLeft));

    this.joinRequestService.removeApprovedRequest(cleanName, this.meetingId);
    this.webrtcService.sendCustomSignaling({
      type: 'GUEST_LEFT',
      roomCode: this.meetingId,
      guestName: cleanName
    });
    this.removeParticipantByName(cleanName);
  }

  handleGuestLeftNotification(): void {
    const saved = localStorage.getItem('meetflow_guest_left_' + this.meetingId);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach(name => this.removeParticipantByName(name));
        } else if (parsed && parsed.name) {
          this.removeParticipantByName(parsed.name);
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
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.meetingStartTime) / 1000));
      const mins = Math.max(1, Math.round(elapsedSeconds / 60));
      const durationStr = mins < 60 ? `${mins} min` : `${this.timerText}`;
      const count = this.participantsList ? this.participantsList.length : 1;

      this.webrtcService.endMeeting(this.meetingId);
      localStorage.setItem('meetflow_meeting_ended_' + this.meetingId, Date.now().toString());
      try {
        localStorage.removeItem('meetflow_meeting_start_' + this.meetingId);
      } catch (e) {}

      this.meetingService.endMeeting(this.meetingId, durationStr, count);
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
    if (this.showChat) {
      this.unreadChatCount = 0;
      this.scrollChatToBottom();
    }
  }

  toggleWaitingRoom(): void {
    this.showWaitingRoomPanel = !this.showWaitingRoomPanel;
  }

  sendMessage(): void {
    const trimmed = this.newMessage.trim();
    if (!trimmed) return;

    const senderName = this.currentUserName;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    this.chatMessages.push({
      sender: senderName,
      time: timeStr,
      text: trimmed,
      isMe: true
    });

    this.saveChatMessages();
    this.webrtcService.sendChatMessage(this.meetingId, senderName, trimmed);

    this.newMessage = '';
    this.scrollChatToBottom();
  }

  loadChatMessages(): void {
    const saved = localStorage.getItem('meetflow_chat_messages_' + this.meetingId);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const currentName = this.currentUserName.trim().toLowerCase();
          this.chatMessages = parsed.map(msg => ({
            ...msg,
            isMe: msg.sender ? msg.sender.trim().toLowerCase() === currentName : false
          }));
          return;
        }
      } catch (e) {}
    }
    this.chatMessages = [];
  }

  saveChatMessages(): void {
    try {
      localStorage.setItem('meetflow_chat_messages_' + this.meetingId, JSON.stringify(this.chatMessages));
    } catch (e) {}
  }

  scrollChatToBottom(): void {
    setTimeout(() => {
      const chatContainer = document.querySelector('.chat-messages-scroll');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 60);
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

    const cleanPartName = participant.name ? participant.name.trim().toLowerCase() : '';
    const cleanCurrent = this.currentUserName ? this.currentUserName.trim().toLowerCase() : '';

    // Si es el usuario actual local en la sesión
    if (cleanPartName === cleanCurrent) {
      return (!this.isCameraOff && this.localStream) ? this.localStream : null;
    }

    // Si tiene un stream de video directo asignado
    if (participant.stream) {
      return participant.stream;
    }

    // Buscar en los streams remotos P2P recibidos vía WebRTC
    if (this.remoteStreams && this.remoteStreams.length > 0) {
      // 1. Coincidencia por ID de peer o nombre
      const exact = this.remoteStreams.find(r => 
        r.peerId === participant.id || 
        r.peerId === participant.name ||
        (cleanPartName && r.peerId.toLowerCase().includes(cleanPartName))
      );
      if (exact && exact.stream) {
        return exact.stream;
      }

      // 2. Mapeo ordenado de remotos para participantes distantes (Celular/Incógnito/Túnel)
      const remoteParticipants = this.participantsList.filter(p => p.name.trim().toLowerCase() !== cleanCurrent);
      const remoteIndex = remoteParticipants.findIndex(p => p.name.trim().toLowerCase() === cleanPartName);
      if (remoteIndex >= 0 && remoteIndex < this.remoteStreams.length) {
        return this.remoteStreams[remoteIndex].stream;
      }
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
    const cleanGuest = guestName ? guestName.trim() : '';
    if (!cleanGuest) return;

    const existingIndex = this.speakQueue.findIndex(name => {
      const c = name.trim().toLowerCase();
      const g = cleanGuest.toLowerCase();
      return c === g || c.includes(g) || g.includes(c);
    });

    if (existingIndex > -1) {
      this.speakQueue.splice(existingIndex, 1);
    } else {
      this.speakQueue.push(cleanGuest);
    }
    this.syncSpeakQueue();
  }

  private syncSpeakQueue(): void {
    try {
      localStorage.setItem('meetflow_speak_queue_' + this.meetingId, JSON.stringify(this.speakQueue));
    } catch (e) {}
    this.webrtcService.sendCustomSignaling({
      type: 'SPEAK_QUEUE_CHANGED',
      roomCode: this.meetingId,
      speakQueue: this.speakQueue
    });
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
    if (!guestName || !this.speakQueue || this.speakQueue.length === 0) return 0;
    const cleanGuest = guestName.trim().toLowerCase();
    const index = this.speakQueue.findIndex(name => {
      const cleanName = name.trim().toLowerCase();
      return cleanName === cleanGuest || cleanName.includes(cleanGuest) || cleanGuest.includes(cleanName);
    });
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
        p.isMic = (this.spotlightParticipant?.name?.trim().toLowerCase() === p.name?.trim().toLowerCase());
      }
    });
  }

  // Asignar al escenario central en Spotlight, activar su micrófono y removerlo de la cola de espera
  setSpotlight(participant: any): void {
    if (!this.isHost) {
      return; // Solo el anfitrión puede cambiar el foco / otorgar la palabra
    }
    const cleanName = participant.name ? participant.name.trim() : '';
    const found = this.participantsList.find(p => p.name.trim().toLowerCase() === cleanName.toLowerCase());
    this.spotlightParticipant = found || participant;

    localStorage.setItem('meetflow_spotlight_' + this.meetingId, JSON.stringify(cleanName));
    
    // Transmitir cambio de foco vía señalización WebSocket a todos los dispositivos (móvil/incógnito/túnel)
    this.webrtcService.sendCustomSignaling({
      type: 'SET_SPOTLIGHT',
      roomCode: this.meetingId,
      participantName: cleanName
    });

    // Al otorgarle la palabra, se remueve de la cola de turnos
    const index = this.speakQueue.findIndex(name => name.trim().toLowerCase() === cleanName.toLowerCase());
    if (index > -1) {
      this.speakQueue.splice(index, 1);
      this.syncSpeakQueue();
    }
    
    this.updateMicrophoneStates();
  }

  // Reconciliación unificada de participantes para todas las ventanas (Anfitrión e Invitados)
  reconcileParticipantsList(): void {
    const hostUser = this.authService.getHostProfile();
    const hostName = (hostUser && hostUser.name) ? hostUser.name : 'Sergio D.';
    const hostAvatar = (hostUser && hostUser.avatarUrl && !hostUser.avatarUrl.includes('unsplash'))
      ? hostUser.avatarUrl
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(hostName)}&background=0D5A56&color=ffffff&bold=true`;

    const newList: any[] = [
      {
        name: hostName,
        role: 'Anfitrión',
        avatar: hostAvatar,
        isMic: !this.isMicMuted,
        isCam: !this.isCameraOff
      }
    ];

    let leftGuests: string[] = [];
    const savedLeft = localStorage.getItem('meetflow_guest_left_' + this.meetingId);
    if (savedLeft) {
      try {
        const parsed = JSON.parse(savedLeft);
        if (Array.isArray(parsed)) {
          leftGuests = parsed.map((n: any) => String(n).trim().toLowerCase());
        } else if (parsed && parsed.name) {
          leftGuests.push(String(parsed.name).trim().toLowerCase());
        }
      } catch (e) {}
    }

    const roomApproved = this.latestApprovedRequests.filter(r => 
      r.targetMeetingId === this.meetingId || 
      r.targetMeetingId.includes(this.meetingId) || 
      this.meetingId.includes(r.targetMeetingId)
    );

    roomApproved.forEach(req => {
      const cleanName = req.userName.trim();
      const lower = cleanName.toLowerCase();
      if (lower !== hostName.trim().toLowerCase() && !leftGuests.includes(lower)) {
        if (!newList.some(p => p.name.trim().toLowerCase() === lower)) {
          newList.push({
            name: cleanName,
            role: 'Invitado',
            avatar: req.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=0284C7&color=ffffff&bold=true`,
            isMic: (this.spotlightParticipant?.name?.trim().toLowerCase() === lower),
            isCam: true
          });
        }
      }
    });

    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.role === 'Invitado') {
      const cleanName = currentUser.name.trim();
      const lower = cleanName.toLowerCase();
      if (lower !== hostName.trim().toLowerCase() && !leftGuests.includes(lower)) {
        if (!newList.some(p => p.name.trim().toLowerCase() === lower)) {
          newList.push({
            name: cleanName,
            role: 'Invitado',
            avatar: currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=0284C7&color=ffffff&bold=true`,
            isMic: (this.spotlightParticipant?.name?.trim().toLowerCase() === lower),
            isCam: true
          });
        }
      }
    }

    this.participantsList = newList;
    this.updateMicrophoneStates();
  }

  syncHostProfile(): void {
    this.reconcileParticipantsList();
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
    return !!(user && user.role === 'Anfitrión');
  }
}
