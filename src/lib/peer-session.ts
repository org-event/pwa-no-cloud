import { DATA_CHANNELS } from '../config/defaults.ts';
import type { IceServerConfig } from '../config/types.ts';
import type { SessionState } from '../domain/session.ts';
import { EventEmitter } from './events.ts';
import { generateId } from './id.ts';
import type { ManualPort } from './signaling/manual.ts';
import type { SignalMessage } from './signaling/port.ts';
import {
  attachRemoteChannels,
  createLocalChannels,
  createPeerConnection,
  localSdp,
  waitIceComplete,
  type PeerLinks,
} from './webrtc.ts';

export type PeerRole = 'idle' | 'caller' | 'callee';

type PeerSessionConfig = {
  iceServers: IceServerConfig[];
  signaling: ManualPort;
};

const errorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

export class PeerSession extends EventEmitter {
  state: SessionState = 'idle';
  role: PeerRole = 'idle';
  clientId = generateId();
  lastPongMs: number | null = null;
  error = '';
  links: PeerLinks | null = null;
  config: PeerSessionConfig;

  constructor(config: PeerSessionConfig) {
    super();
    this.config = config;
  }

  outgoing() {
    return this.config.signaling.outgoing();
  }

  async createInvite() {
    this.reset();
    this.role = 'caller';
    this.setState('signaling');
    const signaling = this.config.signaling;
    await signaling.connect({ roomId: 'manual', clientId: this.clientId });
    signaling.subscribe((message) => this.onSignal(message));
    try {
      const pc = createPeerConnection(this.config.iceServers);
      this.links = createLocalChannels(pc);
      this.bindPeer(pc);
      this.bindControl(this.links.control);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitIceComplete(pc);
      await signaling.send({
        from: this.clientId,
        to: '*',
        data: { type: 'offer', payload: { sdp: localSdp(pc) } },
      });
      this.emit('invite');
    } catch (err) {
      this.fail(errorMessage(err, 'Не удалось создать приглашение'));
    }
  }

  async acceptInvite(text: string) {
    this.reset();
    this.role = 'callee';
    this.setState('signaling');
    const signaling = this.config.signaling;
    await signaling.connect({ roomId: 'manual', clientId: this.clientId });
    signaling.subscribe((message) => this.onSignal(message));
    const accepted = await signaling.accept(text);
    if (!accepted.ok) {
      this.fail(accepted.message);
      return accepted;
    }
    return accepted;
  }

  async acceptAnswer(text: string) {
    const accepted = await this.config.signaling.accept(text);
    if (!accepted.ok) {
      this.fail(accepted.message);
      return accepted;
    }
    return accepted;
  }

  ping() {
    const channel = this.links?.control;
    if (!channel || channel.readyState !== 'open') return;
    const payload = JSON.stringify({ type: 'ping', t: Date.now() });
    channel.send(payload);
  }

  close() {
    this.config.signaling.close();
    if (this.links) {
      this.links.control?.close();
      this.links.bytes?.close();
      this.links.pc.close();
    }
    this.links = null;
    this.role = 'idle';
    this.lastPongMs = null;
    this.setState('closed');
  }

  reset() {
    this.error = '';
    this.lastPongMs = null;
    this.config.signaling.close();
    if (this.links) {
      this.links.control?.close();
      this.links.bytes?.close();
      this.links.pc.close();
      this.links = null;
    }
    this.setState('idle');
  }

  setState(state: SessionState) {
    this.state = state;
    this.emit('state', state);
  }

  fail(message: string) {
    this.error = message;
    this.setState('failed');
    this.emit('error', message);
  }

  async onSignal(message: SignalMessage) {
    if (message.data.type === 'offer') {
      await this.handleOffer(message);
      return;
    }
    if (message.data.type === 'answer') {
      await this.handleAnswer(message);
    }
  }

  async handleOffer(message: SignalMessage) {
    const payload = message.data.payload as { sdp?: string };
    if (!payload.sdp) {
      this.fail('В приглашении нет SDP');
      return;
    }
    try {
      const pc = createPeerConnection(this.config.iceServers);
      this.links = { pc, control: null, bytes: null };
      this.bindPeer(pc);
      pc.ondatachannel = (event) => {
        attachRemoteChannels(this.links as PeerLinks, event.channel);
        if (event.channel.label === DATA_CHANNELS.control) {
          this.bindControl(event.channel);
        }
      };
      await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitIceComplete(pc);
      this.setState('connecting');
      await this.config.signaling.send({
        from: this.clientId,
        to: message.from,
        data: { type: 'answer', payload: { sdp: localSdp(pc) } },
      });
      this.emit('invite');
    } catch (err) {
      this.fail(errorMessage(err, 'Не удалось ответить на приглашение'));
    }
  }

  async handleAnswer(message: SignalMessage) {
    const pc = this.links?.pc;
    const payload = message.data.payload as { sdp?: string };
    if (!pc || !payload.sdp) {
      this.fail('Нет соединения или SDP ответа');
      return;
    }
    try {
      await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
      this.setState('connecting');
    } catch (err) {
      this.fail(errorMessage(err, 'Не удалось принять ответ'));
    }
  }

  bindPeer(pc: RTCPeerConnection) {
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') this.fail('ICE не собрался');
      if (pc.connectionState === 'closed') this.setState('closed');
    };
  }

  bindControl(channel: RTCDataChannel | null) {
    if (!channel) return;
    channel.onopen = () => {
      this.setState('connected');
      this.emit('channel-open');
    };
    channel.onclose = () => {
      if (this.state === 'connected') this.setState('closed');
    };
    channel.onmessage = (event) => {
      this.onControl(String(event.data));
    };
  }

  onControl(raw: string) {
    try {
      const data = JSON.parse(raw) as { type?: string; t?: number };
      if (data.type === 'ping' && this.links?.control) {
        this.links.control.send(JSON.stringify({ type: 'pong', t: data.t }));
        return;
      }
      if (data.type === 'pong' && typeof data.t === 'number') {
        this.lastPongMs = Date.now() - data.t;
        this.emit('pong', this.lastPongMs);
      }
    } catch {
      this.emit('error', 'Сломан control-кадр');
    }
  }
}
