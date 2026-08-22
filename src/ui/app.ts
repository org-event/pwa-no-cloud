import { APP_NAME, APP_TAGLINE } from '../config/index.ts';
import type { ResolveResult, UserSettings } from '../config/types.ts';
import type { Session } from '../domain/index.ts';
import type { InboxState } from './inbox.ts';
import { mountHome, type HomeHandlers } from './home.ts';
import { mountInbox, type InboxHandlers } from './inbox.ts';
import {
  mountInvite,
  type InviteHandlers,
  type InviteState,
} from './invite.ts';
import { mountServers, type ServersHandlers } from './servers.ts';

export type AppViewState = {
  session: Session;
  settings: UserSettings;
  resolved: ResolveResult;
  online: boolean;
  canInstall: boolean;
  roomId: string;
  inbox: InboxState;
  invite: InviteState;
};

export type AppHandlers = HomeHandlers &
  ServersHandlers &
  InboxHandlers &
  InviteHandlers;

export const mountApp = (root: HTMLElement, handlers: AppHandlers) => {
  root.replaceChildren();

  const main = document.createElement('main');
  main.className = 'shell';

  const title = document.createElement('h1');
  title.textContent = APP_NAME;

  const tagline = document.createElement('p');
  tagline.className = 'tagline';
  tagline.textContent = APP_TAGLINE;

  const status = document.createElement('p');
  status.className = 'status';
  status.dataset.role = 'session';

  const homeRoot = document.createElement('section');
  homeRoot.className = 'home';
  const home = mountHome(homeRoot, handlers);

  const inviteRoot = document.createElement('section');
  inviteRoot.className = 'invite';
  const invite = mountInvite(inviteRoot, handlers);

  const inboxRoot = document.createElement('section');
  inboxRoot.className = 'inbox';
  const inbox = mountInbox(inboxRoot, handlers);

  const serversRoot = document.createElement('section');
  serversRoot.className = 'servers';
  const servers = mountServers(serversRoot, handlers);

  main.append(
    title,
    tagline,
    status,
    homeRoot,
    inviteRoot,
    inboxRoot,
    serversRoot,
  );
  root.append(main);

  return {
    sync(state: AppViewState) {
      const ice = state.invite.ice;
      status.textContent = ice
        ? `сессия: ${state.session.state} · ${ice}`
        : `сессия: ${state.session.state}`;
      home.sync({
        online: state.online,
        canInstall: state.canInstall,
        manual: state.invite.mode === 'manual',
        roomId: state.roomId,
      });
      invite.sync(state.invite);
      inbox.sync(state.inbox);
      servers.sync(state.settings, state.resolved);
    },
  };
};
