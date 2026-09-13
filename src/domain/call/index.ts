/**
 * Call domain — voice/video session over WebRTC legs.
 * Multi-leg types land in S4.1; media wiring in S4.2+.
 */

export type CallState =
  | 'idle'
  | 'outbound'
  | 'ringing'
  | 'active'
  | 'ended'
  | 'failed';

export type CallLegId = string;

export type CallLeg = {
  id: CallLegId;
  peerId: string;
  state: CallState;
};

export type Call = {
  id: string;
  legs: CallLeg[];
};
