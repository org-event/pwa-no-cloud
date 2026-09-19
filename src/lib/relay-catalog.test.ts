import { describe, expect, it, vi } from 'vitest';
import { createUserSettings } from '@/config/index.ts';
import type { CustomServerDraft } from '@/config/types.ts';
import { emptyRelayBundle } from '@/domain/discovery/index.ts';
import {
  createRelayCatalog,
  type RelayCatalogDeps,
  type RelayCatalogState,
} from './relay-catalog.ts';

const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
};

const baseDeps = (
  overrides: Partial<RelayCatalogDeps> = {},
): {
  deps: RelayCatalogDeps;
  getState: () => RelayCatalogState;
} => {
  let snap: RelayCatalogState = {
    settings: createUserSettings(),
    savedServers: [],
    activeServerId: null,
    relayBundle: emptyRelayBundle(),
    hostNotice: '',
    manualReach: 'unknown',
    shareWithPeer: true,
    hostDraft: { host: '', sshUser: 'root' },
  };
  const deps: RelayCatalogDeps = {
    storage: memoryStorage(),
    getOpfsStore: () => null,
    origin: () => undefined,
    presenceAvailable: () => false,
    ensurePresenceActive: vi.fn(),
    startPresence: vi.fn(),
    copyText: vi.fn(async () => true),
    note: vi.fn(),
    onChange: (next) => {
      snap = next;
    },
    initial: { ...snap },
    ...overrides,
  };
  return {
    deps,
    getState: () => snap,
  };
};

describe('createRelayCatalog', () => {
  it('failoverRelay switches active URL when another URL exists', () => {
    const { deps, getState } = baseDeps({
      initial: {
        settings: createUserSettings(),
        relayBundle: {
          urls: ['wss://a.example/ws', 'wss://b.example/ws'],
          activeUrl: 'wss://a.example/ws',
          updatedAt: 1,
        },
      },
    });
    const catalog = createRelayCatalog(deps);
    expect(catalog.failoverRelay('wss://a.example/ws')).toBe(true);
    expect(getState().relayBundle.activeUrl).toBe('wss://b.example/ws');
    expect(getState().hostNotice).toContain('wss://b.example/ws');
  });

  it('refreshRelayBundleFrom merges remote URLs (fake fetch)', async () => {
    const fetchRelayBundle = vi.fn(async () => ({
      ok: true as const,
      value: {
        op: 'relays' as const,
        v: 1 as const,
        issuedAt: 50,
        relays: [{ url: 'wss://a.example/ws' }, { url: 'https://b.example' }],
      },
    }));
    const { deps, getState } = baseDeps({
      fetchRelayBundle,
      initial: {
        settings: createUserSettings(),
        relayBundle: {
          urls: ['wss://a.example/ws'],
          activeUrl: 'wss://a.example/ws',
          updatedAt: 1,
        },
      },
    });
    const catalog = createRelayCatalog(deps);
    const ok = await catalog.refreshRelayBundleFrom('wss://a.example/ws');
    expect(ok).toBe(true);
    expect(fetchRelayBundle).toHaveBeenCalledWith('wss://a.example/ws');
    expect(getState().relayBundle.urls).toEqual([
      'wss://a.example/ws',
      'https://b.example',
    ]);
    expect(getState().relayBundle.activeUrl).toBe('wss://a.example/ws');
  });

  it('applyShareDraft activates and upserts a saved server', () => {
    const ensurePresenceActive = vi.fn();
    const { deps, getState } = baseDeps({ ensurePresenceActive });
    const catalog = createRelayCatalog(deps);
    const draft: CustomServerDraft = {
      signaling: { kind: 'websocket', url: 'wss://share.example/ws' },
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    };
    catalog.applyShareDraft(draft, 'pack saved');
    const state = getState();
    expect(state.savedServers).toHaveLength(1);
    expect(state.savedServers[0]?.draft.signaling.url).toBe(
      'wss://share.example/ws',
    );
    expect(state.activeServerId).toBe(state.savedServers[0]?.id);
    expect(state.settings.presetId).toBe('custom');
    expect(state.settings.custom.signaling.url).toBe('wss://share.example/ws');
    expect(state.hostNotice).toBe('pack saved');
    expect(ensurePresenceActive).toHaveBeenCalled();
  });
});
