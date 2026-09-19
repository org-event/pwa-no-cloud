import { componentsCopy } from '@/content/index.ts';
import {
  applyCallSessionEvent,
  createIdleCallSession,
  isCallBusy,
  primaryCallLeg,
  type CallSession,
} from '@/domain/call/index.ts';
import { CALL_KIND_LABEL, type CallKind } from '@/lib/call-intent.ts';
import type { CallLogOutcome } from '@/lib/call-log.ts';
import {
  onScreenShareEnded,
  setTracksEnabled,
  stopStream,
  tracksEnabled,
} from '@/lib/call-media.ts';

export type MediaCallKind = Exclude<CallKind, 'data'>;

export type CallMediaPeer = {
  setLocalStream(stream: MediaStream | null): void;
  clearLocalStream(): void;
};

export type CallControllerCopy = {
  inCall: string;
  calling: string;
  active: string;
  needPermission: string;
};

export type CallControllerState = {
  session: CallSession;
  localMedia: MediaStream | null;
  remoteMedia: MediaStream | null;
  callKind: MediaCallKind | null;
  callPeerId: string | null;
  callError: string;
  micOn: boolean;
  camOn: boolean;
  /** Side notice for the shell (contacts banner). */
  notice: string;
};

export type CallControllerDeps = {
  openMedia: (kind: MediaCallKind) => Promise<MediaStream>;
  getPeer: () => CallMediaPeer | null;
  knockOn?: (peerId: string, asHost: boolean) => Promise<void>;
  selfId: () => string;
  recordCall: (
    peerId: string,
    direction: 'in' | 'out',
    outcome: CallLogOutcome,
  ) => void;
  onChange: (state: CallControllerState) => void;
  copy?: CallControllerCopy;
};

const defaultCopy = (): CallControllerCopy => ({
  inCall: componentsCopy.calls.inCall,
  calling: componentsCopy.calls.calling,
  active: componentsCopy.calls.active,
  needPermission: componentsCopy.calls.needPermission,
});

/**
 * Deep module for Call: FSM + local media + attach to Link.
 * UI/store are thin adapters over this interface.
 */
