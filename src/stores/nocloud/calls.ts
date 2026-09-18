import {
  createCallController,
  type CallControllerState,
  type MediaCallKind,
} from '@/lib/call-controller.ts';
import type { CallIntent } from '@/lib/call-intent.ts';
import {
  appendCallLog,
  loadCallLog,
  saveCallLog,
  type CallLogEntry,
  type CallLogOutcome,
} from '@/lib/call-log.ts';
import { openCallMedia } from '@/lib/call-media.ts';
import { markRaw, ref, shallowRef } from 'vue';
import type { CallSession } from '@/domain/call/index.ts';
import { createIdleCallSession } from '@/domain/call/index.ts';
import type { NocloudContext } from './context.ts';

export type { MediaCallKind };

export function createCallsSlice(ctx: NocloudContext) {
  const { state, touch, storage } = ctx;
  const localMedia = shallowRef<MediaStream | null>(null);
  const remoteMedia = shallowRef<MediaStream | null>(null);
  const callKind = shallowRef<MediaCallKind | null>(null);
  const callPeerId = shallowRef<string | null>(null);
  const callError = shallowRef('');
  const callSession = shallowRef<CallSession>(createIdleCallSession());
  const callLog = ref<CallLogEntry[]>(loadCallLog(storage));
  const micOn = shallowRef(true);
  const camOn = shallowRef(true);

  const syncUi = (next: CallControllerState) => {
    callSession.value = next.session;
    localMedia.value = next.localMedia ? markRaw(next.localMedia) : null;
    remoteMedia.value = next.remoteMedia ? markRaw(next.remoteMedia) : null;
    callKind.value = next.callKind;
    callPeerId.value = next.callPeerId;
    callError.value = next.callError;
    micOn.value = next.micOn;
    camOn.value = next.camOn;
    if (next.notice) state.contactsNotice = next.notice;
    touch();
  };

  const recordCall = (
    peerId: string,
    direction: 'in' | 'out',
    outcome: CallLogOutcome,
  ) => {
    callLog.value = appendCallLog(callLog.value, {
      peerId,
      direction,
      outcome,
    });
    saveCallLog(storage, callLog.value);
  };

  const controller = createCallController({
    openMedia: openCallMedia,
    getPeer: () => state.peer,
    knockOn: async (peerId, asHost) => {
      await ctx.refs.knockOn?.(peerId, asHost);
    },
    selfId: () => state.me.id,
    recordCall,
    onChange: syncUi,
  });

  async function startCallIntent(intent: CallIntent) {
    if (intent.kind === 'data') return;
    await controller.dial(intent.peerId, intent.kind);
  }

  return {
    localMedia,
    remoteMedia,
    callKind,
    callPeerId,
    callError,
    callSession,
    callLog,
    micOn,
    camOn,
    onRemoteTrack: controller.remoteTrack,
    onStartCall: controller.dial,
    onIncomingCall: controller.incoming,
    onAcceptCall: controller.accept,
    onRejectCall: controller.reject,
    onHangUp: controller.hangUp,
    onPeerError: controller.peerError,
    onToggleMute: controller.toggleMute,
    onToggleCamera: controller.toggleCamera,
    startCallIntent,
  };
}
