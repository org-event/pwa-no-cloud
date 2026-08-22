import {
  expandRecipients,
  type AddressBook,
  type ProfileCard,
} from '../domain/profile.ts';

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
    return 'Связь теперь в «Контакты»: карточка → копировать → второй вставляет. Файлы подключим после книги.';
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
  shareUrl?: string;
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
  if (state.waiting && state.shareUrl) {
    return 'Ссылка уже в поле. «Копировать ссылку» → киньте в Telegram. Второй только открывает, ничего вам обратно слать не нужно. Окно не закрывайте.';
  }
  if (state.waiting) {
    return 'Ждём, пока второй откроет ссылку. Это окно не закрывайте.';
  }
  if (state.queuedCount > 0) {
    return 'Файл выбран. Нажмите «Получить ссылку» — она появится в поле, её и отправляете.';
  }
  return 'Сначала откройте «Контакты» и обменяйтесь карточками.';
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

export { expandRecipients };
