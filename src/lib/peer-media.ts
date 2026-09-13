/**
 * Attach / detach media tracks on an existing PeerConnection
 * without touching DataChannels (control/bytes / ping).
 */

export type MediaPeerConnection = Pick<
  RTCPeerConnection,
  'getSenders' | 'addTrack' | 'removeTrack'
>;

/** Add stream tracks that are not already sent. Returns how many were added. */
export const attachLocalMediaTracks = (
  pc: MediaPeerConnection,
  stream: MediaStream,
): number => {
  let added = 0;
  for (const track of stream.getTracks()) {
    const sent = pc
      .getSenders()
      .some((sender) => sender.track?.id === track.id);
    if (sent) continue;
    pc.addTrack(track, stream);
    added += 1;
  }
  return added;
};

/**
 * Remove audio/video senders for `stream` (or all A/V senders when stream is null).
 * DataChannels are unrelated to RTP senders — ping/data stay up.
 */
export const detachLocalMediaTracks = (
  pc: MediaPeerConnection,
  stream: MediaStream | null = null,
): number => {
  let removed = 0;
  for (const sender of [...pc.getSenders()]) {
    const track = sender.track;
    if (!track) continue;
    if (track.kind !== 'audio' && track.kind !== 'video') continue;
    if (stream && !stream.getTracks().some((item) => item.id === track.id)) {
      continue;
    }
    pc.removeTrack(sender);
    removed += 1;
  }
  return removed;
};
