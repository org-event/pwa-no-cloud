export type SessionState = 'idle';

export type Session = {
  state: SessionState;
};

export const createIdleSession = (): Session => ({
  state: 'idle',
});
