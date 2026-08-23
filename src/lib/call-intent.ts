/**
 * Future media calls ride the same PeerSession / room model as file transfer.
 * Presence + knock ship now; tracks are plugged in later.
 */
export type CallKind = 'data' | 'audio' | 'video' | 'screen';

export type CallIntent = {
  kind: CallKind;
  peerId: string;
  /** Own lobby / peer lobby room id when known. */
  roomId?: string;
};

export const CALL_KIND_LABEL = {
  data: 'данные',
  audio: 'голос',
  video: 'видео',
  screen: 'экран',
} as const;
