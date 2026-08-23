import type { CallKind } from '@/lib/call-intent.ts';

export type MediaConstraints = {
  audio: boolean;
  video: boolean | MediaTrackConstraints;
};

export const constraintsForKind = (kind: CallKind): MediaConstraints | null => {
  if (kind === 'data') return null;
  if (kind === 'audio') return { audio: true, video: false };
  if (kind === 'video') {
    return {
      audio: true,
      video: { facingMode: 'user' },
    };
  }
  return null;
};

export const stopStream = (stream: MediaStream | null | undefined) => {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
};

export const openUserMedia = async (
  kind: Exclude<CallKind, 'data' | 'screen'>,
): Promise<MediaStream> => {
  const constraints = constraintsForKind(kind);
  if (!constraints) throw new Error('no media for kind');
  return navigator.mediaDevices.getUserMedia(constraints);
};

export const openDisplayMedia = async (): Promise<MediaStream> => {
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });
  try {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of mic.getAudioTracks()) display.addTrack(track);
  } catch {
    // Screen share alone is enough if mic is denied.
  }
  return display;
};

export const openCallMedia = async (kind: CallKind): Promise<MediaStream> => {
  if (kind === 'screen') return openDisplayMedia();
  if (kind === 'audio' || kind === 'video') return openUserMedia(kind);
  throw new Error('data has no media');
};