export function createCallController(deps: CallControllerDeps) {
  const copy = deps.copy ?? defaultCopy();
  let session = createIdleCallSession();
  let localMedia: MediaStream | null = null;
  let remoteMedia: MediaStream | null = null;
  let callKind: MediaCallKind | null = null;
  let callPeerId: string | null = null;
  let callError = '';
  let micOn = true;
  let camOn = true;
  let notice = '';
  let unbindScreenEnded: (() => void) | null = null;

  const snapshot = (): CallControllerState => ({
    session,
    localMedia,
    remoteMedia,
    callKind,
    callPeerId,
    callError,
    micOn,
    camOn,
    notice,
  });

  const publish = () => deps.onChange(snapshot());

  const setSession = (next: CallSession) => {
    session = next;
  };

  const syncTrackFlags = () => {
    micOn = tracksEnabled(localMedia, 'audio');
    camOn = tracksEnabled(localMedia, 'video');
  };

  const clearScreenEnded = () => {
    unbindScreenEnded?.();
    unbindScreenEnded = null;
  };

  const clearMedia = () => {
    clearScreenEnded();
    const stream = localMedia;
    localMedia = null;
    remoteMedia = null;
    callKind = null;
    callPeerId = null;
    callError = '';
    micOn = true;
    camOn = true;
    deps.getPeer()?.clearLocalStream();
    stopStream(stream);
  };

  const bindScreenIfNeeded = (kind: MediaCallKind, stream: MediaStream) => {
    clearScreenEnded();
    if (kind !== 'screen') return;
    unbindScreenEnded = onScreenShareEnded(stream, () => {
      hangUp();
    });
  };

  const remoteTrack = (stream: MediaStream) => {
    remoteMedia = stream;
    const leg = primaryCallLeg(session);
    if (leg && (leg.state === 'outbound' || leg.state === 'ringing')) {
      setSession(
        applyCallSessionEvent(session, {
          type: 'leg-active',
          legId: leg.id,
        }),
      );
    }
    publish();
  };

  const dial = async (peerId: string, kind: MediaCallKind) => {
    callError = '';
    if (isCallBusy(session)) {
      callError = copy.inCall;
      notice = copy.inCall;
      publish();
      return;
    }
    try {
      const stream = await deps.openMedia(kind);
      clearScreenEnded();
      stopStream(localMedia);
      localMedia = stream;
      callKind = kind;
      callPeerId = peerId;
      syncTrackFlags();
      bindScreenIfNeeded(kind, stream);
      setSession(applyCallSessionEvent(session, { type: 'dial', peerId }));
      deps.recordCall(peerId, 'out', 'started');
      deps.getPeer()?.setLocalStream(stream);
      notice = `${copy.calling} (${CALL_KIND_LABEL[kind]})`;
      publish();
      await deps.knockOn?.(peerId, false);
      const leg = primaryCallLeg(session);
      if (leg?.state === 'outbound') {
        setSession(
          applyCallSessionEvent(session, {
            type: 'remote-ringing',
            legId: leg.id,
          }),
        );
      }
      publish();
    } catch {
      const leg = primaryCallLeg(session);
      if (leg) {
        setSession(
          applyCallSessionEvent(session, {
            type: 'leg-fail',
            legId: leg.id,
            message: copy.needPermission,
          }),
        );
      }
      deps.recordCall(peerId, 'out', 'failed');
      callError = copy.needPermission;
      notice = copy.needPermission;
      publish();
    }
  };

  const incoming = (peerId: string): boolean => {
    if (isCallBusy(session)) return false;
    setSession(applyCallSessionEvent(session, { type: 'incoming', peerId }));
    callPeerId = peerId;
    callKind = null;
    callError = '';
    deps.recordCall(peerId, 'in', 'started');
    publish();
    return true;
  };

  const accept = async (kind: MediaCallKind = 'audio') => {
    const leg = primaryCallLeg(session);
    if (!leg || leg.state !== 'ringing' || leg.direction !== 'in') return;
    callError = '';
    try {
      const stream = await deps.openMedia(kind);
      clearScreenEnded();
      stopStream(localMedia);
      localMedia = stream;
      callKind = kind;
      callPeerId = leg.peerId;
      syncTrackFlags();
      bindScreenIfNeeded(kind, stream);
      setSession(
        applyCallSessionEvent(session, { type: 'accept', legId: leg.id }),
      );
      deps.recordCall(leg.peerId, 'in', 'answered');
      deps.getPeer()?.setLocalStream(stream);
      notice = `${copy.active} (${CALL_KIND_LABEL[kind]})`;
      publish();
      await deps.knockOn?.(deps.selfId(), true);
      publish();
    } catch {
      setSession(
        applyCallSessionEvent(session, {
          type: 'leg-fail',
          legId: leg.id,
          message: copy.needPermission,
        }),
      );
      deps.recordCall(leg.peerId, 'in', 'failed');
      callError = copy.needPermission;
      notice = copy.needPermission;
      publish();
    }
  };

  const reject = () => {
    const leg = primaryCallLeg(session);
    if (!leg || leg.state !== 'ringing') return;
    setSession(
      applyCallSessionEvent(session, { type: 'reject', legId: leg.id }),
    );
    deps.recordCall(leg.peerId, leg.direction, 'rejected');
    clearMedia();
    publish();
  };

  const peerError = (message: string) => {
    const leg = primaryCallLeg(session);
    if (!leg) return;
    if (
      leg.state === 'ended' ||
      leg.state === 'failed' ||
      leg.state === 'rejected' ||
      leg.state === 'busy'
    ) {
      return;
    }
    setSession(
      applyCallSessionEvent(session, {
        type: 'leg-fail',
        legId: leg.id,
        message,
      }),
    );
    deps.recordCall(leg.peerId, leg.direction, 'failed');
    callError = message;
    notice = message;
    clearScreenEnded();
    const stream = localMedia;
    localMedia = null;
    remoteMedia = null;
    callKind = null;
    micOn = true;
    camOn = true;
    deps.getPeer()?.clearLocalStream();
    stopStream(stream);
    publish();
  };

  const hangUp = () => {
    const leg = primaryCallLeg(session);
    if (leg && !['ended', 'failed', 'rejected', 'busy'].includes(leg.state)) {
      const outcome: CallLogOutcome =
        leg.direction === 'in' && leg.state === 'ringing' ? 'missed' : 'ended';
      deps.recordCall(leg.peerId, leg.direction, outcome);
    }
    setSession(applyCallSessionEvent(session, { type: 'hangup' }));
    clearMedia();
    publish();
  };

  const toggleMute = () => {
    if (!localMedia) return;
    const next = !micOn;
    if (!setTracksEnabled(localMedia, 'audio', next)) return;
    micOn = next;
    publish();
  };

  const toggleCamera = () => {
    if (!localMedia) return;
    if (callKind !== 'video' && callKind !== 'screen') return;
    const next = !camOn;
    if (!setTracksEnabled(localMedia, 'video', next)) return;
    camOn = next;
    publish();
  };

  return {
    getState: snapshot,
    dial,
    incoming,
    accept,
    reject,
    hangUp,
    peerError,
    remoteTrack,
    toggleMute,
    toggleCamera,
  };
}

export type CallController = ReturnType<typeof createCallController>;
