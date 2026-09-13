/**
 * Call domain — voice/video session over WebRTC legs.
 * S4.1 multi-leg model; S4.2 media on PC; S4.3 offer/ringing/accept/reject/busy/hangup FSM.
 */

export type CallTopology = 'mesh' | 'sfu';

export type CallLegState =
  | 'outbound'
  | 'ringing'
  | 'active'
  | 'ended'
  | 'failed'
  | 'rejected'
  | 'busy';

/** Aggregate session state derived from legs. */
export type CallSessionState = 'idle' | 'open' | 'ended' | 'failed';

/** @deprecated Prefer CallLegState; kept for barrel compatibility. */
export type CallState = CallLegState | 'idle';

export type CallLegId = string;

export type CallDirection = 'out' | 'in';

export type CallLeg = {
  id: CallLegId;
  peerId: string;
  direction: CallDirection;
  state: CallLegState;
  error: string;
};

/**
 * Multi-leg call session. M1 keeps `maxLegs === 1`; types already allow
 * mesh growth and later SFU without rewriting the model.
 */
export type CallSession = {
  id: string;
  topology: CallTopology;
  maxLegs: number;
  legs: CallLeg[];
  state: CallSessionState;
  error: string;
};

/** Alias used by early barrels / modules.test. */
export type Call = CallSession;

/** Runtime cap for M1 — more legs are a type-level / future concern. */
export const M1_MAX_CALL_LEGS = 1;

const TERMINAL_LEG: ReadonlySet<CallLegState> = new Set([
  'ended',
  'failed',
  'rejected',
  'busy',
]);

export type CallSessionEvent =
  | { type: 'dial'; peerId: string; legId?: CallLegId }
  | { type: 'incoming'; peerId: string; legId?: CallLegId }
  /** Caller learns remote is ringing (SIP-like 180). */
  | { type: 'remote-ringing'; legId: CallLegId }
  | { type: 'accept'; legId: CallLegId }
  | { type: 'reject'; legId: CallLegId; reason?: string }
  | { type: 'busy'; legId: CallLegId }
  | { type: 'leg-active'; legId: CallLegId }
  | { type: 'leg-fail'; legId: CallLegId; message: string }
  | { type: 'hangup'; legId?: CallLegId }
  | { type: 'add-leg'; peerId: string; legId?: CallLegId }
  | { type: 'reset' };

let nextCallSeq = 0;
let nextLegSeq = 0;

const newCallId = (): string => {
  nextCallSeq += 1;
  return `call-${nextCallSeq}`;
};

const newLegId = (): CallLegId => {
  nextLegSeq += 1;
  return `leg-${nextLegSeq}`;
};

export const createIdleCallSession = (
  options: { topology?: CallTopology; maxLegs?: number } = {},
): CallSession => ({
  id: newCallId(),
  topology: options.topology ?? 'mesh',
  maxLegs: options.maxLegs ?? M1_MAX_CALL_LEGS,
  legs: [],
  state: 'idle',
  error: '',
});

const findLeg = (session: CallSession, legId: CallLegId): CallLeg | undefined =>
  session.legs.find((leg) => leg.id === legId);

const replaceLeg = (session: CallSession, next: CallLeg): CallSession => ({
  ...session,
  legs: session.legs.map((leg) => (leg.id === next.id ? next : leg)),
});

const isTerminalLeg = (state: CallLegState): boolean => TERMINAL_LEG.has(state);

const deriveState = (
  legs: CallLeg[],
  fallbackError = '',
): Pick<CallSession, 'state' | 'error'> => {
  if (legs.length === 0) return { state: 'idle', error: '' };
  if (legs.some((leg) => leg.state === 'active')) {
    return { state: 'open', error: '' };
  }
  if (legs.every((leg) => leg.state === 'ended')) {
    return { state: 'ended', error: '' };
  }
  if (legs.every((leg) => isTerminalLeg(leg.state))) {
    const failed = legs.find(
      (leg) =>
        leg.state === 'failed' ||
        leg.state === 'rejected' ||
        leg.state === 'busy',
    );
    const error =
      failed?.error ||
      (failed?.state === 'busy'
        ? 'busy'
        : failed?.state === 'rejected'
          ? 'rejected'
          : fallbackError);
    return { state: 'failed', error };
  }
  return { state: 'open', error: '' };
};

