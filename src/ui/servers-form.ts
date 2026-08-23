import {
  draftIceServersFromText,
  parseIceServersJson,
  splitIceServers,
} from '@/config/ice-draft.ts';
import type { CustomServerDraft } from '@/config/types.ts';

export const readCustomDraft = (input: {
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
  const url = input.signalingUrl.trim();
  if (!url) return { signaling: { kind: 'manual' }, iceServers };
  return {
    signaling: { kind: 'websocket', url },
    iceServers,
  };
};

export const customDraftToForm = (draft: CustomServerDraft) => {
  const ice = splitIceServers(draft.iceServers);
  return {
    signalingUrl: draft.signaling.url ?? '',
    stun: ice.stun.join('\n'),
    turnUrl: ice.turn.join('\n'),
    turnUser: ice.username,
    turnPass: ice.credential,
    iceJson: '',
  };
};
