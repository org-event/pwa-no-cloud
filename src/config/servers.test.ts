import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESET_ID } from './defaults.ts';
import {
  SERVER_PRESETS,
  getDefaultPreset,
  getPreset,
} from './servers.ts';

describe('server presets (S5.4 shell screen)', () => {
  it('keeps the known preset ids for the Servers section', () => {
    expect(SERVER_PRESETS.map((preset) => preset.id)).toEqual([
      'manual-only',
      'local-dev',
      'lan',
      'google-stun',
      'custom',
    ]);
  });

  it('resolves the default preset', () => {
    expect(DEFAULT_PRESET_ID).toBeTruthy();
    expect(getPreset(DEFAULT_PRESET_ID)?.id).toBe(DEFAULT_PRESET_ID);
    expect(getDefaultPreset().id).toBe(DEFAULT_PRESET_ID);
  });

  it('keeps custom preset editable (empty ICE until filled)', () => {
    const custom = getPreset('custom');
    expect(custom?.signaling.kind).toBeTruthy();
    expect(custom?.iceServers).toEqual([]);
  });
});
