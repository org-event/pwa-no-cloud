import { describe, expect, it } from 'vitest';
import { buildStatusLineView, formatStatusLine } from './status-line.ts';

describe('status line', () => {
  it('shows socket ready from server reach without an open peer', () => {
    expect(
      buildStatusLineView({
        online: true,
        session: 'idle',
        ice: '',
        pongMs: null,
        peerNick: '',
        hasSocket: true,
        peerLive: false,
        serverReach: 'up',
      }),
    ).toMatchObject({
      socketLive: true,
      socketBusy: false,
      webrtcLive: false,
      linkLabel: '',
    });
  });

  it('keeps socket red when the selected server is down', () => {
    expect(
      buildStatusLineView({
        online: true,
        session: 'idle',
        ice: '',
        pongMs: null,
        peerNick: '',
        hasSocket: true,
        peerLive: false,
        serverReach: 'down',
      }).socketLive,
    ).toBe(false);
  });

  it('marks socket busy while probing', () => {
    expect(
      buildStatusLineView({
        online: true,
        session: 'idle',
        ice: '',
        pongMs: null,
        peerNick: '',
        hasSocket: true,
        peerLive: false,
        serverReach: 'checking',
      }),
    ).toMatchObject({
      socketLive: false,
      socketBusy: true,
    });
  });

  it('shows webrtc and latency when the peer channel is open', () => {
    expect(
      formatStatusLine({
        online: true,
        session: 'connected',
        ice: 'сейчас путь = host → host · connected',
        pongMs: 12,
        peerNick: 'Анна',
        hasSocket: true,
        peerLive: true,
        serverReach: 'up',
      }),
    ).toBe('Сокет · WebRTC · сервер ок · Анна · прямо · 12 мс');
  });
});
