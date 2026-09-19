export const serversCopy = {
  savedToList: 'Сервер сохранён в список и выбран.',
  addedToList: 'Сервер добавлен в список и выбран.',
  selected: (title: string) => `Выбран сервер «${title}».`,
  removedFromList: 'Сервер удалён из списка.',
  socketUrlRequired: 'Укажите адрес сокета',
  copyFailed: 'Не удалось скопировать.',
  hostSaved:
    'Адрес сохранён. Скопируйте команды: сначала ssh, на сервере — curl.',
  opfsUnavailable: 'OPFS недоступен — команды всё равно можно скопировать.',
  commandsCopied: 'Команды в буфере. 1) ssh  2) curl | sudo bash на VPS.',
  commandsCopyFailed: 'Не удалось скопировать. Выделите команды вручную.',
  packSaved: 'Серверы сохранены. Можно создавать приглашение.',
  qrUnsupported:
    'Камера не читает QR в этом браузере. Вставьте строку S1. текстом.',
  qrNotRecognized: 'QR не распознан.',
  packFromQrSaved: 'Серверы из QR сохранены. Можно создавать приглашение.',
  installerCopied: 'Команда установщика скопирована',
  relayInvalid: 'Нужен нормальный URL реле (ws/wss/http/https).',
  relayAdded: 'Реле добавлено в пучок (Relay Bundle).',
  relayActive: 'Активное реле переключено — Presence идёт на него.',
  relayRemoved: 'Реле удалено из пучка.',
  relayFailover: (url: string) =>
    `Активное реле недоступно — тихо переключились на ${url} (канал P2P не рвём).`,
  redirectApplied:
    'R1. принят: новые реле в пучке, активное выбрано. Если потеряли друг друга — снова «Я в сети» и карточка / S1.',
} as const;
