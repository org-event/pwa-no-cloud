export type HomeState = {
  manual: boolean;
  roomId: string;
};

export type HomeHandlers = {
  onCreateInvite: () => void;
  onJoin: () => void;
  onRoom: (roomId: string) => void;
  onShareRoom: () => void;
};

export const mountHome = (root: HTMLElement, handlers: HomeHandlers) => {
  const room = document.createElement('label');
  room.className = 'field';
  const roomLabel = document.createElement('span');
  roomLabel.textContent = 'Комната';
  const roomInput = document.createElement('input');
  roomInput.type = 'text';
  roomInput.name = 'room';
  roomInput.autocomplete = 'off';
  roomInput.setAttribute('aria-label', 'Имя комнаты');
  roomInput.addEventListener('input', () => handlers.onRoom(roomInput.value));
  room.append(roomLabel, roomInput);

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

  const shareRoom = document.createElement('button');
  shareRoom.type = 'button';
  shareRoom.className = 'button button-secondary';
  shareRoom.textContent = 'Поделиться комнатой';
  shareRoom.addEventListener('click', () => handlers.onShareRoom());

  actions.append(create, join, shareRoom);
  root.append(room, actions);

  return {
    sync(state: HomeState) {
      room.hidden = state.manual;
      create.textContent = state.manual
        ? 'Создать приглашение'
        : 'Войти в комнату';
      join.hidden = !state.manual;
      shareRoom.hidden = state.manual;
      shareRoom.disabled = !state.roomId.trim();
      if (document.activeElement !== roomInput) {
        roomInput.value = state.roomId;
      }
    },
  };
};
