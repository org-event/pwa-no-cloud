import { describe, expect, it } from 'vitest';
import {
  M1_MAX_CALL_LEGS,
  applyCallSessionEvent,
  createIdleCallSession,
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

  it('dials one outbound leg and activates it', () => {
    let session = createIdleCallSession();
    session = applyCallSessionEvent(session, {
      type: 'dial',
      peerId: 'fp-bob',
      legId: 'leg-a',
    });
    expect(session.state).toBe('open');
    expect(session.legs).toHaveLength(1);
    expect(primaryCallLeg(session)).toMatchObject({
      id: 'leg-a',
      peerId: 'fp-bob',
      direction: 'out',
      state: 'outbound',
    });

    session = applyCallSessionEvent(session, {
      type: 'leg-active',
      legId: 'leg-a',
    });
    expect(primaryCallLeg(session)?.state).toBe('active');
    expect(session.state).toBe('open');
  });

  it('accepts an incoming ringing leg', () => {
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
      type: 'leg-active',
      legId: 'leg-in',
    });
    expect(primaryCallLeg(session)?.state).toBe('active');
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
    expect(afterAdd.legs[0]?.id).toBe('leg-1');
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
    expect(session.legs.map((leg) => leg.peerId)).toEqual([
      'fp-bob',
      'fp-carol',
    ]);
  });

  it('records leg failure and hangs up', () => {
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

    session = applyCallSessionEvent(
      applyCallSessionEvent(createIdleCallSession(), {
        type: 'dial',
        peerId: 'fp-bob',
        legId: 'leg-b',
      }),
      { type: 'hangup' },
    );
    expect(session.state).toBe('ended');
    expect(primaryCallLeg(session)?.state).toBe('ended');
  });

  it('ignores illegal transitions', () => {
    const idle = createIdleCallSession();
    expect(
      applyCallSessionEvent(idle, { type: 'leg-active', legId: 'missing' }),
    ).toBe(idle);

    let session = applyCallSessionEvent(idle, {
      type: 'dial',
      peerId: 'fp-bob',
      legId: 'leg-a',
    });
    const same = applyCallSessionEvent(session, {
      type: 'dial',
      peerId: 'fp-other',
    });
    expect(same).toBe(session);
  });

  it('resets to idle keeping topology and maxLegs', () => {
    let session: CallSession = applyCallSessionEvent(
      createIdleCallSession({ topology: 'sfu', maxLegs: 4 }),
      { type: 'dial', peerId: 'fp-bob', legId: 'leg-a' },
    );
    session = applyCallSessionEvent(session, { type: 'reset' });
    expect(session.state).toBe('idle');
    expect(session.legs).toEqual([]);
    expect(session.topology).toBe('sfu');
    expect(session.maxLegs).toBe(4);
  });
});
