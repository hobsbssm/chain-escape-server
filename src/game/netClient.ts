import type {
  CharacterCustomization,
  ClientToServerMessage,
  PlayerInputState,
  RoomStateSnapshot,
  ServerToClientMessage,
  StageNumber,
  WorldId,
} from '../shared/types.ts';

export type NetListener = {
  onState: (state: RoomStateSnapshot) => void;
  onJoined: (roomCode: string, playerId: string, state: RoomStateSnapshot) => void;
  onEvent: (event: string, detail?: string) => void;
  onError: (message: string) => void;
  onConnectionChange: (status: 'disconnected' | 'connecting' | 'connected') => void;
  onPing: (ms: number) => void;
};

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private listener: NetListener;
  private status: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private pingTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private activeRoomCode: string | null = null;
  private activePlayerId: string | null = null;
  private activeCustom: CharacterCustomization | null = null;
  private intentionalClose = false;

  private micStream: MediaStream | null = null;
  private micCtx: AudioContext | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micPollTimer: number | null = null;
  private voiceMuted = true;

  constructor(listener: NetListener) {
    this.listener = listener;
  }

  public getStatus(): 'disconnected' | 'connecting' | 'connected' {
    return this.status;
  }

  private setStatus(s: 'disconnected' | 'connecting' | 'connected'): void {
    this.status = s;
    this.listener.onConnectionChange(s);
  }

  /**
   * Resolve the WebSocket URL for the game server.
   *
   * Build-time override: VITE_SERVER_URL (e.g. https://xxx.onrender.com).
   * The ws/wss protocol follows the URL scheme (https -> wss, http -> ws).
   * A bare host (xxx.onrender.com) is treated as wss. A full ws(s):// URL
   * is used as-is. Without the variable, fall back to the current behaviour:
   * same host as the page, path /ws.
   */
  private resolveServerUrl(): string {
    const configured = import.meta.env.VITE_SERVER_URL?.trim().replace(/\/+$/, '');
    if (configured) {
      if (configured.startsWith('ws://') || configured.startsWith('wss://')) {
        return configured.endsWith('/ws') ? configured : `${configured}/ws`;
      }
      const withScheme = /^https?:\/\//.test(configured)
        ? configured
        : `https://${configured}`;
      const wsScheme = withScheme.startsWith('https://') ? 'wss:' : 'ws:';
      return `${wsScheme}//${withScheme.replace(/^https?:\/\//, '')}/ws`;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  public connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    this.intentionalClose = false;
    this.setStatus('connecting');

    return new Promise((resolve, reject) => {
      const url = this.resolveServerUrl();
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.setStatus('connected');
        this.startPing();
        if (this.activeRoomCode && this.activePlayerId && this.activeCustom) {
          this.send({
            type: 'room:join',
            roomCode: this.activeRoomCode,
            playerId: this.activePlayerId,
            customization: this.activeCustom,
          });
        }
        resolve();
      };

      ws.onmessage = (ev) => {
        let msg: ServerToClientMessage;
        try {
          msg = JSON.parse(String(ev.data)) as ServerToClientMessage;
        } catch {
          return;
        }
        if (msg.type === 'room:joined') {
          this.activeRoomCode = msg.roomCode;
          this.activePlayerId = msg.playerId;
          this.listener.onJoined(msg.roomCode, msg.playerId, msg.state);
        } else if (msg.type === 'room:state') {
          this.listener.onState(msg.state);
        } else if (msg.type === 'room:event') {
          this.listener.onEvent(msg.event, msg.detail);
        } else if (msg.type === 'room:error') {
          this.listener.onError(msg.message);
        } else if (msg.type === 'pong') {
          const rtt = Math.max(4, Math.round(Date.now() - msg.clientTime));
          this.listener.onPing(rtt);
        }
      };

      ws.onerror = () => {
        if (this.status === 'connecting') {
          reject(new Error('WebSocket connection failed'));
        }
      };

      ws.onclose = () => {
        this.stopPing();
        this.setStatus('disconnected');
        if (!this.intentionalClose && this.activeRoomCode) {
          this.reconnectTimer = window.setTimeout(() => {
            this.connect().catch(() => {});
          }, 1800);
        }
      };
    });
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = window.setInterval(() => {
      this.send({ type: 'ping', clientTime: Date.now() });
    }, 3000);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  public send(msg: ClientToServerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public async createRoom(
    playerId: string,
    customization: CharacterCustomization,
    worldId: WorldId,
    stage: StageNumber = 1,
  ): Promise<void> {
    this.activePlayerId = playerId;
    this.activeCustom = customization;
    await this.connect();
    this.send({ type: 'room:create', playerId, customization, worldId, stage });
  }

  public async joinRoom(
    roomCode: string,
    playerId: string,
    customization: CharacterCustomization,
  ): Promise<void> {
    this.activePlayerId = playerId;
    this.activeCustom = customization;
    this.activeRoomCode = roomCode.toUpperCase();
    await this.connect();
    this.send({ type: 'room:join', roomCode: this.activeRoomCode, playerId, customization });
  }

  public leaveRoom(): void {
    this.activeRoomCode = null;
    this.send({ type: 'room:leave' });
    this.stopVoice();
  }

  public selectWorld(worldId: WorldId, stage: StageNumber = 1): void {
    this.send({ type: 'room:select_world', worldId, stage });
  }

  public updateCustomization(customization: CharacterCustomization): void {
    this.activeCustom = customization;
    this.send({ type: 'room:update_custom', customization });
  }

  public startGame(): void {
    this.send({ type: 'room:start' });
  }

  public restartGame(): void {
    this.send({ type: 'room:restart' });
  }

  public sendInput(input: PlayerInputState): void {
    this.send({ type: 'game:input', input });
  }

  public async toggleVoice(): Promise<boolean> {
    if (!this.voiceMuted) {
      this.voiceMuted = true;
      this.send({ type: 'voice:state', muted: true, speaking: false });
      return false;
    }
    try {
      if (!this.micStream && navigator.mediaDevices?.getUserMedia) {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.micCtx = new AudioCtx();
        const src = this.micCtx.createMediaStreamSource(this.micStream);
        this.micAnalyser = this.micCtx.createAnalyser();
        this.micAnalyser.fftSize = 256;
        src.connect(this.micAnalyser);
        const buf = new Uint8Array(this.micAnalyser.frequencyBinCount);
        this.micPollTimer = window.setInterval(() => {
          if (!this.micAnalyser || this.voiceMuted) return;
          this.micAnalyser.getByteFrequencyData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i];
          const avg = sum / buf.length;
          this.send({ type: 'voice:state', muted: false, speaking: avg > 18 });
        }, 250);
      }
      this.voiceMuted = false;
      this.send({ type: 'voice:state', muted: false, speaking: false });
      return true;
    } catch {
      this.voiceMuted = true;
      return false;
    }
  }

  public stopVoice(): void {
    this.voiceMuted = true;
    if (this.micPollTimer !== null) {
      window.clearInterval(this.micPollTimer);
      this.micPollTimer = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.micCtx) {
      this.micCtx.close().catch(() => {});
      this.micCtx = null;
    }
    this.micAnalyser = null;
  }

  public disconnect(): void {
    this.intentionalClose = true;
    this.activeRoomCode = null;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();
    this.stopVoice();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }
}
