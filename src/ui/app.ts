import { APP_NAME, APP_TAGLINE } from '../config/index.ts';
import type { ResolveResult, UserSettings } from '../config/types.ts';
import type { Session, TurnHostDraft } from '../domain/index.ts';
import type { InboxState } from './inbox.ts';
import { mountHome, type HomeHandlers } from './home.ts';
import { mountHost, type HostHandlers } from './host.ts';
import { mountHelp } from './help.ts';
import { mountInbox, type InboxHandlers } from './inbox.ts';
import {
  mountInvite,
  type InviteHandlers,
  type InviteState,
} from './invite.ts';
import { mountLogs, type LogsState } from './logs.ts';
import { mountPlaceholder } from './placeholder.ts';
import { mountServers, type ServersHandlers } from './servers.ts';
import { APP_SECTIONS, parseSectionHash, type AppSection } from './sections.ts';
import { formatStatusLine } from './status-line.ts';
import {
  mountTransfer,
  type TransferHandlers,
  type TransferViewState,
} from './transfer.ts';

export type AppViewState = {
  session: Session;
  settings: UserSettings;
  resolved: ResolveResult;
  online: boolean;
  canInstall: boolean;
  roomId: string;
  inbox: InboxState;
  invite: InviteState;
  transfer: TransferViewState;
  host: TurnHostDraft;
  hostNotice: string;
  logs: LogsState;
};

export type AppHandlers = HomeHandlers &
  HostHandlers &
  ServersHandlers &
  InboxHandlers &
  InviteHandlers &
  TransferHandlers & {
    onInstall: () => void;
  };

const icon = (paths: string): SVGSVGElement => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('icon');
  svg.innerHTML = paths;
  return svg;
};

const menuIcon = (): SVGSVGElement =>
  icon(
    '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/>',
  );

const closeIcon = (): SVGSVGElement =>
  icon(
    '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/>',
  );

