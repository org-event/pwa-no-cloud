export type HomeState = {
  online: boolean;
  canInstall: boolean;
};

export type HomeHandlers = {
  onInstall: () => void;
  onCreateInvite: () => void;
  onJoin: () => void;
};

export const mountHome = (root: HTMLElement, handlers: HomeHandlers) => {
  const network = document.createElement('p');
  network.className = 'status';
  network.dataset.role = 'network';

  const actions = document.createElement('div');
  actions.className = 'home-actions';

  const create = document.createElement('button');
  create.type = 'button';
  create.className = 'button';
  create.textContent = 'Создать приглашение';
  create.addEventListener('click', () => handlers.onCreateInvite());

  const join = document.createElement('button');
  join.type = 'button';
  join.className = 'button button-secondary';
  join.textContent = 'Присоединиться';
  join.addEventListener('click', () => handlers.onJoin());

  const install = document.createElement('button');
  install.type = 'button';
  install.className = 'button button-accent';
  install.textContent = 'Установить приложение';
  install.hidden = true;
  install.addEventListener('click', () => handlers.onInstall());

  actions.append(create, join, install);
  root.append(network, actions);

  return {
    sync(state: HomeState) {
      network.textContent = state.online ? 'сеть: онлайн' : 'сеть: офлайн';
      network.dataset.online = String(state.online);
      install.hidden = !state.canInstall;
    },
  };
};
