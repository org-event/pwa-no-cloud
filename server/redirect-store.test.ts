import { describe, expect, it } from 'vitest';
import * as ed from '@noble/ed25519';
import {
  canonicalRelayRedirect,
  createRedirectStore,
  encodeRedirectWire,
  REDIRECT_NOTE_PREFIX,
} from './redirect-store.js';

const bytesToHex = (bytes) =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

const toBase64Url = (bytes) =>
  Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const encodePk1 = (publicKey) => `pk1.${toBase64Url(publicKey)}`;

const signNote = async (owner, relays, issuedAt, expiresAt) => {
  const pk = encodePk1(owner.publicKey);
  const message = new TextEncoder().encode(
    canonicalRelayRedirect(pk, relays, issuedAt, expiresAt),
  );
  const signature = await ed.signAsync(message, owner.secretKey);
  return encodeRedirectWire({
    v: 1,
    pk,
    relays,
    issuedAt,
    expiresAt,
    sig: bytesToHex(signature),
  });
};

describe('redirect store (U3.1)', () => {
  it('PUT then GET by pubkey (smoke)', async () => {
    let clock = 1_000_000;
    const store = createRedirectStore({ now: () => clock });
    const owner = await ed.keygenAsync();
    const wire = await signNote(
      owner,
      ['https://relay.example', 'wss://backup.example'],
      clock,
      clock + 60_000,
    );
    expect(wire.startsWith(REDIRECT_NOTE_PREFIX)).toBe(true);

    const put = await store.put(wire);
    expect(put.ok).toBe(true);
    if (!put.ok) return;

    const got = store.get(put.value.pk);
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.note).toBe(put.value.wire);
    expect(got.value.expiresAt).toBe(clock + 60_000);
  });

  it('rejects bad signature and drops expired notes', async () => {
    let clock = 1_000_000;
    const store = createRedirectStore({ now: () => clock });
    const owner = await ed.keygenAsync();
    const other = await ed.keygenAsync();
    const issuedAt = clock;
    const expiresAt = clock + 1_000;
    const pk = encodePk1(owner.publicKey);
    const message = new TextEncoder().encode(
      canonicalRelayRedirect(pk, ['https://a.example'], issuedAt, expiresAt),
    );
    const badSig = await ed.signAsync(message, other.secretKey);
    const bad = encodeRedirectWire({
      v: 1,
      pk,
      relays: ['https://a.example'],
      issuedAt,
      expiresAt,
      sig: bytesToHex(badSig),
    });
    const rejected = await store.put(bad);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.code).toBe('bad-sig');

    const good = await signNote(
      owner,
      ['https://a.example'],
      issuedAt,
      expiresAt,
    );
    expect((await store.put(good)).ok).toBe(true);
    clock = expiresAt + 1;
    const gone = store.get(pk);
    expect(gone.ok).toBe(false);
    if (!gone.ok) expect(gone.code).toBe('expired');
  });

  it('rejects stale overwrite', async () => {
    let clock = 1_000_000;
    const store = createRedirectStore({ now: () => clock });
    const owner = await ed.keygenAsync();
    const newer = await signNote(
      owner,
      ['https://new.example'],
      clock + 10,
      clock + 100_000,
    );
    const older = await signNote(
      owner,
      ['https://old.example'],
      clock,
      clock + 100_000,
    );
    expect((await store.put(newer)).ok).toBe(true);
    const stale = await store.put(older);
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe('stale');
  });
});
