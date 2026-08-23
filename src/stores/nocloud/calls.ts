import { componentsCopy } from '@/content/index.ts';
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

  const publish = () => touch();

  const onRemoteTrack = (stream: MediaStream) => {
    remoteMedia.value = markRaw(stream);
    publish();
  };

  async function onStartCall(peerId: string, kind: MediaCallKind) {
    callError.value = '';
    try {
      const stream = await openCallMedia(kind);
      stopStream(localMedia.value);
      localMedia.value = markRaw(stream);
      callKind.value = kind;
      callPeerId.value = peerId;
      state.peer?.setLocalStream(stream);
      state.contactsNotice = `${componentsCopy.calls.calling} (${CALL_KIND_LABEL[kind]})`;
      publish();
      await ctx.refs.knockOn?.(peerId, false);
      publish();
    } catch {
      callError.value = componentsCopy.calls.needPermission;
      state.contactsNotice = componentsCopy.calls.needPermission;
      publish();
    }
  }

  function onHangUp() {
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
    onRemoteTrack,
    onStartCall,
    onHangUp,
    startCallIntent,
  };
}
