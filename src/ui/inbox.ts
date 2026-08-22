import type { InboxEntry } from '../lib/opfs.ts';

export type InboxState = {
  items: InboxEntry[];
  selected: InboxEntry | null;
  preview: string;
  error: string;
  ready: boolean;
};

export type InboxHandlers = {
  onWriteFixture: () => void;
  onRead: (entry: InboxEntry) => void;
  onRemove: (entry: InboxEntry) => void;
  onSelect: (entry: InboxEntry) => void;
};

const keyOf = (entry: InboxEntry): string => {
  return `${entry.transferId}/${entry.name}`;
};

export const mountInbox = (root: HTMLElement, handlers: InboxHandlers) => {
  const panel = document.createElement('fieldset');
  panel.className = 'panel';
  const legend = document.createElement('legend');
  legend.textContent = 'Входящие';
  panel.append(legend);

  const actions = document.createElement('div');
  actions.className = 'home-actions';
  const write = document.createElement('button');
  write.type = 'button';
  write.className = 'button';
  write.textContent = 'Записать пример';
  write.addEventListener('click', () => handlers.onWriteFixture());
  const read = document.createElement('button');
  read.type = 'button';
  read.className = 'button button-secondary';
  read.textContent = 'Прочитать';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'button button-secondary';
  remove.textContent = 'Удалить';
  actions.append(write, read, remove);

  const list = document.createElement('div');
  list.className = 'inbox-list';
  list.setAttribute('role', 'radiogroup');
  list.setAttribute('aria-label', 'Полученные файлы');

  const error = document.createElement('p');
  error.className = 'error';
  error.hidden = true;
  error.setAttribute('role', 'alert');

  const preview = document.createElement('pre');
  preview.className = 'resolved';

  panel.append(actions, list, error, preview);
  root.append(panel);

  return {
    sync(state: InboxState) {
      write.disabled = !state.ready;
      read.disabled = !state.ready || !state.selected;
      remove.disabled = !state.ready || !state.selected;
      read.onclick = () => {
        if (state.selected) handlers.onRead(state.selected);
      };
      remove.onclick = () => {
        if (state.selected) handlers.onRemove(state.selected);
      };
      list.replaceChildren();
      if (!state.ready) {
        const empty = document.createElement('p');
        empty.className = 'tagline';
        empty.textContent = 'OPFS недоступен в этом браузере';
        list.append(empty);
      } else if (state.items.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'tagline';
        empty.textContent = 'Пока пусто';
        list.append(empty);
      }
      for (const item of state.items) {
        const row = document.createElement('label');
        row.className = 'choice';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'inbox';
        input.value = keyOf(item);
        input.checked = Boolean(
          state.selected && keyOf(state.selected) === keyOf(item),
        );
        input.addEventListener('change', () => {
          if (input.checked) handlers.onSelect(item);
        });
        const text = document.createElement('span');
        text.textContent = keyOf(item);
        row.append(input, text);
        list.append(row);
      }
      error.hidden = !state.error;
      error.textContent = state.error;
      preview.textContent = state.preview;
    },
  };
};
