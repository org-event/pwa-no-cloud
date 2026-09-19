import { describe, expect, it, vi } from 'vitest';
import { CHAT_MESSAGE_PREFIX } from '@/domain/chat/message.ts';
import { demuxControlFrame } from './control-demux.ts';
import { createRoomRecover } from './room-recover.ts';

describe('control demux', () => {
  it('routes H1. chat wires', () => {
    const wire = `${CHAT_MESSAGE_PREFIX}{"v":1}`;
    expect(demuxControlFrame(wire, 'broken')).toEqual({
      kind: 'chat',
      wire,
    });
  });

  it('routes profile cards', () => {
    const raw = JSON.stringify({
      type: 'profile',
      id: 'a'.repeat(16),
      nick: 'Ada',
      avatar: '',
    });
    const result = demuxControlFrame(raw, 'broken');
    expect(result.kind).toBe('profile');
    if (result.kind !== 'profile') return;
    expect(result.card.nick).toBe('Ada');
  });

  it('routes ping and pong', () => {
    expect(
      demuxControlFrame(JSON.stringify({ type: 'ping', t: 1 }), 'x'),
    ).toEqual({ kind: 'ping', t: 1 });
    expect(
      demuxControlFrame(JSON.stringify({ type: 'pong', t: 42 }), 'x'),
    ).toEqual({ kind: 'pong', rttBase: 42 });
  });

  it('reports broken JSON', () => {
    expect(demuxControlFrame('{nope', 'broken-frame')).toEqual({
      kind: 'broken',
      message: 'broken-frame',
    });
  });
});

describe('room recover', () => {
  it('schedules once and runs recover when unhealthy', async () => {
    vi.useFakeTimers();
    const recover = vi.fn(async () => {});
    const helper = createRoomRecover({
      enabled: () => true,
      isHealthy: () => false,
      recover,
    });
    helper.schedule('ice-failed', 600);
    helper.schedule('ice-failed', 600);
    await vi.advanceTimersByTimeAsync(600);
    expect(recover).toHaveBeenCalledOnce();
    expect(recover).toHaveBeenCalledWith('ice-failed');
    vi.useRealTimers();
  });

  it('skips when already healthy', async () => {
    const recover = vi.fn(async () => {});
    const helper = createRoomRecover({
      enabled: () => true,
      isHealthy: () => true,
      recover,
    });
    await helper.run('resume');
    expect(recover).not.toHaveBeenCalled();
  });
});
