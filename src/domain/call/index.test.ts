import { describe, expect, it } from 'vitest';
import {
  M1_MAX_CALL_LEGS,
  applyCallSessionEvent,
  createIdleCallSession,
  isCallBusy,
  primaryCallLeg,
  type CallSession,
} from './index.ts';

describe('call session multi-leg model (S4.1)', () => {
  it('starts idle with M1 maxLegs = 1', () => {
    const session = createIdleCallSession();
    expect(session.state).toBe('idle');
    expect(session.legs).toEqual([]);
    expect(session.maxLegs).toBe(M1_MAX_CALL_LEGS);
    expect(session.topology).toBe('mesh');
    expect(primaryCallLeg(session)).toBeNull();
  });

  it('refuses a second leg when maxLegs is 1', () => {
    let session = applyCallSessionEvent(createIdleCallSession(), {
      type: 'dial',
      peerId: 'fp-bob',
      legId: 'leg-1',
    });
    const afterAdd = applyCallSessionEvent(session, {
      type: 'add-leg',
      peerId: 'fp-carol',
      legId: 'leg-2',
    });
    expect(afterAdd).toBe(session);
    expect(afterAdd.legs).toHaveLength(1);
  });

  it('allows a second leg when maxLegs is raised (future mesh)', () => {
    let session = createIdleCallSession({ maxLegs: 2 });
    session = applyCallSessionEvent(session, {
      type: 'dial',
      peerId: 'fp-bob',
      legId: 'leg-1',
    });
    session = applyCallSessionEvent(session, {
      type: 'add-leg',
      peerId: 'fp-carol',
      legId: 'leg-2',
    });
    expect(session.legs).toHaveLength(2);
  });
});

describe('call FSM offer/ringing/accept/reject/busy/hangup (S4.3)', () => {
  it('outbound: dial → remote-ringing → accept → hangup', () => {
    let session = applyCallSessionEvent(createIdleCallSession(), {
      type: 'dial',
      peerId: 'fp-bob',
      legId: 'leg-a',
    });
    expect(primaryCallLeg(session)?.state).toBe('outbound');
    expect(isCallBusy(session)).toBe(true);

    session = applyCallSessionEvent(session, {
      type: 'remote-ringing',
      legId: 'leg-a',
    });
    expect(primaryCallLeg(session)?.state).toBe('ringing');

    session = applyCallSessionEvent(session, {
      type: 'accept',
      legId: 'leg-a',
    });
    expect(primaryCallLeg(session)?.state).toBe('active');
    expect(session.state).toBe('open');

    session = applyCallSessionEvent(session, { type: 'hangup' });
    expect(primaryCallLeg(session)?.state).toBe('ended');
    expect(session.state).toBe('ended');
    expect(isCallBusy(session)).toBe(false);
  });

  it('inbound: incoming → accept', () => {
    let session = applyCallSessionEvent(createIdleCallSession(), {
      type: 'incoming',
      peerId: 'fp-alice',
      legId: 'leg-in',
    });
    expect(primaryCallLeg(session)).toMatchObject({
      direction: 'in',
      state: 'ringing',
    });
    session = applyCallSessionEvent(session, {
      type: 'accept',
      legId: 'leg-in',
    });
    expect(primaryCallLeg(session)?.state).toBe('active');
  });

  it('inbound reject ends as failed/rejected', () => {
    let session = applyCallSessionEvent(createIdleCallSession(), {
      type: 'incoming',
      peerId: 'fp-alice',
      legId: 'leg-in',
    });
    session = applyCallSessionEvent(session, {
      type: 'reject',
      legId: 'leg-in',
      reason: 'declined',
    });
    expect(primaryCallLeg(session)?.state).toBe('rejected');
    expect(session.state).toBe('failed');
    expect(session.error).toBe('declined');
  });

  it('busy while ringing', () => {
    let session = applyCallSessionEvent(createIdleCallSession(), {
      type: 'dial',
      peerId: 'fp-bob',
      legId: 'leg-a',
    });
    session = applyCallSessionEvent(session, { type: 'busy', legId: 'leg-a' });
    expect(primaryCallLeg(session)?.state).toBe('busy');
    expect(session.state).toBe('failed');
    expect(session.error).toBe('busy');
  });

  it('ignores illegal transitions', () => {
    const idle = createIdleCallSession();
    expect(
      applyCallSessionEvent(idle, { type: 'accept', legId: 'missing' }),
    ).toBe(idle);

    let session = applyCallSessionEvent(idle, {
      type: 'dial',
      peerId: 'fp-bob',
      legId: 'leg-a',
    });
    expect(
      applyCallSessionEvent(session, { type: 'dial', peerId: 'fp-other' }),
    ).toBe(session);
    expect(
      applyCallSessionEvent(session, {
        type: 'remote-ringing',
        legId: 'nope',
      }),
    ).toBe(session);
  });

  it('records leg failure and resets', () => {
    let session = applyCallSessionEvent(createIdleCallSession(), {
      type: 'dial',
      peerId: 'fp-bob',
      legId: 'leg-a',
    });
    session = applyCallSessionEvent(session, {
      type: 'leg-fail',
      legId: 'leg-a',
      message: 'ICE не собрался',
    });
    expect(session.state).toBe('failed');
    expect(session.error).toBe('ICE не собрался');

    session = applyCallSessionEvent(session, { type: 'reset' });
    expect(session.state).toBe('idle');
    expect(session.legs).toEqual([]);
  });

  it('can dial again after failed/ended', () => {
    let session: CallSession = applyCallSessionEvent(createIdleCallSession(), {
      type: 'dial',
      peerId: 'fp-bob',
      legId: 'leg-a',
    });
    session = applyCallSessionEvent(session, { type: 'busy', legId: 'leg-a' });
    session = applyCallSessionEvent(session, {
      type: 'dial',
      peerId: 'fp-carol',
      legId: 'leg-b',
    });
    expect(primaryCallLeg(session)).toMatchObject({
      id: 'leg-b',
      peerId: 'fp-carol',
      state: 'outbound',
    });
    expect(session.state).toBe('open');
  });
});
