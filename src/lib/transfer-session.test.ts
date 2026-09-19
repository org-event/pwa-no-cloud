import { fromAny } from '@total-typescript/shoehorn';
import { describe, expect, it, vi } from 'vitest';
import {
  createTransferSession,
  type TransferSessionState,
} from './transfer-session.ts';
import type { TransferPort } from './transfer-port.ts';
import type { PickedFile } from './folder-walk.ts';

const fakePort = (overrides: Partial<TransferPort> = {}): TransferPort =>
  fromAny({
    sendFile: vi.fn(),
    sendFolder: vi.fn(),
    accept: vi.fn(),
    reject: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    current: () => null,
    currentFolder: () => null,
    activeFile: () => null,
    incomingFile: () => null,
    activeFolder: () => null,
    incomingFolder: () => null,
    ...overrides,
  });

const baseDeps = () => ({
  getPort: () => null as TransferPort | null,
  getLink: () => null as { state: 'connected'; roomId: string } | null,
  meetRoomId: (id: string) => `c-${id}`,
  resolveContactId: () => null as string | null,
  note: vi.fn(),
  notesQueued: (label: string) => `queued:${label}`,
  onChange: (_s: TransferSessionState) => {},
  copy: { needContact: 'need-contact', needFiles: 'need-files' },
});

describe('TransferSession', () => {
  it('stages files and flushes the first when the link is connected', () => {
    const sendFile = vi.fn();
    const port = fakePort({ sendFile });
    const a = new File(['a'], 'a.txt');
    const b = new File(['b'], 'b.txt');
    const session = createTransferSession({
      ...baseDeps(),
      getPort: () => port,
      getLink: () => ({ state: 'connected', roomId: 'c-peer' }),
      resolveContactId: () => 'peer',
    });

    session.pickFiles([a, b]);
    expect(session.getState().queuedFiles).toHaveLength(2);
    session.flushQueue();
    expect(sendFile).toHaveBeenCalledWith(a);
    expect(session.getState().queuedFiles).toEqual([b]);
  });

  it('sends folder ahead of files when staged', () => {
    const sendFolder = vi.fn();
    const port = fakePort({ sendFolder });
    const entries: PickedFile[] = [
      { path: 'dir/a.txt', file: new File(['a'], 'a.txt') },
    ];
    const session = createTransferSession({
      ...baseDeps(),
      getPort: () => port,
      getLink: () => ({ state: 'connected', roomId: 'c-peer' }),
      resolveContactId: () => 'peer',
    });

    session.pickFolder(entries, 'dir');
    session.flushQueue();
    expect(sendFolder).toHaveBeenCalledWith(entries);
    expect(session.getState().queuedFolder).toBeNull();
  });

  it('requires contact and files before send', async () => {
    const session = createTransferSession(baseDeps());

    await session.send();
    expect(session.getState().transferError).toBe('need-contact');

    const withContact = createTransferSession({
      ...baseDeps(),
      resolveContactId: () => 'peer',
    });
    await withContact.send();
    expect(withContact.getState().transferError).toBe('need-files');
  });

  it('knocks then flushes when not already in the meet room', async () => {
    const port = fakePort();
    const knockOn = vi.fn(async () => {});
    const session = createTransferSession({
      ...baseDeps(),
      getPort: () => port,
      getLink: () => ({ state: 'signaling', roomId: '' }),
      knockOn,
      resolveContactId: () => 'peer',
    });

    session.pickFile(new File(['x'], 'x.txt'));
    await session.send();
    expect(knockOn).toHaveBeenCalledWith('peer', false);
  });

  it('accepts via TransferPort and requests notify', () => {
    const accept = vi.fn();
    const port = fakePort({ accept });
    const requestNotify = vi.fn();
    const ensureLivePeerInBook = vi.fn();
    const session = createTransferSession({
      ...baseDeps(),
      getPort: () => port,
      getLink: () => ({ state: 'connected', roomId: 'c-peer' }),
      resolveContactId: () => 'peer',
      ensureLivePeerInBook,
      requestNotify,
    });

    session.accept('t1');
    expect(ensureLivePeerInBook).toHaveBeenCalled();
    expect(requestNotify).toHaveBeenCalled();
    expect(accept).toHaveBeenCalledWith('t1');
  });
});
