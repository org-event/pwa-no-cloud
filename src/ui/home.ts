import { avatarSrc } from '../lib/avatar.ts';
import {
  expandRecipients,
  type AddressBook,
  type ProfileCard,
} from '../domain/profile.ts';
import { mountPendingPeer } from './contacts.ts';

export type HomeState = {
  manual: boolean;
  hasTurn: boolean;
  me: ProfileCard;
  book: AddressBook;
  pending: ProfileCard | null;
  selectedContactIds: string[];
  selectedGroupIds: string[];
  peerNick: string;
  roomId: string;
  shareUrl: string;
  waiting: boolean;
  connected: boolean;
  queuedCount: number;
  role: 'idle' | 'caller' | 'callee';
  fromLink: boolean;
  error: string;
  socketBlocked: boolean;
};

export type HomeHandlers = {
  onCreateInvite: () => void;
  onJoin: () => void;
  onShareRoom: () => void;
  onCopyShareUrl: () => void;
  onCopyId: () => void;
  onAcceptPending: () => void;
  onSkipPending: () => void;
  onToggleContact: (id: string) => void;
  onToggleGroup: (id: string) => void;
};

export const formatHomeLead = (state: {
  manual: boolean;
  hasTurn: boolean;
  socketBlocked?: boolean;
}): string => {
  if (state.socketBlocked) {
    return 'В S1 сокет http://, а сайт HTTPS — браузер режет ws://. Перезапустите установщик на VPS (сокет с HTTPS) и вставьте новый S1. Пока можно «Получить ссылку»: это приглашение через TURN.';
  }
  if (state.manual) {
    return 'Сокета нет: ссылка короче не выйдет. «Получить ссылку» сделает приглашение.';
  }
  if (state.hasTurn) {
    return 'Файл → «Получить ссылку» → отправьте её в мессенджер. Второй открывает и принимает.';
  }
  return 'Сокет есть, но без TURN через сотовую часто не соединится. Добавьте TURN в «Настройки сервера».';
};

export const formatHomeWait = (state: {
  connected: boolean;
  waiting: boolean;
  queuedCount: number;
  role: 'idle' | 'caller' | 'callee';
  fromLink: boolean;
  peerNick?: string;
}): string => {
  const withWho = state.peerNick ? ` с ${state.peerNick}` : '';
  if (state.connected) {
    return state.queuedCount > 0
      ? `Связь${withWho} есть. Файлы из очереди уходят, второй жмёт «Принять».`
      : `Связь${withWho} есть. Можно слать ещё файлы.`;
  }
  if (state.waiting && state.fromLink) {
    return 'Открыли ссылку — сходимся с отправителем. Это окно не закрывайте.';
  }
  if (state.waiting) {
    return 'Ждём, пока второй откроет ссылку. Это окно не закрывайте.';
  }
  if (state.queuedCount > 0) {
    return 'Файл выбран. Нажмите «Получить ссылку» и отправьте её в Telegram или WhatsApp.';
  }
  return 'Сначала файл в блоке «Файлы», потом «Получить ссылку».';
};

export const formatShareButton = (state: {
  contacts: { nick: string }[];
  groups: { name: string }[];
}): string => {
  if (state.contacts.length === 1 && state.groups.length === 0) {
    const nick = state.contacts[0]?.nick;
    return nick ? `Получить ссылку для ${nick}` : 'Получить ссылку';
  }
  if (state.groups.length === 1 && state.contacts.length === 0) {
    const name = state.groups[0]?.name;
    return name ? `Получить ссылку для группы «${name}»` : 'Получить ссылку';
  }
  if (state.contacts.length + state.groups.length > 1) {
    return 'Получить ссылку для выбранных';
  }
  return 'Получить ссылку';
};

export const formatRecipientHint = (people: number): string => {
  if (people <= 1) {
    return 'Необязательно. Группа — ярлык: ссылку всё равно откроет один человек.';
  }
  return `Выбрано ${people} чел. Канал один — кто первый откроет ссылку, тот и в паре.`;
};

const avatarImg = (id: string, avatar: string) => {
  const img = document.createElement('img');
  img.className = 'avatar';
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.width = 40;
  img.height = 40;
  img.src = avatarSrc(id, avatar);
  return img;
};

