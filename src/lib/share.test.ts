import { describe, expect, it } from 'vitest';
import { filesFromShare } from './share.ts';

describe('share payloads', () => {
  it('rebuilds File objects from SW payloads', () => {
    const buffer = new TextEncoder().encode('hi').buffer;
    const files = filesFromShare([
      { name: 'a.txt', type: 'text/plain', buffer },
      { name: 'skip' },
    ]);
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe('a.txt');
  });
});
