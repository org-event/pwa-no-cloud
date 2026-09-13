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
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };
  }
  return null;
};

export const stopStream = (stream: MediaStream | null | undefined) => {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
};

/** True when a track looks like a display-capture surface (screen share). */
export const isDisplayTrack = (track: MediaStreamTrack): boolean => {
  if (track.kind !== 'video') return false;
  try {
    const settings = track.getSettings?.() as { displaySurface?: string };
    return Boolean(settings?.displaySurface);
  } catch {
    return false;
  }
};

/**
 * When the user stops sharing via the browser UI, video tracks fire `ended`.
 * Returns an unsubscribe that removes the listeners.
 */
export const onScreenShareEnded = (
  stream: MediaStream,
  onEnded: () => void,
): (() => void) => {
  const cleanups: Array<() => void> = [];
  for (const track of stream.getVideoTracks()) {
    const handler = () => {
      onEnded();
    };
    track.addEventListener('ended', handler);
    cleanups.push(() => track.removeEventListener('ended', handler));
  }
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
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

/** Soft mute/unmute without removing senders (keeps renegotiation-free). */
export const setTracksEnabled = (
  stream: MediaStream | null | undefined,
  kind: 'audio' | 'video',
  enabled: boolean,
): boolean => {
  if (!stream) return false;
  let changed = false;
  for (const track of stream.getTracks()) {
    if (track.kind !== kind) continue;
    track.enabled = enabled;
    changed = true;
  }
  return changed;
};

export const tracksEnabled = (
  stream: MediaStream | null | undefined,
  kind: 'audio' | 'video',
): boolean => {
  if (!stream) return false;
  const tracks = stream.getTracks().filter((track) => track.kind === kind);
  return tracks.length > 0 && tracks.every((track) => track.enabled);
};
