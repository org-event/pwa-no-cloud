import { describe, expect, it } from 'vitest';
import { explainIceFailure } from './ice-fail.ts';

describe('explainIceFailure', () => {
  it('asks for TURN when NAT blocks a STUN path', () => {
    const message = explainIceFailure({
      local: ['host', 'srflx'],
      remote: ['srflx'],
      hasTurn: false,
      hasStun: true,
    });
    expect(message).toContain('Прямой путь закрыт NAT');
    expect(message).toContain('свой TURN');
  });

  it('blames missing STUN and TURN when only host is visible', () => {
    const message = explainIceFailure({
      local: ['host'],
      remote: [],
      hasTurn: false,
      hasStun: false,
    });
    expect(message).toContain('Нет STUN и TURN');
  });

  it('says TURN did not produce a relay candidate', () => {
    const message = explainIceFailure({
      local: ['host', 'srflx'],
      remote: ['srflx'],
      hasTurn: true,
      hasStun: true,
    });
    expect(message).toContain('relay-кандидат не появился');
  });

  it('says TURN was tried and still failed', () => {
    const message = explainIceFailure({
      local: ['host', 'relay'],
      remote: ['relay'],
      hasTurn: true,
      hasStun: true,
    });
    expect(message).toContain('даже через TURN');
  });
});
