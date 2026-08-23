import { describe, expect, it } from 'vitest';
import { HELP_TOPICS } from '@/content/index.ts';

describe('help topics', () => {
  it('keeps only the short product intro', () => {
    expect(HELP_TOPICS).toHaveLength(1);
    expect(HELP_TOPICS[0]?.id).toBe('what');
    expect(HELP_TOPICS[0]?.items.map((item) => item.name)).toEqual([
      'Без аккаунта',
      'PWA',
    ]);
  });
});
