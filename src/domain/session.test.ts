import { describe, expect, it } from 'vitest';
import { encodeInvite } from '@/lib/signaling/invite.ts';
import { createManualPort } from '@/lib/signaling/manual.ts';
import type { SignalMessage } from '@/lib/signaling/port.ts';
import {
  applySessionEvent,
  createIdleSession,
  type Session,
} from './session.ts';

const answer = (): SignalMessage => ({
  from: 'bob',
  to: 'alice',
  data: { type: 'answer', payload: { sdp: 'v=0' } },
});

describe('session machine', () => {
  it('follows the happy path', () => {
    let session = createIdleSession();
    session = applySessionEvent(session, { type: 'start' });
    expect(session.state).toBe('signaling');
    session = applySessionEvent(session, { type: 'remote-ready' });
    expect(session.state).toBe('connecting');
    session = applySessionEvent(session, { type: 'channel-open' });
    expect(session.state).toBe('connected');
    session = applySessionEvent(session, { type: 'close' });
    expect(session.state).toBe('closed');
  });

  it('can skip connecting when the channel opens early', () => {
    let session = applySessionEvent(createIdleSession(), { type: 'start' });
    session = applySessionEvent(session, { type: 'channel-open' });
    expect(session.state).toBe('connected');
  });

  it('records a fail message', () => {
    let session = applySessionEvent(createIdleSession(), { type: 'start' });
    session = applySessionEvent(session, {
      type: 'fail',
      message: 'ICE не собрался',
    });
    expect(session.state).toBe('failed');
    expect(session.error).toBe('ICE не собрался');
  });

  it('ignores illegal transitions', () => {
    const idle = createIdleSession();
    const same = applySessionEvent(idle, { type: 'remote-ready' });
    expect(same).toBe(idle);
    const failed = applySessionEvent(idle, {
      type: 'fail',
      message: 'нет пути',
    });
    expect(applySessionEvent(failed, { type: 'channel-open' })).toBe(failed);
  });

  it('resets to idle from any state', () => {
    let session: Session = {
      state: 'failed',
      error: 'ICE не собрался',
    };
    session = applySessionEvent(session, { type: 'reset' });
    expect(session).toEqual(createIdleSession());
  });
});

describe('session machine with a fake port', () => {
  it('goes connecting when the fake port delivers an answer', async () => {
    const port = createManualPort();
    await port.connect({ roomId: 'manual', clientId: 'alice' });
    let session = applySessionEvent(createIdleSession(), { type: 'start' });
    port.subscribe((message) => {
      if (message.data.type === 'answer') {
        session = applySessionEvent(session, { type: 'remote-ready' });
      }
    });
    const accepted = await port.accept(await encodeInvite(answer()));
    expect(accepted.ok).toBe(true);
    expect(session.state).toBe('connecting');
  });
});
