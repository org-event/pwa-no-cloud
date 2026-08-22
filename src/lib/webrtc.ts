import { DATA_CHANNELS } from '../config/defaults.ts';
import type { IceServerConfig } from '../config/types.ts';

const ICE_TIMEOUT_MS = 12000;

export type PeerLinks = {
  pc: RTCPeerConnection;
  control: RTCDataChannel | null;
  bytes: RTCDataChannel | null;
};

export const waitIceComplete = (pc: RTCPeerConnection): Promise<void> => {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const finish = () => {
      pc.removeEventListener('icegatheringstatechange', onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') finish();
    };
    const timer = setTimeout(finish, ICE_TIMEOUT_MS);
    pc.addEventListener('icegatheringstatechange', onChange);
  });
};

export const createPeerConnection = (
  iceServers: IceServerConfig[],
): RTCPeerConnection => {
  return new RTCPeerConnection({ iceServers });
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
