export const configCopy = {
  appTagline: 'обмен файлами без облака',
  turnCredentialsRequired:
    'TURN нужен логин и пароль. Чужой TURN в пресеты не кладём.',
  signalingUrlRequired:
    'Сокет выбран, а адрес пустой. Вставьте пакет S1. из консоли VPS или в Signaling поставьте «Вручную».',
  iceJsonEmpty: 'iceServers JSON должен быть непустым массивом',
  iceJsonInvalidEntry: 'В iceServers JSON есть некорректная запись',
  iceJsonUnreadable: 'Не удалось прочитать iceServers JSON',
  presetManualGoogle: 'Вручную + STUN Google',
  presetLocalDev: 'Локальный dev',
  presetLan: 'Локальная сеть',
  presetGoogleStun: 'Интернет: STUN Google (без TURN)',
  presetCustom: 'Свой сервер',
} as const;
