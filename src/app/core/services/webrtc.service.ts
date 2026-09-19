import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RemotePeerStream {
  peerId: string;
  stream: MediaStream;
}

@Injectable({
  providedIn: 'root'
})
export class WebRtcService {
  private socket!: WebSocket;
  private localStreamSubject = new BehaviorSubject<MediaStream | null>(null);
  private remoteStreamsSubject = new BehaviorSubject<RemotePeerStream[]>([]);
  private meetingEndedSubject = new Subject<string>();
  private spotlightChangedSubject = new Subject<string>();
  private speakQueueChangedSubject = new Subject<{ roomCode: string; speakQueue: string[] }>();
  private guestLeftSubject = new Subject<{ roomCode: string; guestName: string }>();
  private chatMessageSubject = new Subject<{ roomCode: string; sender: string; time: string; text: string }>();
  private screenShareStartedSubject = new Subject<{ roomCode: string; participantName: string }>();
  private screenShareStoppedSubject = new Subject<{ roomCode: string; participantName: string }>();

  localStream$: Observable<MediaStream | null> = this.localStreamSubject.asObservable();
  remoteStreams$: Observable<RemotePeerStream[]> = this.remoteStreamsSubject.asObservable();
  meetingEnded$: Observable<string> = this.meetingEndedSubject.asObservable();
  spotlightChanged$: Observable<string> = this.spotlightChangedSubject.asObservable();
  speakQueueChanged$: Observable<{ roomCode: string; speakQueue: string[] }> = this.speakQueueChangedSubject.asObservable();
  guestLeft$: Observable<{ roomCode: string; guestName: string }> = this.guestLeftSubject.asObservable();
  chatMessage$: Observable<{ roomCode: string; sender: string; time: string; text: string }> = this.chatMessageSubject.asObservable();
  screenShareStarted$: Observable<{ roomCode: string; participantName: string }> = this.screenShareStartedSubject.asObservable();
  screenShareStopped$: Observable<{ roomCode: string; participantName: string }> = this.screenShareStoppedSubject.asObservable();

  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private currentRoomCode = '';

  // Free Google STUN Configuration (Cost $0)
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  setLocalStream(stream: MediaStream): void {
    if (stream) {
      this.localStreamSubject.next(stream);
      this.updateTracksInPeerConnections(stream);
    }
  }

