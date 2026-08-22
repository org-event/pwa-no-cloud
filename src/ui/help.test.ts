import { describe, expect, it } from 'vitest';
import { HELP_TOPICS } from './help.ts';

describe('help topics', () => {
  it('covers every app section and deep links', () => {
    const ids = HELP_TOPICS.map((topic) => topic.id);
    expect(ids).toContain('what');
    expect(ids).toContain('links');
    expect(ids).toContain('servers');
    expect(ids).toContain('lan');
    expect(ids).toContain('contacts');
    expect(ids).toContain('video');
    expect(ids).toContain('logs');
    const links = HELP_TOPICS.find((topic) => topic.id === 'links');
    expect(links?.lead).toContain('web+nocloud');
    const contacts = HELP_TOPICS.find((topic) => topic.id === 'contacts');
    expect(contacts?.lead).toContain('C1.');
  });
});
