import { describe, expect, it } from 'vitest';
import {
  MIXED_CONTENT_SIGNALING,
  humanizeSignalingError,
  mixedContentBlocksSignaling,
} from './mixed-content.ts';

describe('mixed content signaling', () => {
  it('blocks ws/http sockets on an HTTPS page', () => {
    expect(
      mixedContentBlocksSignaling('http://203.0.113.10:8443', 'https:'),
    ).toBe(true);
    expect(
      mixedContentBlocksSignaling('https://203.0.113.10:8443', 'https:'),
    ).toBe(false);
    expect(mixedContentBlocksSignaling('http://127.0.0.1:8443', 'http:')).toBe(
      false,
    );
  });

  it('replaces the browser WebSocket throw with a human line', () => {
    expect(
      humanizeSignalingError(
        "Failed to construct 'WebSocket': An insecure WebSocket connection may not be initiated from a page loaded over HTTPS.",
      ),
    ).toBe(MIXED_CONTENT_SIGNALING);
  });
});
