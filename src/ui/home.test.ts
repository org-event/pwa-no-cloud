import { describe, expect, it } from 'vitest';
import {
  formatHomeLead,
  formatHomeWait,
  formatRecipientHint,
  formatShareButton,
} from './home.ts';

describe('home copy', () => {
  it('treats Wi-Fi and internet as one path when TURN exists', () => {
    expect(formatHomeLead({ manual: false, hasTurn: true })).toContain(
      'одно и то же',
    );
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

  it('names the share button after a chosen contact', () => {
    expect(
      formatShareButton({
        contacts: [{ nick: 'Вася' }],
        groups: [],
      }),
    ).toBe('Ссылка для Вася');
  });

  it('explains that a group is still one channel', () => {
    expect(formatRecipientHint(3)).toContain('Канал один');
  });
});
