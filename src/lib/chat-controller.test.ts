import { describe, expect, it, vi } from 'vitest';
import { fingerprintOf, generateKeyPair } from '@/domain/identity/index.ts';
import { createChatMessage } from '@/domain/chat/index.ts';
import { createChatController } from './chat-controller.ts';
import type { KeyPair } from '@/domain/identity/index.ts';

const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
};

const withFixedKey =
  (keyPair: KeyPair | null) =>
  async <T>(op: (kp: KeyPair) => T | Promise<T>): Promise<T | null> => {
    if (!keyPair) return null;
    return op(keyPair);
  };

describe('ChatController', () => {
  it('appends a self-note without signing or knocking', async () => {
    const note = vi.fn();
    const knockOn = vi.fn();
    const trySendWire = vi.fn((_wire: string) => false);
    const controller = createChatController({
      storage: memoryStorage(),
      meId: () => 'me-fingerprint',
      selfPeerId: 'self',
      withKeyPair: withFixedKey(null),
      livePeerId: () => null,
      linkConnected: () => false,
      trySendWire,
      knockOn,
      note,
      onChange: () => {},
      copy: { needIdentity: 'need-id', queuedLocal: 'queued' },
    });

    const ok = await controller.send('self', '  note  ');
    expect(ok).toBe(true);
    expect(trySendWire).not.toHaveBeenCalled();
    expect(knockOn).not.toHaveBeenCalled();
    expect(controller.listMessages('self')).toHaveLength(1);
    expect(controller.listMessages('self')[0]?.text).toBe('note');
  });

  it('requires identity for peer send', async () => {
    const changes: string[] = [];
    const controller = createChatController({
      storage: memoryStorage(),
      meId: () => 'me-fingerprint',
      selfPeerId: 'self',
      withKeyPair: withFixedKey(null),
      livePeerId: () => null,
      linkConnected: () => false,
      trySendWire: () => false,
      note: () => {},
      onChange: (state) => {
        changes.push(state.notice);
      },
      copy: { needIdentity: 'need-id', queuedLocal: 'queued' },
    });

    const ok = await controller.send('peer-aaaaaaaa', 'hi');
    expect(ok).toBe(false);
    expect(changes.at(-1)).toBe('need-id');
  });

  it('sends signed wire when live peer is connected', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const bobId = fingerprintOf(bob.publicKey);
    const trySendWire = vi.fn((_wire: string) => true);
    const knockOn = vi.fn();
    const note = vi.fn();
    const controller = createChatController({
      storage: memoryStorage(),
      meId: () => fingerprintOf(alice.publicKey),
      selfPeerId: 'self',
      withKeyPair: withFixedKey(alice),
      livePeerId: () => bobId,
      linkConnected: () => true,
      trySendWire,
      knockOn,
      note,
      onChange: () => {},
      copy: { needIdentity: 'need-id', queuedLocal: 'queued' },
    });

    const ok = await controller.send(bobId, 'привет');
    expect(ok).toBe(true);
    expect(trySendWire).toHaveBeenCalledOnce();
    expect(String(trySendWire.mock.calls[0]?.[0])).toMatch(/^H1\./);
    expect(knockOn).not.toHaveBeenCalled();
    expect(note).toHaveBeenCalled();
    expect(controller.listMessages(bobId)).toHaveLength(1);
  });

  it('knocks and queues locally when link is not live', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const bobId = fingerprintOf(bob.publicKey);
    const trySendWire = vi.fn((_wire: string) => false);
    const knockOn = vi.fn(async () => {});
    let notice = '';
    const controller = createChatController({
      storage: memoryStorage(),
      meId: () => fingerprintOf(alice.publicKey),
      selfPeerId: 'self',
      withKeyPair: withFixedKey(alice),
      livePeerId: () => null,
      linkConnected: () => false,
      trySendWire,
      knockOn,
      note: () => {},
      onChange: (state) => {
        notice = state.notice;
      },
      copy: { needIdentity: 'need-id', queuedLocal: 'queued' },
    });

    const ok = await controller.send(bobId, 'later');
    expect(ok).toBe(true);
    expect(trySendWire).not.toHaveBeenCalled();
    expect(knockOn).toHaveBeenCalledWith(bobId, false);
    expect(notice).toBe('queued');
    expect(controller.listMessages(bobId)).toHaveLength(1);
  });

  it('accepts verified incoming for me and ignores self echo', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const aliceId = fingerprintOf(alice.publicKey);
    const bobId = fingerprintOf(bob.publicKey);
    const wire = await createChatMessage(
      { toId: aliceId, text: 'from-bob', ts: 42 },
      bob,
    );
    expect(wire.ok).toBe(true);
    if (!wire.ok) return;

    const note = vi.fn();
    const controller = createChatController({
      storage: memoryStorage(),
      meId: () => aliceId,
      selfPeerId: 'self',
      withKeyPair: withFixedKey(alice),
      livePeerId: () => bobId,
      linkConnected: () => true,
      trySendWire: () => false,
      note,
      onChange: () => {},
      copy: { needIdentity: 'need-id', queuedLocal: 'queued' },
    });

    await controller.incoming(wire.value);
    expect(controller.listMessages(bobId)).toHaveLength(1);
    expect(controller.listMessages(bobId)[0]?.text).toBe('from-bob');
    expect(note).toHaveBeenCalled();

    const echo = await createChatMessage(
      { toId: bobId, text: 'echo', ts: 43 },
      alice,
    );
    expect(echo.ok).toBe(true);
    if (!echo.ok) return;
    await controller.incoming(echo.value);
    expect(controller.listMessages(bobId)).toHaveLength(1);
  });
});
