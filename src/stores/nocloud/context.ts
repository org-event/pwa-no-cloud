import type { StorageLike } from '@/config/storage.ts';
import type { Application } from '@/lib/application.ts';
import type { Ref } from 'vue';
import type { NocloudState } from './state.ts';
import { createNocloudPortsBag, type NocloudPortsBag } from './ports.ts';

export type { NocloudPorts, NocloudPortsBag } from './ports.ts';

export type NocloudContext = {
  state: NocloudState;
  app: Application;
  storage: StorageLike;
  origin: string | undefined;
  skippedPeers: Set<string>;
  peerRevision: Ref<number>;
  touch: () => void;
  note: (line: string) => void;
  /** Typed cross-slice ports (replaces the old flat `refs` bag). */
  ports: NocloudPortsBag;
};

export function createNocloudContext(
  state: NocloudState,
  app: Application,
  storage: StorageLike,
  origin: string | undefined,
  skippedPeers: Set<string>,
  peerRevision: Ref<number>,
  touch: () => void,
  note: (line: string) => void,
): NocloudContext {
  return {
    state,
    app,
    storage,
    origin,
    skippedPeers,
    peerRevision,
    touch,
    note,
    ports: createNocloudPortsBag(),
  };
}
