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
import { openCallMedia, stopStream } from '@/lib/call-media.ts';
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

  const publish = () => touch();

  const setSession = (next: CallSession) => {
    callSession.value = next;
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
      stopStream(localMedia.value);
      localMedia.value = markRaw(stream);
      callKind.value = kind;
      callPeerId.value = peerId;
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
      // Active call stays; remote should receive busy via signaling (later).
      return false;
    }
    setSession(
      applyCallSessionEvent(callSession.value, {
        type: 'incoming',
        peerId,
      }),
    );
    callPeerId.value = peerId;
    publish();
    return true;
  }

  function onAcceptCall() {
    const leg = primaryCallLeg(callSession.value);
    if (!leg || leg.state !== 'ringing' || leg.direction !== 'in') return;
    setSession(
      applyCallSessionEvent(callSession.value, {
        type: 'accept',
        legId: leg.id,
      }),
    );
    publish();
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
    callKind.value = null;
    callPeerId.value = null;
    publish();
  }

  function onHangUp() {
    setSession(applyCallSessionEvent(callSession.value, { type: 'hangup' }));
    stopStream(localMedia.value);
    localMedia.value = null;
    remoteMedia.value = null;
    callKind.value = null;
    callPeerId.value = null;
    callError.value = '';
    state.peer?.clearLocalStream();
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
    onRemoteTrack,
    onStartCall,
    onIncomingCall,
    onAcceptCall,
    onRejectCall,
    onHangUp,
    startCallIntent,
  };
}
