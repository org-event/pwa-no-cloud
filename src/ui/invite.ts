export type InviteState = {
  role: 'idle' | 'caller' | 'callee';
  outgoing: string;
  qrUrl: string | null;
  error: string;
  connected: boolean;
  lastPongMs: number | null;
  ice: string;
};

export type InviteHandlers = {
  onApplyPaste: (text: string) => void;
  onCopy: () => void;
  onPing: () => void;
};

export const mountInvite = (root: HTMLElement, handlers: InviteHandlers) => {
  const panel = document.createElement('fieldset');
  panel.className = 'panel';
  const legend = document.createElement('legend');
  legend.textContent = 'Приглашение';
  panel.append(legend);

  const hint = document.createElement('p');
  hint.className = 'tagline';
  hint.dataset.role = 'invite-hint';

  const qr = document.createElement('img');
  qr.alt = 'QR приглашения';
  qr.className = 'invite-qr';
  qr.hidden = true;

  const outgoing = document.createElement('textarea');
  outgoing.readOnly = true;
  outgoing.rows = 6;
  outgoing.className = 'invite-out';

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'button button-secondary';
  copy.textContent = 'Скопировать';
  copy.addEventListener('click', () => handlers.onCopy());

  const paste = document.createElement('textarea');
  paste.rows = 6;
  paste.placeholder = 'Вставьте приглашение или ответ';
  paste.className = 'invite-in';

  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'button';
  apply.textContent = 'Принять текст';
  apply.addEventListener('click', () => handlers.onApplyPaste(paste.value));

  const ping = document.createElement('button');
  ping.type = 'button';
  ping.className = 'button button-accent';
  ping.textContent = 'Ping';
  ping.addEventListener('click', () => handlers.onPing());

  const outActions = document.createElement('div');
  outActions.className = 'home-actions';
  outActions.append(copy);

  const inActions = document.createElement('div');
  inActions.className = 'home-actions';
  inActions.append(apply, ping);

  const ice = document.createElement('p');
  ice.className = 'status';
  ice.dataset.role = 'ice';

  const pong = document.createElement('p');
  pong.className = 'status';
  pong.dataset.role = 'pong';

  const error = document.createElement('p');
  error.className = 'error';
  error.hidden = true;

  panel.append(
    hint,
    qr,
    outgoing,
    outActions,
    paste,
    inActions,
    ice,
    pong,
    error,
  );
  root.append(panel);

  return {
    sync(state: InviteState) {
      panel.hidden = state.role === 'idle' && !state.connected;
      if (state.role === 'caller') {
        hint.textContent =
          'Отправьте текст второму окну, затем вставьте его ответ';
      } else if (state.role === 'callee') {
        hint.textContent = 'Вставьте приглашение, затем отдайте ответ';
      } else {
        hint.textContent = state.connected ? 'Канал открыт' : '';
      }
      outgoing.value = state.outgoing;
      copy.disabled = !state.outgoing;
      qr.hidden = !state.qrUrl;
      if (state.qrUrl) qr.src = state.qrUrl;
      apply.disabled = state.connected;
      ping.disabled = !state.connected;
      ice.hidden = !state.ice;
      ice.textContent = state.ice;
      pong.hidden = state.lastPongMs === null;
      if (state.lastPongMs !== null) {
        pong.textContent = `pong: ${state.lastPongMs} мс`;
      }
      error.hidden = !state.error;
      error.textContent = state.error;
    },
  };
};
