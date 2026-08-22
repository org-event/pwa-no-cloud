import {
  draftIceServersFromText,
  parseIceServersJson,
  splitIceServers,
} from '../config/ice-draft.ts';
import type { CustomServerDraft, SignalingKind } from '../config/types.ts';

export const SIGNALING_KIND_OPTIONS: { id: SignalingKind; title: string }[] = [
  { id: 'manual', title: 'Вручную (QR / текст)' },
  { id: 'http-poll', title: 'HTTP poll' },
  { id: 'websocket', title: 'WebSocket' },
];

export const readCustomDraft = (input: {
  kind: SignalingKind;
  signalingUrl: string;
  stun: string;
  turnUrl: string;
  turnUser: string;
  turnPass: string;
  iceJson: string;
}): CustomServerDraft | { error: string } => {
  const parsed = parseIceServersJson(input.iceJson);
  if (!parsed.ok) return { error: parsed.message };
  const iceServers =
    parsed.value.length > 0
      ? parsed.value
      : draftIceServersFromText({
          stun: input.stun,
          turn: input.turnUrl,
          username: input.turnUser,
          credential: input.turnPass,
        });
  const signaling = { kind: input.kind };
  if (signaling.kind !== 'manual') {
    return {
      signaling: { ...signaling, url: input.signalingUrl.trim() },
      iceServers,
    };
  }
  return { signaling, iceServers };
};

export const customDraftToForm = (draft: CustomServerDraft) => {
  const ice = splitIceServers(draft.iceServers);
  return {
    kind: draft.signaling.kind,
    signalingUrl: draft.signaling.url ?? '',
    stun: ice.stun.join('\n'),
    turnUrl: ice.turn.join('\n'),
    turnUser: ice.username,
    turnPass: ice.credential,
    iceJson: '',
  };
};
