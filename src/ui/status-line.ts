import { statusCopy } from '@/content/index.ts';

export type ServerReachStatus = 'none' | 'unknown' | 'checking' | 'up' | 'down';

export type StatusLineInput = {
  online: boolean;
  session: string;
  ice: string;
  pongMs: number | null;
  peerNick: string;
  hasSocket: boolean;
  peerLive: boolean;
  serverReach: ServerReachStatus;
};

export type StatusLineView = {
  networkOnline: boolean;
  socketLive: boolean;
  socketBusy: boolean;
  socketVisible: boolean;
  webrtcLive: boolean;
  linkLabel: string;
  latencyLabel: string;
  path: 'relay' | 'local' | '';
  title: string;
};

const icePathKind = (ice: string): 'relay' | 'local' | '' => {
  if (ice.includes(statusCopy.icePathRelayMarker)) return 'relay';
  if (statusCopy.icePathHostPattern.test(ice)) return 'local';
  return '';
};

const icePathLabel = (ice: string): string | null => {
  const kind = icePathKind(ice);
  if (kind === 'relay') return statusCopy.pathRelay;
  if (kind === 'local') return statusCopy.pathLocal;
  const path = statusCopy.icePathExtract.exec(ice);
  return path?.[1]?.trim() || null;
};

export const formatLinkLabel = (input: {
  session: string;
  peerNick: string;
  peerLive: boolean;
}): string => {
  if (input.session === 'connected') {
    return input.peerNick
      ? statusCopy.withPeer(input.peerNick)
      : statusCopy.webrtcOn;
  }
  if (input.session === 'signaling' || input.session === 'connecting') {
    return statusCopy.waitingPeer;
  }
  if (input.session === 'failed') return statusCopy.session.failed;
  if (input.peerLive) return statusCopy.waitingPeer;
  return '';
};

const socketReady = (input: StatusLineInput): boolean => {
  if (!input.online || !input.hasSocket) return false;
  if (
    input.peerLive ||
    input.session === 'signaling' ||
    input.session === 'connecting' ||
    input.session === 'connected'
  ) {
    return true;
  }
  return input.serverReach === 'up';
};

export const formatStatusLine = (input: StatusLineInput): string => {
  const parts: string[] = [];
  if (!input.online) {
    parts.push(statusCopy.offline);
  } else if (input.hasSocket) {
    parts.push(statusCopy.socketOn);
  }
  parts.push(
    input.session === 'connected' ? statusCopy.webrtcOn : statusCopy.webrtcOff,
  );
  if (input.hasSocket && input.serverReach === 'up') {
    parts.push(statusCopy.serverUp);
  } else if (input.hasSocket && input.serverReach === 'down') {
    parts.push(statusCopy.serverDown);
  } else if (input.hasSocket && input.serverReach === 'checking') {
    parts.push(statusCopy.serverChecking);
  }
  const link = formatLinkLabel(input);
  if (link) parts.push(link);
  const path = icePathLabel(input.ice);
  if (path) parts.push(path);
  if (input.pongMs !== null) parts.push(statusCopy.latencyMs(input.pongMs));
  return parts.join(' · ');
};

export const buildStatusLineView = (input: StatusLineInput): StatusLineView => {
  const path = icePathKind(input.ice);
  const webrtcLive = input.session === 'connected';
  const socketLive = socketReady(input);
  const socketBusy =
    input.hasSocket && input.online && input.serverReach === 'checking';
  const linkLabel = formatLinkLabel(input);
  const latencyLabel =
    input.pongMs !== null ? statusCopy.latencyMs(input.pongMs) : '';
  return {
    networkOnline: input.online,
    socketLive,
    socketBusy,
    socketVisible: input.hasSocket,
    webrtcLive,
    linkLabel,
    latencyLabel,
    path,
    title: formatStatusLine(input),
  };
};
