import { transferProgress, type Transfer } from '../domain/transfer.ts';

export type TransferViewState = {
  connected: boolean;
  current: Transfer | null;
  incoming: Transfer | null;
  error: string;
};

export type TransferHandlers = {
  onPickFile: (file: File) => void;
  onAcceptFile: (transferId: string) => void;
  onRejectFile: (transferId: string) => void;
  onCancelFile: () => void;
};

const formatSize = (size: number): string => {
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
};

const statusText = (transfer: Transfer): string => {
  const progress = transferProgress(transfer);
  const chunk = `${progress.done}/${progress.total}`;
  if (transfer.state === 'offering') {
    return transfer.direction === 'send'
      ? `ждём согласие · ${transfer.name}`
      : `принять ${transfer.name} (${formatSize(transfer.size)})`;
  }
  if (transfer.state === 'sending') return `отправка ${transfer.name} ${chunk}`;
  if (transfer.state === 'receiving') {
    return `приём ${transfer.name} ${chunk}`;
  }
  if (transfer.state === 'writing') return `запись ${transfer.name}`;
  if (transfer.state === 'done') return `готово: ${transfer.name}`;
  if (transfer.state === 'canceled') return `отменено: ${transfer.name}`;
  if (transfer.state === 'failed') {
    return `ошибка ${transfer.name}: ${transfer.error}`;
  }
  return transfer.name;
};

export const mountTransfer = (
  root: HTMLElement,
  handlers: TransferHandlers,
) => {
  const panel = document.createElement('fieldset');
  panel.className = 'panel';
  const legend = document.createElement('legend');
  legend.textContent = 'Файл';
  panel.append(legend);

  const pick = document.createElement('input');
  pick.type = 'file';
  pick.className = 'file-input';
  pick.addEventListener('change', () => {
    const file = pick.files?.[0];
    if (file) handlers.onPickFile(file);
    pick.value = '';
  });

  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'button';
  send.textContent = 'Отправить файл';
  send.addEventListener('click', () => pick.click());

  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'button';
  accept.textContent = 'Принять файл';

  const reject = document.createElement('button');
  reject.type = 'button';
  reject.className = 'button button-secondary';
  reject.textContent = 'Отклонить';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'button button-secondary';
  cancel.textContent = 'Отменить';
  cancel.addEventListener('click', () => handlers.onCancelFile());

  const actions = document.createElement('div');
  actions.className = 'home-actions';
  actions.append(send, accept, reject, cancel);

  const status = document.createElement('p');
  status.className = 'tagline';

  const error = document.createElement('p');
  error.className = 'error';
  error.hidden = true;

  panel.append(pick, actions, status, error);
  root.append(panel);

  return {
    sync(state: TransferViewState) {
      panel.hidden = !state.connected && !state.current && !state.incoming;
      send.disabled = !state.connected || Boolean(state.current);
      const incoming = state.incoming;
      accept.hidden = !incoming;
      reject.hidden = !incoming;
      accept.onclick = () => {
        if (incoming) handlers.onAcceptFile(incoming.id);
      };
      reject.onclick = () => {
        if (incoming) handlers.onRejectFile(incoming.id);
      };
      const busy =
        state.current?.state === 'sending' ||
        state.current?.state === 'receiving';
      cancel.hidden = !busy;
      const shown = state.incoming ?? state.current;
      status.hidden = !shown;
      status.textContent = shown ? statusText(shown) : '';
      error.hidden = !state.error;
      error.textContent = state.error;
    },
  };
};
