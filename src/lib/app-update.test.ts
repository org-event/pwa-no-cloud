import { describe, expect, it } from 'vitest';
import {
  decideUpdate,
  parseRemoteVersion,
  versionFileUrl,
} from './app-update.ts';

describe('app update', () => {
  it('joins version.json to the Pages base', () => {
    expect(versionFileUrl('/pwa-no-cloud/')).toBe('/pwa-no-cloud/version.json');
    expect(versionFileUrl('/')).toBe('/version.json');
  });

  it('reads a remote build label', () => {
    expect(parseRemoteVersion({ version: 'v0.1.0-3-gabc' })).toBe(
      'v0.1.0-3-gabc',
    );
    expect(parseRemoteVersion({ version: '  ' })).toBeNull();
    expect(parseRemoteVersion({})).toBeNull();
  });

  it('reloads only when the remote label differs', () => {
    expect(decideUpdate('v1', 'v1')).toBe('current');
    expect(decideUpdate('v1', 'v2')).toBe('reload');
    expect(decideUpdate('v1', null)).toBe('unavailable');
  });
});
