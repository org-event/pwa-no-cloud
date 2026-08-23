export const probeCopy = {
  noSocketUrl: 'Нет адреса сокета для проверки',
  noOkTrue: 'Ответ без ok:true',
  noResponse: 'Нет ответа',
  socketUp: 'Сокет отвечает',
  socketDown: (message: string) => `Недоступен: ${message}`,
  socketUnavailable: 'Сокет недоступен',
  probeHint: 'Нажмите «Проверить», чтобы узнать доступность',
  reachUp: 'доступен',
  reachDown: 'недоступен',
  reachChecking: 'проверка',
  reachUnknown: 'статус неизвестен',
} as const;
