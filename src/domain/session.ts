export type SessionState =
  | 'idle'
  | 'signaling'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'closed';

export type SessionEvent =
  | { type: 'start' }
  | { type: 'remote-ready' }
  | { type: 'channel-open' }
  | { type: 'fail'; message: string }
  | { type: 'close' }
  | { type: 'reset' };

export type Session = {
  state: SessionState;
  error: string;
};

export const createIdleSession = (): Session => ({
  state: 'idle',
  error: '',
});

const canApply = (state: SessionState, type: SessionEvent['type']): boolean => {
  if (type === 'reset') return true;
  if (type === 'fail') return state !== 'closed';
  if (type === 'close') return state !== 'closed';
  if (type === 'start') return state === 'idle' || state === 'closed';
  if (type === 'remote-ready') return state === 'signaling';
  if (type === 'channel-open') {
    return state === 'signaling' || state === 'connecting';
  }
  return false;
};

export const applySessionEvent = (
  session: Session,
  event: SessionEvent,
): Session => {
  if (!canApply(session.state, event.type)) return session;
  if (event.type === 'reset') return createIdleSession();
  if (event.type === 'start') return { state: 'signaling', error: '' };
  if (event.type === 'remote-ready') return { state: 'connecting', error: '' };
  if (event.type === 'channel-open') return { state: 'connected', error: '' };
  if (event.type === 'close') return { state: 'closed', error: '' };
  return { state: 'failed', error: event.message };
};
