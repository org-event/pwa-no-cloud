export type InviteState = {
  role: 'idle' | 'caller' | 'callee';
  mode: 'manual' | 'room';
  open: boolean;
  outgoing: string;
  qrUrl: string | null;
  error: string;
  connected: boolean;
  lastPongMs: number | null;
  ice: string;
  shareWithPeer: boolean;
  canShareServers: boolean;
};

export type InviteHandlers = {
  onApplyPaste: (text: string) => void;
  onCopy: () => void;
  onShareLink: () => void;
  onPing: () => void;
  onShareWithPeer: (on: boolean) => void;
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
  outgoing.setAttribute('aria-label', 'Исходящее приглашение');

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'button button-secondary';
  copy.textContent = 'Скопировать';
  copy.addEventListener('click', () => handlers.onCopy());

  const shareLink = document.createElement('button');
  shareLink.type = 'button';
  shareLink.className = 'button';
  shareLink.textContent = 'Поделиться ссылкой';
  shareLink.addEventListener('click', () => handlers.onShareLink());

  const paste = document.createElement('textarea');
  paste.rows = 6;
  paste.placeholder = 'Вставьте приглашение или ответ';
  paste.className = 'invite-in';
  paste.setAttribute('aria-label', 'Входящее приглашение или ответ');

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

  const share = document.createElement('label');
  share.className = 'choice';
  const shareInput = document.createElement('input');
  shareInput.type = 'checkbox';
  shareInput.name = 'shareServers';
  shareInput.addEventListener('change', () => {
    handlers.onShareWithPeer(shareInput.checked);
  });
  const shareText = document.createElement('span');
  shareText.textContent =
    'Вложить мои серверы: если у второго нет TURN/сокета — пусть возьмёт эти';
  share.append(shareInput, shareText);

  const outActions = document.createElement('div');
  outActions.className = 'home-actions';
  outActions.append(copy, shareLink);

  const inActions = document.createElement('div');
  inActions.className = 'home-actions';
  inActions.append(apply, ping);

  const error = document.createElement('p');
  error.className = 'error';
  error.hidden = true;
  error.setAttribute('role', 'alert');

  panel.append(hint, share, qr, outgoing, outActions, paste, inActions, error);
  root.append(panel);

  return {
    sync(state: InviteState) {
      const manual = state.mode === 'manual';
      panel.hidden = !manual;
      if (!manual) {
        hint.textContent = state.connected
          ? 'Канал открыт'
          : 'Оба в одной комнате — канал откроется сам';
      } else if (state.role === 'caller') {
        hint.textContent =
          'Отправьте текст второму окну, затем вставьте его ответ';
      } else if (state.role === 'callee') {
        hint.textContent =
          'Вставьте приглашение или пакет S1. с серверов, затем отдайте ответ';
      } else {
        hint.textContent = state.connected ? 'Канал открыт' : '';
      }
      share.hidden = !manual;
      shareInput.checked = state.shareWithPeer;
      shareInput.disabled = !state.canShareServers;
      qr.hidden = !manual || !state.qrUrl;
      if (state.qrUrl) qr.src = state.qrUrl;
      outgoing.hidden = !manual;
      outActions.hidden = !manual;
      paste.hidden = !manual;
      apply.hidden = !manual;
      outgoing.value = state.outgoing;
      copy.disabled = !state.outgoing;
      shareLink.disabled = !state.outgoing;
      apply.disabled = state.connected;
      ping.disabled = !state.connected;
      error.hidden = !state.error;
      error.textContent = state.error;
    },
  };
};
