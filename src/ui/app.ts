import { APP_NAME, APP_TAGLINE } from '../config/index.ts';
import type { ResolveResult, UserSettings } from '../config/types.ts';
import type { Session } from '../domain/index.ts';
import { mountHome, type HomeHandlers } from './home.ts';
import { mountServers, type ServersHandlers } from './servers.ts';

export type AppViewState = {
  session: Session;
  settings: UserSettings;
  resolved: ResolveResult;
  online: boolean;
  canInstall: boolean;
};

export type AppHandlers = HomeHandlers & ServersHandlers;

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

  const serversRoot = document.createElement('section');
  serversRoot.className = 'servers';
  const servers = mountServers(serversRoot, handlers);

  main.append(title, tagline, status, homeRoot, serversRoot);
  root.append(main);

  return {
    sync(state: AppViewState) {
      status.textContent = `сессия: ${state.session.state}`;
      home.sync({ online: state.online, canInstall: state.canInstall });
      servers.sync(state.settings, state.resolved);
    },
  };
};
