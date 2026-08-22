import { iceServersHaveStun, iceServersHaveTurn } from '../config/merge.ts';
import { CHANNEL_BUFFER_HIGH, DATA_CHANNELS } from '../config/defaults.ts';
import { explainIceFailure } from '../domain/ice-fail.ts';
import type { IceServerConfig, CustomServerDraft } from '../config/types.ts';
import { parseProfileCard, type ProfileCard } from '../domain/profile.ts';
import {
  applySessionEvent,
  createIdleSession,
  type Session,
  type SessionEvent,
  type SessionState,
} from '../domain/session.ts';
import { EventEmitter } from './events.ts';
import { FilePipe, type DataSink } from './file-pipe.ts';
import type { PickedFile } from './folder-walk.ts';
import { generateId } from './id.ts';
import type { OpfsStore } from './opfs.ts';
import {
  addUniquePath,
  classifyCandidate,
  emptyIceReport,
  pairFromStats,
  parseIceCandidateInit,
  pathsFromSdp,
  type IceCandidateInit,
  type IceReport,
} from './ice.ts';
import type { SignalingHandle } from './signaling/factory.ts';
import { isManualPort } from './signaling/factory.ts';
import type { SignalMessage } from './signaling/port.ts';
import {
  attachRemoteChannels,
  createLocalChannels,
  createPeerConnection,
  localSdp,
  waitIceGathering,
  type PeerLinks,
} from './webrtc.ts';

export type PeerRole = 'idle' | 'caller' | 'callee';

type PeerSessionConfig = {
  iceServers: IceServerConfig[];
  signaling: SignalingHandle;
  shareServers?: CustomServerDraft | null;
  profile?: ProfileCard | null;
};

const errorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

export class PeerSession extends EventEmitter {
  session: Session = createIdleSession();
  role: PeerRole = 'idle';
  clientId = generateId();
  lastPongMs: number | null = null;
  error = '';
  ice: IceReport = emptyIceReport();
  links: PeerLinks | null = null;
  config: PeerSessionConfig;
  waitGen = 0;
  waitTimer: ReturnType<typeof setTimeout> | null = null;
  pipe: FilePipe | null = null;
  store: OpfsStore | null = null;
  peerId = '';
  pendingCandidates: IceCandidateInit[] = [];

  get state(): SessionState {
    return this.session.state;
  }

  constructor(config: PeerSessionConfig) {
    super();
    this.config = config;
    if (config.profile?.id) this.clientId = config.profile.id;
  }

  setProfile(profile: ProfileCard | null) {
    this.config = { ...this.config, profile };
    this.sendProfile();
  }

  outgoing() {
    return this.config.signaling.outgoing?.() ?? '';
  }

  async createInvite() {
    this.reset();
    this.role = 'caller';
    this.apply({ type: 'start' });
    const signaling = this.config.signaling;
    if (isManualPort(signaling)) {
      signaling.setShareServers(this.config.shareServers ?? null);
    }
    await signaling.connect({ roomId: 'manual', clientId: this.clientId });
    signaling.subscribe((message) => this.onSignal(message));
    try {
      await this.offerTo('*');
      this.emit('invite');
    } catch (err) {
      this.fail(errorMessage(err, 'Не удалось создать приглашение'));
    }
  }

  async enterRoom(roomId: string) {
    this.reset();
    this.apply({ type: 'start' });
    const signaling = this.config.signaling;
    try {
      await signaling.connect({ roomId, clientId: this.clientId });
      signaling.subscribe((message) => this.onSignal(message));
      const peerId = await this.waitPeer();
      this.peerId = peerId;
      if (this.clientId < peerId) {
        this.role = 'caller';
        await this.offerTo(peerId);
      } else {
        this.role = 'callee';
      }
      this.emit('invite');
    } catch (err) {
      if (this.session.state === 'idle' || this.session.state === 'closed') {
        return;
      }
      this.fail(errorMessage(err, 'Не удалось войти в комнату'));
    }
  }

  canTrickle() {
    return !isManualPort(this.config.signaling);
  }

