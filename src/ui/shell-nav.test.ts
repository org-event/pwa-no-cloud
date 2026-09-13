import { describe, expect, it } from 'vitest';
import { allShellNavItems, isShellStub, shellNavTitle } from './shell-nav.ts';

describe('shell-nav', () => {
  it('includes stubs and app sections', () => {
    const items = allShellNavItems();
    expect(items.some((item) => item.id === 'stub-chats')).toBe(true);
    expect(items.some((item) => item.id === 'contacts')).toBe(true);
    expect(isShellStub('stub-empty')).toBe(true);
    expect(isShellStub('calls')).toBe(false);
  });

  it('resolves titles for stubs and sections', () => {
    expect(shellNavTitle('stub-chats')).toBeTruthy();
    expect(shellNavTitle('contacts')).toBeTruthy();
  });
});
