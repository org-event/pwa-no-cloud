export const domainCopy = {
  hostRequired: 'Укажите IP или DNS сервера',
  hostInvalid: 'Хост должен быть IPv4 или DNS-именем, без URL',
  sshUserInvalid: 'SSH-логин: латиница, цифры, точка, _ или -, до 32 символов',
  hostCommandsFill: '# Заполните SSH-логин и IP, затем скопируйте команды.',
  hostCommandsSsh: '# 1. Войдите на VPS',
  hostCommandsInstall:
    '# 2. На сервере: Docker если нет, порты, пароль — спросит скрипт',
  manualNoSocket: 'вручную (без сокета)',
  noAddress: 'без адреса',
  manualServer: 'Ручной сервер',
  guestNick: (tail: string) => `гость-${tail}`,
  iceFailTurnRelay:
    'ICE не собрался даже через TURN. Проверьте URL, логин и пароль своего релей-сервера.',
  iceFailTurnGathering:
    'ICE оборвался, пока TURN ещё собирал relay. Попробуйте ещё раз — кандидаты теперь досылаются по сокету, не только в SDP.',
  iceFailTurnNoRelay:
    'ICE не собрался. TURN задан, но relay-кандидат не появился — сервер недоступен, порты закрыты или логин/пароль неверны.',
  iceFailNoStunTurn:
    'Нет STUN и TURN. Видны только локальные адреса — в разных сетях этого мало. Нужен свой TURN.',
  iceFailNatStun:
    'Прямой путь закрыт NAT. STUN нашёл внешний адрес, но соединение не прошло. Нужен свой TURN.',
  iceFailNatNoTurn:
    'Прямой путь закрыт NAT. Свой TURN не задан — без него через интернет часто не соединиться.',
} as const;
