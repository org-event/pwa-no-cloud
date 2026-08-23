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
} as const;
