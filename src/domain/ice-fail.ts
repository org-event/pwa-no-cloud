import { domainCopy } from '@/content/index.ts';

export type IceFailContext = {
  local: string[];
  remote: string[];
  hasTurn: boolean;
  hasStun: boolean;
  gathering?: string;
};

const hasPath = (paths: string[], name: string): boolean => {
  for (const path of paths) {
    if (path === name) return true;
  }
  return false;
};

export const explainIceFailure = (ctx: IceFailContext): string => {
  const sawRelay = hasPath(ctx.local, 'relay') || hasPath(ctx.remote, 'relay');
  const sawSrflx = hasPath(ctx.local, 'srflx') || hasPath(ctx.remote, 'srflx');
  if (ctx.hasTurn && sawRelay) {
    return domainCopy.iceFailTurnRelay;
  }
  if (ctx.hasTurn && !sawRelay) {
    if (ctx.gathering && ctx.gathering !== 'complete') {
      return domainCopy.iceFailTurnGathering;
    }
    return domainCopy.iceFailTurnNoRelay;
  }
  if (!ctx.hasStun && !ctx.hasTurn) {
    return domainCopy.iceFailNoStunTurn;
  }
  if (sawSrflx) {
    return domainCopy.iceFailNatStun;
  }
  return domainCopy.iceFailNatNoTurn;
};
