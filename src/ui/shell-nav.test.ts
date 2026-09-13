import { describe, expect, it } from 'vitest';
import {
  isShellContact,
  parseShellContactId,
  shellContactId,
  shellNavTitle,
  shellSelfId,
} from './shell-nav.ts';

describe('shell-nav', () => {
  it('builds and parses contact nav ids', () => {
    const id = shellContactId('fp-alice');
    expect(id).toBe('contact:fp-alice');
    expect(parseShellContactId(id)).toBe('fp-alice');
    expect(isShellContact(id)).toBe(true);
  });

  it('resolves titles for sections, self chat, and contacts', () => {
    expect(shellNavTitle('contacts')).toBeTruthy();
    expect(shellNavTitle('personal')).toBeTruthy();
    expect(shellNavTitle(shellSelfId())).toBeTruthy();
    expect(shellNavTitle(shellContactId('fp'), 'Аня')).toBe('Аня');
  });
});
