import { componentsCopy } from '@/content/index.ts';
import {
  applyCallSessionEvent,
  createIdleCallSession,
  isCallBusy,
  primaryCallLeg,
  type CallSession,
} from '@/domain/call/index.ts';
import {
  CALL_KIND_LABEL,
  type CallIntent,
  type CallKind,
} from '@/lib/call-intent.ts';
import {
  openCallMedia,
  onScreenShareEnded,
  setTracksEnabled,
  stopStream,
  tracksEnabled,
} from '@/lib/call-media.ts';
import { markRaw, shallowRef } from 'vue';
import type { NocloudContext } from './context.ts';

export type MediaCallKind = Exclude<CallKind, 'data'>;

export function createCallsSlice(ctx: NocloudContext) {
  const { state, touch } = ctx;
  const localMedia = shallowRef<MediaStream | null>(null);
  const remoteMedia = shallowRef<MediaStream | null>(null);
  const callKind = shallowRef<MediaCallKind | null>(null);
  const callPeerId = shallowRef<string | null>(null);
  const callError = shallowRef('');
  const callSession = shallowRef<CallSession>(createIdleCallSession());
  const micOn = shallowRef(true);
  const camOn = shallowRef(true);
  let unbindScreenEnded: (() => void) | null = null;

  const publish = () => touch();

  const setSession = (next: CallSession) => {
    callSession.value = next;
  };

  const syncTrackFlags = () => {
    micOn.value = tracksEnabled(localMedia.value, 'audio');
    camOn.value = tracksEnabled(localMedia.value, 'video');
  };

  const clearScreenEnded = () => {
    unbindScreenEnded?.();
    unbindScreenEnded = null;
  };

  const clearMediaUi = () => {
    clearScreenEnded();
    const stream = localMedia.value;
    localMedia.value = null;
    remoteMedia.value = null;
    callKind.value = null;
    callPeerId.value = null;
    callError.value = '';
    micOn.value = true;
    camOn.value = true;
    // Detach from PC first so data/ping stay; then stop display/mic tracks.
    state.peer?.clearLocalStream();
    stopStream(stream);
  };

  const bindScreenIfNeeded = (kind: MediaCallKind, stream: MediaStream) => {
    clearScreenEnded();
    if (kind !== 'screen') return;
    unbindScreenEnded = onScreenShareEnded(stream, () => {
      onHangUp();
    });
  };

  const onRemoteTrack = (stream: MediaStream) => {
    remoteMedia.value = markRaw(stream);
    const leg = primaryCallLeg(callSession.value);
    if (leg && (leg.state === 'outbound' || leg.state === 'ringing')) {
      setSession(
        applyCallSessionEvent(callSession.value, {
          type: 'leg-active',
          legId: leg.id,
        }),
      );
    }
    publish();
  };

  async function onStartCall(peerId: string, kind: MediaCallKind) {
    callError.value = '';
    if (isCallBusy(callSession.value)) {
      callError.value = componentsCopy.calls.inCall;
      state.contactsNotice = componentsCopy.calls.inCall;
      publish();
      return;
    }
    try {
      const stream = await openCallMedia(kind);
      clearScreenEnded();
      stopStream(localMedia.value);
      localMedia.value = markRaw(stream);
      callKind.value = kind;
      callPeerId.value = peerId;
      syncTrackFlags();
      bindScreenIfNeeded(kind, stream);
      setSession(
        applyCallSessionEvent(callSession.value, {
          type: 'dial',
          peerId,
        }),
      );
      state.peer?.setLocalStream(stream);
      state.contactsNotice = `${componentsCopy.calls.calling} (${CALL_KIND_LABEL[kind]})`;
      publish();
      await ctx.refs.knockOn?.(peerId, false);
      const leg = primaryCallLeg(callSession.value);
      if (leg?.state === 'outbound') {
        setSession(
          applyCallSessionEvent(callSession.value, {
            type: 'remote-ringing',
            legId: leg.id,
          }),
        );
      }
      publish();
    } catch {
      const leg = primaryCallLeg(callSession.value);
      if (leg) {
        setSession(
          applyCallSessionEvent(callSession.value, {
            type: 'leg-fail',
            legId: leg.id,
            message: componentsCopy.calls.needPermission,
          }),
        );
      }
      callError.value = componentsCopy.calls.needPermission;
      state.contactsNotice = componentsCopy.calls.needPermission;
      publish();
    }
  }

  function onIncomingCall(peerId: string) {
    if (isCallBusy(callSession.value)) {
      return false;
    }
    setSession(
      applyCallSessionEvent(callSession.value, {
        type: 'incoming',
        peerId,
      }),
    );
    callPeerId.value = peerId;
    callKind.value = null;
    callError.value = '';
    publish();
    return true;
  }

  async function onAcceptCall(kind: MediaCallKind = 'audio') {
    const leg = primaryCallLeg(callSession.value);
    if (!leg || leg.state !== 'ringing' || leg.direction !== 'in') return;
    callError.value = '';
    try {
      const stream = await openCallMedia(kind);
      clearScreenEnded();
      stopStream(localMedia.value);
      localMedia.value = markRaw(stream);
      callKind.value = kind;
      callPeerId.value = leg.peerId;
      syncTrackFlags();
      bindScreenIfNeeded(kind, stream);
      setSession(
        applyCallSessionEvent(callSession.value, {
          type: 'accept',
          legId: leg.id,
        }),
      );
      state.peer?.setLocalStream(stream);
      state.contactsNotice = `${componentsCopy.calls.active} (${CALL_KIND_LABEL[kind]})`;
      publish();
      await ctx.refs.knockOn?.(state.me.id, true);
      publish();
    } catch {
      setSession(
        applyCallSessionEvent(callSession.value, {
          type: 'leg-fail',
          legId: leg.id,
          message: componentsCopy.calls.needPermission,
        }),
      );
      callError.value = componentsCopy.calls.needPermission;
      state.contactsNotice = componentsCopy.calls.needPermission;
      publish();
    }
  }

  function onRejectCall() {
    const leg = primaryCallLeg(callSession.value);
    if (!leg || leg.state !== 'ringing') return;
    setSession(
      applyCallSessionEvent(callSession.value, {
        type: 'reject',
        legId: leg.id,
      }),
    );
    clearMediaUi();
    publish();
  }

  function onPeerError(message: string) {
    const leg = primaryCallLeg(callSession.value);
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
      applyCallSessionEvent(callSession.value, {
        type: 'leg-fail',
        legId: leg.id,
        message,
      }),
    );
    callError.value = message;
    state.contactsNotice = message;
    clearScreenEnded();
    const stream = localMedia.value;
    localMedia.value = null;
    remoteMedia.value = null;
    callKind.value = null;
    micOn.value = true;
    camOn.value = true;
    state.peer?.clearLocalStream();
    stopStream(stream);
    publish();
  }

  function onHangUp() {
    setSession(applyCallSessionEvent(callSession.value, { type: 'hangup' }));
    clearMediaUi();
    publish();
  }

  function onToggleMute() {
    if (!localMedia.value) return;
    const next = !micOn.value;
    if (!setTracksEnabled(localMedia.value, 'audio', next)) return;
    micOn.value = next;
    publish();
  }

  function onToggleCamera() {
    if (!localMedia.value) return;
    if (callKind.value !== 'video' && callKind.value !== 'screen') return;
    const next = !camOn.value;
    if (!setTracksEnabled(localMedia.value, 'video', next)) return;
    camOn.value = next;
    publish();
  }

  async function startCallIntent(intent: CallIntent) {
    if (intent.kind === 'data') return;
    await onStartCall(intent.peerId, intent.kind);
  }

  return {
    localMedia,
    remoteMedia,
    callKind,
    callPeerId,
    callError,
    callSession,
    micOn,
    camOn,
    onRemoteTrack,
    onStartCall,
    onIncomingCall,
    onAcceptCall,
    onRejectCall,
    onHangUp,
    onPeerError,
    onToggleMute,
    onToggleCamera,
    startCallIntent,
  };
}
