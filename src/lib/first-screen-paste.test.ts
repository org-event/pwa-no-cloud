import { describe, expect, it } from 'vitest';
import { classifyFirstScreenPaste } from './first-screen-paste.ts';

describe('classifyFirstScreenPaste', () => {
  it('classifies known prefixes and BIP39 word counts', () => {
    expect(classifyFirstScreenPaste('nb1.abc').kind).toBe('backup');
    expect(classifyFirstScreenPaste('S1.{"v":1}').kind).toBe('share-pack');
    expect(classifyFirstScreenPaste('R1.{"v":1}').kind).toBe('redirect');
    expect(classifyFirstScreenPaste('I1.{"v":1}').kind).toBe('introduce');
    expect(classifyFirstScreenPaste('P1.{"v":2}').kind).toBe('contact-card');
    const twelve = Array.from({ length: 12 }, () => 'abandon').join(' ');
    expect(classifyFirstScreenPaste(twelve).kind).toBe('mnemonic');
    expect(classifyFirstScreenPaste('hello').kind).toBe('unknown');
    expect(classifyFirstScreenPaste('').kind).toBe('unknown');
  });
});
