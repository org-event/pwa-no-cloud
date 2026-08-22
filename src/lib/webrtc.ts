import { DATA_CHANNELS } from '../config/defaults.ts';
import { orderIceServersForBrowser } from '../config/ice-urls.ts';
import type { IceServerConfig } from '../config/types.ts';
import { pathsFromSdp } from './ice.ts';

const ICE_TIMEOUT_MS = 8000;
const ICE_TURN_TIMEOUT_MS = 25000;

export type PeerLinks = {
  pc: RTCPeerConnection;
  control: RTCDataChannel | null;
  bytes: RTCDataChannel | null;
};

export const sdpHasRelay = (sdp?: string | null): boolean => {
  if (!sdp) return false;
  return pathsFromSdp(sdp).includes('relay');
};

export const waitIceGathering = (
  pc: RTCPeerConnection,
  options: { wantRelay?: boolean; timeoutMs?: number } = {},
): Promise<void> => {
  const timeoutMs =
    options.timeoutMs ??
    (options.wantRelay ? ICE_TURN_TIMEOUT_MS : ICE_TIMEOUT_MS);
  return new Promise((resolve) => {
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      if (finished) return;
      finished = true;
      pc.removeEventListener('icegatheringstatechange', onGather);
      pc.removeEventListener('icecandidate', onCandidate);
      if (timer) clearTimeout(timer);
      resolve();
    };
    const hasRelay = () => sdpHasRelay(pc.localDescription?.sdp);
    const onGather = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const onCandidate = () => {
      if (options.wantRelay && hasRelay()) done();
    };
    if (pc.iceGatheringState === 'complete') {
      done();
      return;
    }
    if (options.wantRelay && hasRelay()) {
      done();
      return;
    }
    timer = setTimeout(done, timeoutMs);
    pc.addEventListener('icegatheringstatechange', onGather);
    pc.addEventListener('icecandidate', onCandidate);
  });
};

export const waitIceComplete = (pc: RTCPeerConnection): Promise<void> => {
  return waitIceGathering(pc);
};

export const createPeerConnection = (
  iceServers: IceServerConfig[],
): RTCPeerConnection => {
  return new RTCPeerConnection({
    iceServers: orderIceServersForBrowser(iceServers),
  });
};

export const createLocalChannels = (pc: RTCPeerConnection): PeerLinks => {
  return {
    pc,
    control: pc.createDataChannel(DATA_CHANNELS.control),
    bytes: pc.createDataChannel(DATA_CHANNELS.bytes),
  };
};

export const attachRemoteChannels = (
  links: PeerLinks,
  channel: RTCDataChannel,
) => {
  if (channel.label === DATA_CHANNELS.control) links.control = channel;
  if (channel.label === DATA_CHANNELS.bytes) links.bytes = channel;
};

export const localSdp = (pc: RTCPeerConnection): string => {
  const description = pc.localDescription;
  if (!description?.sdp) throw new Error('local SDP is missing');
  return description.sdp;
};
