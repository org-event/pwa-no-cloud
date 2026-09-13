import { describe, expect, it } from 'vitest';
import {
  isShellContact,
  isShellStub,
  parseShellContactId,
  shellContactId,
  shellNavTitle,
} from './shell-nav.ts';

describe('shell-nav', () => {
  it('builds and parses contact nav ids', () => {
    const id = shellContactId('fp-alice');
    expect(id).toBe('contact:fp-alice');
    expect(parseShellContactId(id)).toBe('fp-alice');
    expect(isShellContact(id)).toBe(true);
    expect(isShellStub(id)).toBe(false);
  });

  it('resolves titles for stubs, sections, and contacts', () => {
    expect(shellNavTitle('stub-chats')).toBeTruthy();
    expect(shellNavTitle('contacts')).toBeTruthy();
    expect(shellNavTitle(shellContactId('fp'), 'Аня')).toBe('Аня');
  });
});
