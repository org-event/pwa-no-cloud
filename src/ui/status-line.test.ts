import { describe, expect, it } from 'vitest';
import { formatStatusLine } from './status-line.ts';

describe('status line', () => {
  it('joins network, session, ice path and pong', () => {
    expect(
      formatStatusLine({
        online: true,
        session: 'connected',
        ice: 'сейчас путь = host → host · connected',
        pongMs: 12,
      }),
    ).toBe('сеть · связь · локально · 12 мс');
  });

  it('skips missing ice and pong', () => {
    expect(
      formatStatusLine({
        online: false,
        session: 'idle',
        ice: '',
        pongMs: null,
      }),
    ).toBe('нет сети · нет пары');
  });
});
