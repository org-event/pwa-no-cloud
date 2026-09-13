/**
 * Call domain — voice/video session over WebRTC legs.
 * S4.1: multi-leg types + automaton (N=1 runtime). Media wiring in S4.2+.
 */

export type CallTopology = 'mesh' | 'sfu';

/** Per-leg lifecycle before the richer Call FSM in S4.3. */
export type CallLegState =
  | 'outbound'
  | 'ringing'
  | 'active'
  | 'ended'
  | 'failed';

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

export type CallSessionEvent =
  | { type: 'dial'; peerId: string; legId?: CallLegId }
  | { type: 'incoming'; peerId: string; legId?: CallLegId }
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
  if (legs.every((leg) => leg.state === 'failed' || leg.state === 'ended')) {
    const failed = legs.find((leg) => leg.state === 'failed');
    return { state: 'failed', error: failed?.error || fallbackError };
  }
  return { state: 'open', error: '' };
};

const canOpenLeg = (session: CallSession): boolean =>
  session.state === 'idle' ||
  (session.state === 'open' && session.legs.length < session.maxLegs);

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
    if (session.state !== 'idle' && session.state !== 'ended') return session;
    const base =
      session.state === 'ended'
        ? {
            ...createIdleCallSession({
              topology: session.topology,
              maxLegs: session.maxLegs,
            }),
            id: session.id,
          }
        : session;
    return openLeg(base, event.peerId, 'out', event.legId);
  }

  if (event.type === 'incoming') {
    if (session.state !== 'idle' && session.state !== 'ended') return session;
    const base =
      session.state === 'ended'
        ? {
            ...createIdleCallSession({
              topology: session.topology,
              maxLegs: session.maxLegs,
            }),
            id: session.id,
          }
        : session;
    return openLeg(base, event.peerId, 'in', event.legId);
  }

  if (event.type === 'add-leg') {
    // M1: maxLegs === 1 → no-op when already has a leg.
    return openLeg(session, event.peerId, 'out', event.legId);
  }

  if (event.type === 'leg-active') {
    const leg = findLeg(session, event.legId);
    if (!leg) return session;
    if (leg.state !== 'outbound' && leg.state !== 'ringing') return session;
    const next = { ...leg, state: 'active' as const, error: '' };
    const legs = replaceLeg(session, next).legs;
    return { ...session, legs, ...deriveState(legs) };
  }

  if (event.type === 'leg-fail') {
    const leg = findLeg(session, event.legId);
    if (!leg) return session;
    if (leg.state === 'ended' || leg.state === 'failed') return session;
    const next = {
      ...leg,
      state: 'failed' as const,
      error: event.message,
    };
    const legs = replaceLeg(session, next).legs;
    return { ...session, legs, ...deriveState(legs, event.message) };
  }

  if (event.type === 'hangup') {
    if (session.legs.length === 0) return session;
    const targetId = event.legId;
    const legs = session.legs.map((leg) => {
      if (targetId && leg.id !== targetId) return leg;
      if (leg.state === 'ended' || leg.state === 'failed') return leg;
      return { ...leg, state: 'ended' as const, error: '' };
    });
    return { ...session, legs, ...deriveState(legs) };
  }

  return session;
};

/** Convenience: first (and only, in M1) leg. */
export const primaryCallLeg = (session: CallSession): CallLeg | null =>
  session.legs[0] ?? null;
