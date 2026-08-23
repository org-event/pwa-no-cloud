export const presenceCopy = {
  needS1: 'Нужен пакет S1., чтобы быть в сети и стучаться.',
  startFailed: 'Не удалось войти в лобби presence. Проверьте S1.',
  available: 'Вы в сети — контакты видят вас онлайн. Экран не засыпает.',
  availableNote: 'presence: доступны',
  unavailable: 'Вы офлайн для контактов.',
  incomingKnock: 'Кто-то стучится в ваше лобби — открываем канал…',
  busyIncoming: (peerId: string) =>
    `Стук от ${peerId.slice(0, 6)}…, но вы уже в канале.`,
  peerOffline: 'Контакт сейчас не в лобби — всё равно стучимся…',
  mediaSoon: (kind: string) =>
    `Режим «${kind}» скоро. Пока открываем data-канал.`,
} as const;