const canOpenLeg = (session: CallSession): boolean =>
  session.state === 'idle' ||
  (session.state === 'open' && session.legs.length < session.maxLegs);

const reopenBase = (session: CallSession): CallSession => {
  if (session.state !== 'ended' && session.state !== 'failed') return session;
  return {
    ...createIdleCallSession({
      topology: session.topology,
      maxLegs: session.maxLegs,
    }),
    id: session.id,
  };
};

const openLeg = (
  session: CallSession,
  peerId: string,
  direction: CallDirection,
  legId?: CallLegId,
): CallSession => {
  if (!canOpenLeg(session)) return session;
  if (session.legs.length >= session.maxLegs) return session;
  const leg: CallLeg = {
    id: legId ?? newLegId(),
    peerId,
    direction,
    state: direction === 'out' ? 'outbound' : 'ringing',
    error: '',
  };
  const legs = [...session.legs, leg];
  return {
    ...session,
    legs,
    ...deriveState(legs),
  };
};

const setLegState = (
  session: CallSession,
  legId: CallLegId,
  state: CallLegState,
  error = '',
  allowed: ReadonlySet<CallLegState>,
): CallSession => {
  const leg = findLeg(session, legId);
  if (!leg) return session;
  if (!allowed.has(leg.state)) return session;
  const next = { ...leg, state, error };
  const legs = replaceLeg(session, next).legs;
  return { ...session, legs, ...deriveState(legs, error) };
};

export const applyCallSessionEvent = (
  session: CallSession,
  event: CallSessionEvent,
): CallSession => {
  if (event.type === 'reset') {
    return {
      ...createIdleCallSession({
        topology: session.topology,
        maxLegs: session.maxLegs,
      }),
      id: session.id,
    };
  }

  if (event.type === 'dial') {
    if (
      session.state !== 'idle' &&
      session.state !== 'ended' &&
      session.state !== 'failed'
    ) {
      return session;
    }
    return openLeg(reopenBase(session), event.peerId, 'out', event.legId);
  }

  if (event.type === 'incoming') {
    if (
      session.state !== 'idle' &&
      session.state !== 'ended' &&
      session.state !== 'failed'
    ) {
      return session;
    }
    return openLeg(reopenBase(session), event.peerId, 'in', event.legId);
  }

  if (event.type === 'add-leg') {
    return openLeg(session, event.peerId, 'out', event.legId);
  }

  if (event.type === 'remote-ringing') {
    return setLegState(
      session,
      event.legId,
      'ringing',
      '',
      new Set(['outbound']),
    );
  }

  if (event.type === 'accept') {
    // Callee accepts while ringing; media "active" may follow via leg-active.
    return setLegState(
      session,
      event.legId,
      'active',
      '',
      new Set(['ringing', 'outbound']),
    );
  }

  if (event.type === 'reject') {
    return setLegState(
      session,
      event.legId,
      'rejected',
      event.reason || 'rejected',
      new Set(['ringing', 'outbound']),
    );
  }

  if (event.type === 'busy') {
    return setLegState(
      session,
      event.legId,
      'busy',
      'busy',
      new Set(['ringing', 'outbound']),
    );
  }

  if (event.type === 'leg-active') {
    return setLegState(
      session,
      event.legId,
      'active',
      '',
      new Set(['outbound', 'ringing', 'active']),
    );
  }

  if (event.type === 'leg-fail') {
    const leg = findLeg(session, event.legId);
    if (!leg || isTerminalLeg(leg.state)) return session;
    return setLegState(
      session,
      event.legId,
      'failed',
      event.message,
      new Set(['outbound', 'ringing', 'active']),
    );
  }

  if (event.type === 'hangup') {
    if (session.legs.length === 0) return session;
    const targetId = event.legId;
    const legs = session.legs.map((leg) => {
      if (targetId && leg.id !== targetId) return leg;
      if (isTerminalLeg(leg.state)) return leg;
      return { ...leg, state: 'ended' as const, error: '' };
    });
    return { ...session, legs, ...deriveState(legs) };
  }

  return session;
};

/** Convenience: first (and only, in M1) leg. */
export const primaryCallLeg = (session: CallSession): CallLeg | null =>
  session.legs[0] ?? null;

export const isCallBusy = (session: CallSession): boolean =>
  session.state === 'open' &&
  session.legs.some((leg) => !isTerminalLeg(leg.state));