export const mountApp = (root: HTMLElement, handlers: AppHandlers) => {
  root.replaceChildren();

  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const skip = document.createElement('a');
  skip.className = 'skip-link';
  skip.href = '#content';
  skip.textContent = 'К содержимому';

  const scrim = document.createElement('button');
  scrim.type = 'button';
  scrim.className = 'drawer-scrim';
  scrim.tabIndex = -1;
  scrim.setAttribute('aria-label', 'Закрыть меню');
  scrim.hidden = true;

  const drawer = document.createElement('aside');
  drawer.className = 'drawer';
  drawer.id = 'app-nav';
  drawer.setAttribute('aria-label', 'Разделы');

  const drawerHead = document.createElement('div');
  drawerHead.className = 'drawer-head';
  const brand = document.createElement('div');
  const title = document.createElement('p');
  title.className = 'drawer-title';
  title.textContent = APP_NAME;
  const tagline = document.createElement('p');
  tagline.className = 'tagline';
  tagline.textContent = APP_TAGLINE;
  brand.append(title, tagline);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'icon-button';
  close.setAttribute('aria-label', 'Закрыть меню');
  close.append(closeIcon());
  drawerHead.append(brand, close);

  const nav = document.createElement('nav');
  nav.className = 'drawer-nav';
  nav.setAttribute('aria-label', 'Разделы приложения');
  const links = new Map<AppSection, HTMLAnchorElement>();
  for (const section of APP_SECTIONS) {
    const link = document.createElement('a');
    link.className = 'drawer-link';
    link.href = `#${section.id}`;
    link.textContent = section.title;
    links.set(section.id, link);
    nav.append(link);
  }
  drawer.append(drawerHead, nav);

  const frame = document.createElement('div');
  frame.className = 'app-frame';

  const topbar = document.createElement('header');
  topbar.className = 'topbar';

  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'icon-button';
  menu.setAttribute('aria-label', 'Меню');
  menu.setAttribute('aria-controls', 'app-nav');
  menu.setAttribute('aria-expanded', 'false');
  menu.append(menuIcon());

  const status = document.createElement('p');
  status.className = 'status-line';
  status.dataset.role = 'session';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const install = document.createElement('button');
  install.type = 'button';
  install.className = 'button button-accent topbar-install';
  install.textContent = 'Установить';
  install.hidden = true;
  install.addEventListener('click', () => handlers.onInstall());

  topbar.append(menu, status, install);

  const page = document.createElement('main');
  page.className = 'page';
  page.id = 'content';
  page.tabIndex = -1;

  const heading = document.createElement('h1');
  heading.className = 'page-title';

  const lanRoot = document.createElement('section');
  lanRoot.className = 'page-section';
  lanRoot.dataset.section = 'lan';
  const homeRoot = document.createElement('div');
  homeRoot.className = 'home';
  const home = mountHome(homeRoot, handlers);
  const inviteRoot = document.createElement('div');
  inviteRoot.className = 'invite';
  const invite = mountInvite(inviteRoot, handlers);
  const transferRoot = document.createElement('div');
  transferRoot.className = 'invite';
  const transfer = mountTransfer(transferRoot, handlers);
  const inboxRoot = document.createElement('div');
  inboxRoot.className = 'inbox';
  const inbox = mountInbox(inboxRoot, handlers);
  lanRoot.append(homeRoot, inviteRoot, transferRoot, inboxRoot);

  const serversRoot = document.createElement('section');
  serversRoot.className = 'page-section servers';
  serversRoot.dataset.section = 'servers';
  const hostRoot = document.createElement('div');
  hostRoot.className = 'servers';
  hostRoot.id = 'my-server';
  const host = mountHost(hostRoot, handlers);
  const serversInner = document.createElement('div');
  serversInner.className = 'servers';
  const servers = mountServers(serversInner, handlers);
  serversRoot.append(hostRoot, serversInner);

  const contactsRoot = document.createElement('section');
  contactsRoot.className = 'page-section';
  contactsRoot.dataset.section = 'contacts';
  mountPlaceholder(
    contactsRoot,
    'Контакты',
    'Список людей появится здесь. Пока соединяйтесь приглашением в разделе «Передача в локальной сети».',
  );

  const videoRoot = document.createElement('section');
  videoRoot.className = 'page-section';
  videoRoot.dataset.section = 'video';
  mountPlaceholder(
    videoRoot,
    'Видео конф',
    'Видеозвонок ещё не собран. Сейчас приложение передаёт файлы напрямую, без облака.',
  );

  const logsRoot = document.createElement('section');
  logsRoot.className = 'page-section';
  logsRoot.dataset.section = 'logs';
  const logs = mountLogs(logsRoot);

  const helpRoot = document.createElement('section');
  helpRoot.className = 'page-section help';
  helpRoot.dataset.section = 'help';
  mountHelp(helpRoot);

  const views: Record<AppSection, HTMLElement> = {
    lan: lanRoot,
    servers: serversRoot,
    contacts: contactsRoot,
    video: videoRoot,
    logs: logsRoot,
    help: helpRoot,
  };

  page.append(
    heading,
    lanRoot,
    serversRoot,
    contactsRoot,
    videoRoot,
    logsRoot,
    helpRoot,
  );
  skip.addEventListener('click', (event) => {
    event.preventDefault();
    page.focus();
  });
  frame.append(topbar, page);
  shell.append(skip, scrim, drawer, frame);
  root.append(shell);

  let menuOpen = false;
  let lastFocus: HTMLElement | null = null;

  const setMenuOpen = (open: boolean) => {
    menuOpen = open;
    shell.classList.toggle('is-menu-open', open);
    menu.setAttribute('aria-expanded', String(open));
    scrim.hidden = !open;
    drawer.inert = !open;
    drawer.setAttribute('aria-hidden', String(!open));
    frame.inert = open;
    if (open) {
      lastFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : menu;
      close.focus();
      return;
    }
    const back = lastFocus && document.contains(lastFocus) ? lastFocus : menu;
    back.focus();
  };

  const currentSection = (): AppSection => {
    return parseSectionHash(
      globalThis.location?.hash ?? '',
      globalThis.location?.search ?? '',
    );
  };

  const showSection = (section: AppSection) => {
    heading.textContent =
      APP_SECTIONS.find((item) => item.id === section)?.title ?? '';
    for (const item of APP_SECTIONS) {
      const view = views[item.id];
      const active = item.id === section;
      view.hidden = !active;
      const link = links.get(item.id);
      if (!link) continue;
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  };

  const onHash = () => {
    showSection(currentSection());
    if (menuOpen) setMenuOpen(false);
  };

  menu.addEventListener('click', () => setMenuOpen(!menuOpen));
  close.addEventListener('click', () => setMenuOpen(false));
  scrim.addEventListener('click', () => setMenuOpen(false));
  nav.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLAnchorElement) setMenuOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuOpen) {
      event.preventDefault();
      setMenuOpen(false);
    }
  });
  globalThis.addEventListener('hashchange', onHash);

  drawer.inert = true;
  drawer.setAttribute('aria-hidden', 'true');
  showSection(currentSection());

  return {
    sync(state: AppViewState) {
      const line = formatStatusLine({
        online: state.online,
        session: state.session.state,
        ice: state.invite.ice,
        pongMs: state.invite.lastPongMs,
      });
      status.textContent = line;
      status.dataset.online = String(state.online);
      status.dataset.path = state.invite.ice.includes('путь = relay')
        ? 'relay'
        : '';
      status.title = line;
      install.hidden = !state.canInstall;
      home.sync({
        manual: state.invite.mode === 'manual',
        roomId: state.roomId,
      });
      invite.sync(state.invite);
      transfer.sync(state.transfer);
      inbox.sync(state.inbox);
      host.sync(state.host, state.hostNotice);
      servers.sync(state.settings, state.resolved);
      logs.sync(state.logs);
    },
  };
};
