import { describe, expect, it } from 'vitest';
import {
  formatHomeLead,
  formatHomeWait,
  formatRecipientHint,
  formatShareButton,
} from './home.ts';

describe('home copy', () => {
  it('tells the sender to pick a file then get a link', () => {
    expect(formatHomeLead({ manual: false, hasTurn: true })).toContain(
      'Получить ссылку',
    );
  });

  it('explains HTTPS blocking a plain ws socket', () => {
    expect(
      formatHomeLead({ manual: false, hasTurn: true, socketBlocked: true }),
    ).toContain('установщик');
  });

  it('tells the sender to wait after sharing a link', () => {
    expect(
      formatHomeWait({
        connected: false,
        waiting: true,
        queuedCount: 1,
        role: 'caller',
        fromLink: false,
      }),
    ).toContain('откроет ссылку');
  });

  it('points to the files block before the get-link button', () => {
    expect(
      formatHomeWait({
        connected: false,
        waiting: false,
        queuedCount: 0,
        role: 'idle',
        fromLink: false,
      }),
    ).toContain('Файлы');
  });

  it('points to the get-link button after a file is queued', () => {
    expect(
      formatHomeWait({
        connected: false,
        waiting: false,
        queuedCount: 1,
        role: 'idle',
        fromLink: false,
      }),
    ).toContain('Получить ссылку');
  });

  it('names the share button after a chosen contact', () => {
    expect(
      formatShareButton({
        contacts: [{ nick: 'Вася' }],
        groups: [],
      }),
    ).toBe('Получить ссылку для Вася');
  });

  it('explains that a group is still one channel', () => {
    expect(formatRecipientHint(3)).toContain('Канал один');
  });
});
