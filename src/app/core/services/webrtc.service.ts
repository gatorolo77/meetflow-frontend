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

  localStream$: Observable<MediaStream | null> = this.localStreamSubject.asObservable();
  remoteStreams$: Observable<RemotePeerStream[]> = this.remoteStreamsSubject.asObservable();
  meetingEnded$: Observable<string> = this.meetingEndedSubject.asObservable();

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

  async initLocalMedia(video = true, audio = true): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      this.localStreamSubject.next(stream);
      return stream;
    } catch (err) {
      console.warn('Media devices warning: Camera/Mic permissions not granted or simulated.', err);
      return null;
    }
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
      }
    };
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

  toggleCamera(enabled: boolean): void {
    const stream = this.localStreamSubject.getValue();
    if (stream) {
      stream.getVideoTracks().forEach(t => t.enabled = enabled);
    }
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
