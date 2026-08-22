import { describe, expect, it } from 'vitest';
import { listIceUrls } from './ice-urls.ts';
import { createUserSettings, isTurnUrl, resolveServers } from './merge.ts';
import { SERVER_PRESETS } from './servers.ts';

describe('resolveServers', () => {
  it('uses the selected preset over defaults', () => {
    const manual = resolveServers(createUserSettings('manual-only'));
    const local = resolveServers(createUserSettings('local-dev'));
    expect(manual.ok).toBe(true);
    expect(local.ok).toBe(true);
    if (!manual.ok || !local.ok) return;
    expect(manual.value.presetId).toBe('manual-only');
    expect(local.value.presetId).toBe('local-dev');
    expect(local.value.signaling.url).toBe('http://127.0.0.1:8000');
    expect(manual.value.iceServers).not.toEqual(local.value.iceServers);
  });

  it('applies custom overlay instead of the empty template', () => {
    const settings = createUserSettings('custom', {
      signaling: { kind: 'websocket', url: 'wss://signal.example' },
      iceServers: [{ urls: 'stun:stun.example:3478' }],
    });
    const result = resolveServers(settings);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.signaling.url).toBe('wss://signal.example');
    expect(result.value.iceServers[0]?.urls).toBe('stun:stun.example:3478');
  });

  it('fills LAN urls from the current origin', () => {
    const result = resolveServers(
      createUserSettings('lan'),
      'http://192.168.1.10:8000',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.signaling.url).toBe('http://192.168.1.10:8000');
    expect(result.value.iceServers[0]?.urls).toBe('stun:192.168.1.10:3478');
  });

  it('rejects TURN without a username and credential', () => {
    const settings = createUserSettings('custom', {
      signaling: { kind: 'manual' },
      iceServers: [{ urls: 'turn:relay.example:3478' }],
    });
    const result = resolveServers(settings);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('turn-credentials-required');
  });
});

describe('preset secrets', () => {
  it('does not commit TURN credentials', () => {
    for (const preset of SERVER_PRESETS) {
      for (const server of preset.iceServers) {
        expect(server.username).toBeUndefined();
        expect(server.credential).toBeUndefined();
        for (const url of listIceUrls(server.urls)) {
          expect(isTurnUrl(url)).toBe(false);
        }
      }
    }
  });
});
