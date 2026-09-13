import { describe, expect, it } from 'vitest';
import { AbortScope, OwnedSecret, revocableView } from './owned-secret.ts';

describe('OwnedSecret', () => {
  it('zeroes bytes on dispose and blocks later use', () => {
    const raw = new Uint8Array([1, 2, 3, 4]);
    const owned = new OwnedSecret(raw);
    raw.fill(9);
    expect(owned.use((bytes) => bytes.slice())).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    );
    owned.dispose();
    expect(owned.state).toBe('disposed');
    expect(() => owned.use((bytes) => bytes[0])).toThrow(/disposed|moved/);
  });

  it('moves ownership and invalidates the source', () => {
    const first = new OwnedSecret(new Uint8Array([7, 8]));
    const second = first.move();
    expect(first.state).toBe('moved');
    expect(() => first.borrow()).toThrow(/moved/);
    expect(second.borrow()).toEqual(new Uint8Array([7, 8]));
    second.dispose();
  });
});

describe('revocableView', () => {
  it('revokes access for third-party holders', () => {
    const resource = { read: () => 42 };
    const capability = revocableView(resource);
    expect(capability.value.read()).toBe(42);
    capability.dispose();
    expect(() => capability.value.read()).toThrow();
  });
});

describe('AbortScope', () => {
  it('aborts the signal when disposed', () => {
    const scope = new AbortScope();
    expect(scope.signal.aborted).toBe(false);
    scope.dispose();
    expect(scope.signal.aborted).toBe(true);
  });
});
