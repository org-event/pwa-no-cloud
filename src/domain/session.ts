export type SessionState =
  | 'idle'
  | 'signaling'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'closed';

export type Session = {
  state: SessionState;
};

export const createIdleSession = (): Session => ({
  state: 'idle',
});