  async offerTo(to: string) {
    const signaling = this.config.signaling;
    this.peerId = to;
    const pc = createPeerConnection(this.config.iceServers);
    this.links = createLocalChannels(pc);
    this.bindPeer(pc);
    this.bindControl(this.links.control);
    this.bindBytes(this.links.bytes);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (!this.canTrickle()) {
      await waitIceGathering(pc, {
        wantRelay: iceServersHaveTurn(this.config.iceServers),
      });
    }
    this.noteLocalSdp(localSdp(pc));
    await signaling.send({
      from: this.clientId,
      to,
      data: { type: 'offer', payload: { sdp: localSdp(pc) } },
    });
  }

  async acceptInvite(text: string) {
    this.reset();
    this.role = 'callee';
    this.apply({ type: 'start' });
    const signaling = this.config.signaling;
    if (!signaling.accept) {
      const failed = {
        ok: false as const,
        code: 'no-accept',
        message: 'Этот signaling не принимает текст',
      };
      this.fail(failed.message);
      return failed;
    }
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
    if (!this.config.signaling.accept) {
      const failed = {
        ok: false as const,
        code: 'no-accept',
        message: 'Этот signaling не принимает текст',
      };
      this.fail(failed.message);
      return failed;
    }
    const accepted = await this.config.signaling.accept(text);
    if (!accepted.ok) {
      this.fail(accepted.message);
      return accepted;
    }
    return accepted;
  }

  setStore(store: OpfsStore | null) {
    this.store = store;
    this.pipe?.setStore(store);
  }

  sendFile(file: File) {
    this.ensurePipe();
    this.pipe?.sendFile(file);
  }

  sendFolder(entries: PickedFile[]) {
    this.ensurePipe();
    this.pipe?.sendFolder(entries);
  }

  acceptFile(transferId: string) {
    this.pipe?.accept(transferId);
  }

  rejectFile(transferId: string, reason?: string) {
    this.pipe?.reject(transferId, reason);
  }

  cancelFile() {
    this.pipe?.cancel();
  }

  pauseFile() {
    this.pipe?.pause();
  }

  resumeFile() {
    this.pipe?.resume();
  }

  currentTransfer() {
    return this.pipe?.current() ?? null;
  }

  activeFile() {
    return this.pipe?.active ?? null;
  }

  incomingFile() {
    return this.pipe?.incoming ?? null;
  }

  activeFolder() {
    return this.pipe?.activeFolder ?? null;
  }

  incomingFolder() {
    return this.pipe?.incomingFolder ?? null;
  }

  ping() {
    const channel = this.links?.control;
    if (!channel || channel.readyState !== 'open') return;
    const payload = JSON.stringify({ type: 'ping', t: Date.now() });
    channel.send(payload);
  }

  close() {
    this.waitGen += 1;
    if (this.waitTimer) clearTimeout(this.waitTimer);
    this.waitTimer = null;
    this.dropPipe();
    this.config.signaling.close();
    const links = this.links;
    this.links = null;
    this.role = 'idle';
    this.lastPongMs = null;
    this.ice = emptyIceReport();
    this.peerId = '';
    this.pendingCandidates = [];
    if (links) {
      links.control?.close();
      links.bytes?.close();
      links.pc.close();
    }
    this.apply({ type: 'close' });
  }

  reset() {
    this.waitGen += 1;
    if (this.waitTimer) clearTimeout(this.waitTimer);
    this.waitTimer = null;
    this.dropPipe();
    this.error = '';
    this.lastPongMs = null;
    this.ice = emptyIceReport();
    this.peerId = '';
    this.pendingCandidates = [];
    this.config.signaling.close();
    const links = this.links;
    this.links = null;
    if (links) {
      links.control?.close();
      links.bytes?.close();
      links.pc.close();
    }
    this.apply({ type: 'reset' });
  }

  async waitPeer() {
    const gen = this.waitGen;
    if (!this.config.signaling.listPeers) {
      throw new Error('Нет списка пиров');
    }
    while (gen === this.waitGen) {
      if (
        this.session.state === 'failed' ||
        this.session.state === 'closed' ||
        this.session.state === 'idle'
      ) {
        throw new Error('Сессия закрыта');
      }
      const peers = await this.config.signaling.listPeers();
      if (gen !== this.waitGen) throw new Error('Сессия закрыта');
      if (peers[0]) return peers[0];
      await this.sleep(800);
    }
    throw new Error('Сессия закрыта');
  }