export const mountHome = (root: HTMLElement, handlers: HomeHandlers) => {
  const pending = mountPendingPeer(root, handlers);

  const panel = document.createElement('fieldset');
  panel.className = 'panel';
  const legend = document.createElement('legend');
  legend.textContent = 'Как связаться';
  panel.append(legend);

  const who = document.createElement('div');
  who.className = 'contact-row';
  const whoMeta = document.createElement('div');
  const whoName = document.createElement('strong');
  const whoId = document.createElement('p');
  whoId.className = 'tagline';
  whoMeta.append(whoName, whoId);
  const idBtn = document.createElement('button');
  idBtn.type = 'button';
  idBtn.className = 'button button-secondary';
  idBtn.textContent = 'Копировать id';
  idBtn.addEventListener('click', () => handlers.onCopyId());

  const lead = document.createElement('p');
  lead.className = 'tagline';

  const recipients = document.createElement('fieldset');
  recipients.className = 'contact-pick';
  const recipientsLegend = document.createElement('legend');
  recipientsLegend.textContent = 'Кому';
  const recipientsHint = document.createElement('p');
  recipientsHint.className = 'tagline';
  const recipientsList = document.createElement('div');
  recipientsList.className = 'contact-list';
  recipients.append(recipientsLegend, recipientsHint, recipientsList);

  const steps = document.createElement('ol');
  steps.className = 'home-steps';
  const step1 = document.createElement('li');
  step1.textContent = 'Выберите файл в блоке «Файлы».';
  const step2 = document.createElement('li');
  step2.textContent = 'Нажмите «Получить ссылку».';
  const step3 = document.createElement('li');
  step3.textContent = 'Отправьте ссылку второму. Он открывает и принимает.';
  steps.append(step1, step2, step3);

  const wait = document.createElement('p');
  wait.className = 'status-line home-wait';
  wait.setAttribute('role', 'status');

  const shareField = document.createElement('label');
  shareField.className = 'field';
  const shareLabel = document.createElement('span');
  shareLabel.textContent = 'Ссылка — её копируете и отправляете';
  const shareInput = document.createElement('input');
  shareInput.type = 'text';
  shareInput.readOnly = true;
  shareInput.autocomplete = 'off';
  shareInput.setAttribute('aria-label', 'Ссылка для второго устройства');
  shareField.append(shareLabel, shareInput);

  const shareActions = document.createElement('div');
  shareActions.className = 'home-actions';
  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'button button-accent';
  shareBtn.textContent = 'Получить ссылку';
  shareBtn.addEventListener('click', () => handlers.onShareRoom());
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'button button-secondary';
  copyBtn.textContent = 'Копировать ссылку';
  copyBtn.addEventListener('click', () => handlers.onCopyShareUrl());
  shareActions.append(shareBtn, copyBtn);

  const create = document.createElement('button');
  create.type = 'button';
  create.className = 'button';
  create.textContent = 'Создать приглашение';
  create.addEventListener('click', () => handlers.onCreateInvite());
  const join = document.createElement('button');
  join.type = 'button';
  join.className = 'button button-secondary';
  join.textContent = 'Я открыл чужое приглашение';
  join.addEventListener('click', () => handlers.onJoin());
  const manualActions = document.createElement('div');
  manualActions.className = 'home-actions';
  manualActions.append(create, join);

  const error = document.createElement('p');
  error.className = 'error';
  error.hidden = true;
  error.setAttribute('role', 'alert');

  panel.append(
    lead,
    steps,
    wait,
    shareField,
    shareActions,
    who,
    idBtn,
    recipients,
    manualActions,
    error,
  );
  root.append(panel);

  return {
    sync(state: HomeState) {
      pending.sync(state.pending);
      who.replaceChildren(avatarImg(state.me.id, state.me.avatar), whoMeta);
      whoName.textContent = state.me.nick;
      whoId.textContent = `id ${state.me.id}`;
      lead.textContent = formatHomeLead(state);
      wait.textContent = formatHomeWait(state);
      wait.dataset.waiting = String(state.waiting);
      wait.dataset.connected = String(state.connected);
      shareInput.value = state.shareUrl;
      copyBtn.disabled = !state.shareUrl;
      shareBtn.disabled = state.fromLink;
      shareBtn.textContent = formatShareButton({
        contacts: state.book.contacts.filter((item) =>
          state.selectedContactIds.includes(item.id),
        ),
        groups: state.book.groups.filter((item) =>
          state.selectedGroupIds.includes(item.id),
        ),
      });
      const people = expandRecipients(
        state.book,
        state.selectedContactIds,
        state.selectedGroupIds,
      ).length;
      recipientsHint.textContent = formatRecipientHint(people);
      recipientsList.replaceChildren();
      if (state.book.contacts.length === 0 && state.book.groups.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'tagline';
        empty.textContent =
          'Книга пуста. Ссылка всё равно сработает — карточка придёт при связи.';
        recipientsList.append(empty);
      }
      for (const contact of state.book.contacts) {
        const row = document.createElement('label');
        row.className = 'choice';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = state.selectedContactIds.includes(contact.id);
        input.addEventListener('change', () => {
          handlers.onToggleContact(contact.id);
        });
        row.append(
          input,
          avatarImg(contact.id, contact.avatar),
          document.createTextNode(contact.nick),
        );
        recipientsList.append(row);
      }
      for (const group of state.book.groups) {
        const row = document.createElement('label');
        row.className = 'choice';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = state.selectedGroupIds.includes(group.id);
        input.addEventListener('change', () => {
          handlers.onToggleGroup(group.id);
        });
        const label = document.createElement('span');
        label.textContent = `группа «${group.name}» · ${group.memberIds.length}`;
        row.append(input, label);
        recipientsList.append(row);
      }
      steps.hidden = false;
      shareField.hidden = false;
      shareActions.hidden = false;
      recipients.hidden =
        state.book.contacts.length === 0 && state.book.groups.length === 0;
      idBtn.hidden = false;
      manualActions.hidden = true;
      error.hidden = !state.error;
      error.textContent = state.error;
    },
  };
};