  async initLocalMedia(video: boolean | MediaTrackConstraints = true, audio = true): Promise<MediaStream | null> {
    const existing = this.localStreamSubject.getValue();
    if (existing && existing.active && existing.getTracks().some(t => t.readyState === 'live')) {
      console.log('Reutilizando stream de medios local ya activo.');
      this.updateTracksInPeerConnections(existing);
      return existing;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('getUserMedia no está disponible en este navegador o entorno (requiere HTTPS en dispositivos móviles).');
      return null;
    }

    let stream: MediaStream | null = null;
    const videoConstraints = typeof video === 'boolean' 
      ? (video ? { facingMode: 'user' } : false) 
      : video;

    try {
      // 1. Intento primario: Cámara frontal + Micrófono
      stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio });
    } catch (err) {
      console.warn('Intento de cámara frontal (facingMode) falló, intentando constraints estándar:', err);
      try {
        // 2. Fallback estándar: Video + Audio genérico
        stream = await navigator.mediaDevices.getUserMedia({ video: !!video, audio });
      } catch (err2) {
        console.warn('Intento combinado falló, evaluando dispositivos individuales (audio / video por separado):', err2);
        try {
          // 3. Fallback solo audio si el video está bloqueado
          if (audio) {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            stream = audioStream;
            // Intentar adjuntar video secundario si está disponible
            if (video) {
              try {
                const vidStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                vidStream.getVideoTracks().forEach(t => stream!.addTrack(t));
              } catch (eVid) {}
            }
          }
        } catch (err3) {
          try {
            // 4. Fallback solo video si el micrófono está bloqueado
            if (video) {
              stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            }
          } catch (err4) {
            console.error('No se pudo acceder a ningún dispositivo de medios:', err4);
            return null;
          }
        }
      }
    }

    if (stream) {
      this.localStreamSubject.next(stream);
      this.updateTracksInPeerConnections(stream);
    }
    return stream;
  }

  // Actualizar o re-vincular dinámicamente las pistas locales en todas las conexiones P2P activas
  public updateTracksInPeerConnections(stream: MediaStream): void {
    if (!stream) return;
    this.peerConnections.forEach((pc, peerId) => {
      const senders = pc.getSenders();
      stream.getTracks().forEach(track => {
        const existingSender = senders.find(s => s.track && s.track.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track).catch(e => console.warn('replaceTrack error:', e));
        } else {
          try {
            pc.addTrack(track, stream);
          } catch (e) {
            console.warn('addTrack error:', e);
          }
        }
      });
    });
  }

  joinRoom(roomCode: string): void {
    this.currentRoomCode = roomCode;
    this.socket = new WebSocket(environment.wsUrl);

    this.socket.onopen = () => {
      console.log('✅ Conectado al Servidor de Señalización WebRTC (' + environment.wsUrl + ')');
      this.sendSignalingMessage({
        type: 'JOIN_ROOM',
        roomCode: this.currentRoomCode
      });
    };

    this.socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log('📩 Mensaje de señalización:', data);

      if (data.type === 'USER_JOINED') {
        this.createPeerConnection(data.peerId, true);
      } else if (data.type === 'OFFER') {
        await this.handleOffer(data.senderId, data.sdp);
      } else if (data.type === 'ANSWER') {
        await this.handleAnswer(data.senderId, data.sdp);
      } else if (data.type === 'CANDIDATE') {
        await this.handleCandidate(data.senderId, data.candidate);
      } else if (data.type === 'USER_LEFT') {
        this.removePeer(data.peerId);
      } else if (data.type === 'MEETING_ENDED') {
        console.log('🛑 Reunión finalizada por el anfitrión para la sala:', data.roomCode);
        this.meetingEndedSubject.next(data.roomCode);
      } else if (data.type === 'SET_SPOTLIGHT' && data.participantName) {
        console.log('🎙️ Foco (Spotlight) cambiado por señalización a:', data.participantName);
        this.spotlightChangedSubject.next(data.participantName);
      } else if (data.type === 'SPEAK_QUEUE_CHANGED' && data.speakQueue) {
        console.log('🖐️ Cola de turnos cambiada por señalización:', data.speakQueue);
        this.speakQueueChangedSubject.next({ roomCode: data.roomCode, speakQueue: data.speakQueue });
      } else if (data.type === 'GUEST_LEFT' && data.guestName) {
        console.log('🚪 Invitado retirado por señalización:', data.guestName);
        this.guestLeftSubject.next({ roomCode: data.roomCode, guestName: data.guestName });
      } else if (data.type === 'CHAT_MESSAGE' && data.text) {
        console.log('💬 Mensaje de chat recibido por señalización de:', data.sender);
        this.chatMessageSubject.next({
          roomCode: data.roomCode,
          sender: data.sender,
          time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: data.text
        });
      } else if (data.type === 'SCREEN_SHARE_STARTED' && data.participantName) {
        console.log('🖥️ Pantalla compartida iniciada por:', data.participantName);
        this.screenShareStartedSubject.next({ roomCode: data.roomCode, participantName: data.participantName });
      } else if (data.type === 'SCREEN_SHARE_STOPPED' && data.participantName) {
        console.log('🖥️ Pantalla compartida finalizada por:', data.participantName);
        this.screenShareStoppedSubject.next({ roomCode: data.roomCode, participantName: data.participantName });
      }
    };
  }

  sendChatMessage(roomCode: string, sender: string, text: string): void {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.sendCustomSignaling({
      type: 'CHAT_MESSAGE',
      roomCode: roomCode,
      sender: sender,
      time: time,
      text: text
    });
  }

  sendCustomSignaling(messageObj: any): void {
    this.sendSignalingMessage(messageObj);
  }

  endMeeting(roomCode: string): void {
    this.sendSignalingMessage({
      type: 'MEETING_ENDED',
      roomCode: roomCode
    });
  }

  private createPeerConnection(peerId: string, isInitiator: boolean): RTCPeerConnection {
    const pc = new RTCPeerConnection(this.rtcConfig);
    this.peerConnections.set(peerId, pc);

    // Add local tracks to peer connection
    const localStream = this.localStreamSubject.getValue();
    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    // Handle remote track
    pc.ontrack = (event) => {
      console.log('🎥 Stream remoto recibido de peer:', peerId);
      const remoteStream = event.streams[0];
      const currentRemotes = this.remoteStreamsSubject.getValue();
      const existingIndex = currentRemotes.findIndex(r => r.peerId === peerId);
      if (existingIndex >= 0) {
        currentRemotes[existingIndex].stream = remoteStream;
        this.remoteStreamsSubject.next([...currentRemotes]);
      } else {
        this.remoteStreamsSubject.next([...currentRemotes, { peerId, stream: remoteStream }]);
      }
    };

    // Send ICE candidates to signaling server
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'CANDIDATE',
          roomCode: this.currentRoomCode,
          targetPeerId: peerId,
          candidate: event.candidate
        });
      }
    };

    // If initiator, create and send SDP offer
    if (isInitiator) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        this.sendSignalingMessage({
          type: 'OFFER',
          roomCode: this.currentRoomCode,
          targetPeerId: peerId,
          sdp: offer
        });
      });
    }

    return pc;
  }

  private async handleOffer(senderId: string, offerSdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.createPeerConnection(senderId, false);
    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.sendSignalingMessage({
      type: 'ANSWER',
      roomCode: this.currentRoomCode,
      targetPeerId: senderId,
      sdp: answer
    });
  }

  private async handleAnswer(senderId: string, answerSdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections.get(senderId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
    }
  }

  private async handleCandidate(senderId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(senderId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private removePeer(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    const currentRemotes = this.remoteStreamsSubject.getValue().filter(r => r.peerId !== peerId);
    this.remoteStreamsSubject.next(currentRemotes);
  }

  private sendSignalingMessage(msg: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  toggleMicrophone(enabled: boolean): void {
    const stream = this.localStreamSubject.getValue();
    if (stream) {
      stream.getAudioTracks().forEach(t => t.enabled = enabled);
    }
  }

  private screenStream: MediaStream | null = null;
  private originalVideoTrack: MediaStreamTrack | null = null;

  toggleCamera(enabled: boolean): void {
    const stream = this.localStreamSubject.getValue();
    if (stream) {
      stream.getVideoTracks().forEach(t => t.enabled = enabled);
    }
  }

  async startScreenShare(roomCode: string, participantName: string): Promise<MediaStream | null> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      console.warn('getDisplayMedia no está disponible en este navegador o entorno.');
      return null;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) return null;

      this.screenStream = displayStream;

      const localStream = this.localStreamSubject.getValue();
      if (localStream) {
        const cameraTrack = localStream.getVideoTracks()[0];
        if (cameraTrack) {
          this.originalVideoTrack = cameraTrack;
        }
      }

      this.peerConnections.forEach(pc => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenTrack).catch(e => console.warn('replaceTrack screen error:', e));
        }
      });

      const combinedTracks: MediaStreamTrack[] = [screenTrack];
      if (localStream && localStream.getAudioTracks().length > 0) {
        combinedTracks.push(localStream.getAudioTracks()[0]);
      }
      const localScreenStream = new MediaStream(combinedTracks);
      this.localStreamSubject.next(localScreenStream);

      screenTrack.onended = () => {
        this.stopScreenShare(roomCode, participantName);
      };

      this.sendCustomSignaling({
        type: 'SCREEN_SHARE_STARTED',
        roomCode: roomCode,
        participantName: participantName
      });

      return localScreenStream;
    } catch (err) {
      console.warn('Error o cancelación al compartir pantalla:', err);
      return null;
    }
  }

  stopScreenShare(roomCode: string, participantName: string): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }

    if (this.originalVideoTrack) {
      const cameraTrack = this.originalVideoTrack;
      this.peerConnections.forEach(pc => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack).catch(e => console.warn('replaceTrack camera restore error:', e));
        }
      });

      const localStream = this.localStreamSubject.getValue();
      if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        const restoredStream = new MediaStream([cameraTrack, ...audioTracks]);
        this.localStreamSubject.next(restoredStream);
      }
      this.originalVideoTrack = null;
    }

    this.sendCustomSignaling({
      type: 'SCREEN_SHARE_STOPPED',
      roomCode: roomCode,
      participantName: participantName
    });
  }

  leaveRoom(): void {
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    const stream = this.localStreamSubject.getValue();
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      this.localStreamSubject.next(null);
    }
    this.remoteStreamsSubject.next([]);
    if (this.socket) {
      this.socket.close();
    }
  }
}