  sleep(ms: number) {
    return new Promise<void>((resolve) => {
      this.waitTimer = setTimeout(resolve, ms);
    });
  }

  apply(event: SessionEvent) {
    this.session = applySessionEvent(this.session, event);
    if (event.type === 'fail') this.error = this.session.error;
    this.emit('state', this.session.state);
  }

  fail(message: string) {
    this.error = message;
    this.apply({ type: 'fail', message });
    this.emit('error', message);
  }

  failIce() {
    this.fail(
      explainIceFailure({
        local: this.ice.local,
        remote: this.ice.remote,
        hasTurn: iceServersHaveTurn(this.config.iceServers),
        hasStun: iceServersHaveStun(this.config.iceServers),
        gathering: this.ice.gatheringState,
      }),
    );
  }

  async onSignal(message: SignalMessage) {
    if (message.data.type === 'offer') {
      await this.handleOffer(message);
      return;
    }
    if (message.data.type === 'answer') {
      await this.handleAnswer(message);
      return;
    }
    if (message.data.type === 'candidate') {
      await this.handleCandidate(message);
    }
  }

  async handleOffer(message: SignalMessage) {
    const payload = message.data.payload as { sdp?: string };
    if (!payload.sdp) {
      this.fail('В приглашении нет SDP');
      return;
    }
    try {
      this.peerId = message.from;
      const pc = createPeerConnection(this.config.iceServers);
      this.links = { pc, control: null, bytes: null };
      this.bindPeer(pc);
      pc.ondatachannel = (event) => {
        attachRemoteChannels(this.links as PeerLinks, event.channel);
        if (event.channel.label === DATA_CHANNELS.control) {
          this.bindControl(event.channel);
        }
        if (event.channel.label === DATA_CHANNELS.bytes) {
          this.bindBytes(event.channel);
        }
      };
      await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp });
      this.noteRemoteSdp(payload.sdp);
      await this.flushCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (!this.canTrickle()) {
        await waitIceGathering(pc, {
          wantRelay: iceServersHaveTurn(this.config.iceServers),
        });
      }
      this.noteLocalSdp(localSdp(pc));
      this.apply({ type: 'remote-ready' });
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
      if (message.from) this.peerId = message.from;
      await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
      this.noteRemoteSdp(payload.sdp);
      await this.flushCandidates();
      this.apply({ type: 'remote-ready' });
    } catch (err) {
      this.fail(errorMessage(err, 'Не удалось принять ответ'));
    }
  }

  async handleCandidate(message: SignalMessage) {
    if (message.from) this.peerId = message.from;
    const init = parseIceCandidateInit(message.data.payload);
    if (!init) return;
    const pc = this.links?.pc;
    if (!pc?.remoteDescription) {
      this.pendingCandidates.push(init);
      return;
    }
    await this.addCandidate(pc, init);
  }

  async flushCandidates() {
    const pc = this.links?.pc;
    if (!pc?.remoteDescription) return;
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const init of queued) await this.addCandidate(pc, init);
  }

  async addCandidate(pc: RTCPeerConnection, init: IceCandidateInit) {
    try {
      await pc.addIceCandidate(init);
      this.ice = {
        ...this.ice,
        remote: addUniquePath(
          this.ice.remote,
          classifyCandidate(init.candidate),
        ),
      };
      this.emit('ice', this.ice);
    } catch {
      return;
    }
  }

  sendLocalCandidate(init: IceCandidateInit) {
    if (!this.canTrickle() || !this.peerId || this.peerId === '*') return;
    void this.config.signaling.send({
      from: this.clientId,
      to: this.peerId,
      data: { type: 'candidate', payload: init },
    });
  }

  bindPeer(pc: RTCPeerConnection) {
    pc.onicecandidate = (event) => {
      if (this.links?.pc !== pc) return;
      const candidate = event.candidate;
      const line = candidate?.candidate;
      if (!line) return;
      this.ice = {
        ...this.ice,
        local: addUniquePath(this.ice.local, classifyCandidate(line)),
        gatheringState: pc.iceGatheringState,
      };
      this.emit('ice', this.ice);
      this.sendLocalCandidate({
        candidate: line,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
      });
    };
    pc.onconnectionstatechange = () => {
      if (this.links?.pc !== pc) return;
      this.ice = { ...this.ice, connectionState: pc.connectionState };
      this.emit('ice', this.ice);
      void this.pullSelected();
      if (pc.connectionState === 'failed') this.failIce();
      if (pc.connectionState === 'closed') this.apply({ type: 'close' });
    };
  }

  noteRemoteSdp(sdp: string) {
    this.ice = { ...this.ice, remote: pathsFromSdp(sdp) };
    this.emit('ice', this.ice);
  }

  noteLocalSdp(sdp: string) {
    let local = this.ice.local;
    for (const path of pathsFromSdp(sdp)) {
      local = addUniquePath(local, path);
    }
    this.ice = {
      ...this.ice,
      local,
      gatheringState:
        this.links?.pc.iceGatheringState ?? this.ice.gatheringState,
    };
    this.emit('ice', this.ice);
  }

  async pullSelected() {
    const pc = this.links?.pc;
    if (!pc) return;
    try {
      const stats = await pc.getStats();
      this.ice = {
        ...this.ice,
        connectionState: pc.connectionState,
        gatheringState: pc.iceGatheringState,
        selected: pairFromStats(stats.values()),
      };
      this.emit('ice', this.ice);
    } catch {
      this.emit('ice', this.ice);
    }
  }

  bindControl(channel: RTCDataChannel | null) {
    if (!channel) return;
    channel.onopen = () => {
      this.apply({ type: 'channel-open' });
      this.ensurePipe();
      void this.pullSelected();
      this.sendProfile();
      this.emit('channel-open');
    };
    channel.onclose = () => {
      if (this.session.state === 'connected') this.apply({ type: 'close' });
    };
    channel.onmessage = (event) => {
      this.onControl(String(event.data));
    };
  }

  bindBytes(channel: RTCDataChannel | null) {
    if (!channel) return;
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = CHANNEL_BUFFER_HIGH;
    channel.onopen = () => {
      this.ensurePipe();
    };
    channel.onmessage = (event) => {
      const data = event.data;
      if (data instanceof ArrayBuffer) void this.pipe?.onBytes(data);
    };
  }

  ensurePipe() {
    if (this.pipe) return;
    const links = this.links;
    if (!links?.control || !links.bytes) return;
    if (links.control.readyState !== 'open') return;
    if (links.bytes.readyState !== 'open') return;
    const pipe = new FilePipe({
      control: links.control,
      bytes: links.bytes as unknown as DataSink,
      store: this.store,
    });
    pipe.on('transfer', (value) => this.emit('transfer', value));
    pipe.on('offer', (value) => this.emit('file-offer', value));
    pipe.on('folder', (value) => this.emit('folder', value));
    pipe.on('folder-offer', (value) => this.emit('folder-offer', value));
    pipe.on('received', (value) => this.emit('file-received', value));
    pipe.on('error', (value) => this.emit('error', value));
    this.pipe = pipe;
  }

  dropPipe() {
    if (!this.pipe) return;
    this.pipe.interrupt();
    this.pipe = null;
  }

  sendProfile() {
    const profile = this.config.profile;
    const channel = this.links?.control;
    if (!profile || !channel || channel.readyState !== 'open') return;
    // Id + nick first — avatar can be large and block the meet handshake.
    channel.send(
      JSON.stringify({
        type: 'profile',
        id: profile.id,
        nick: profile.nick,
        avatar: '',
      }),
    );
    if (profile.avatar) {
      channel.send(
        JSON.stringify({
          type: 'profile',
          id: profile.id,
          nick: profile.nick,
          avatar: profile.avatar,
        }),
      );
    }
  }

  onControl(raw: string) {
    if (this.pipe?.onControlRaw(raw)) return;
    try {
      const data = JSON.parse(raw) as { type?: string; t?: number };
      if (data.type === 'profile') {
        const card = parseProfileCard(data);
        if (card) this.emit('profile', card);
        return;
      }
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
