export type IceFailContext = {
  local: string[];
  remote: string[];
  hasTurn: boolean;
  hasStun: boolean;
  gathering?: string;
};

const hasPath = (paths: string[], name: string): boolean => {
  for (const path of paths) {
    if (path === name) return true;
  }
  return false;
};

export const explainIceFailure = (ctx: IceFailContext): string => {
  const sawRelay = hasPath(ctx.local, 'relay') || hasPath(ctx.remote, 'relay');
  const sawSrflx = hasPath(ctx.local, 'srflx') || hasPath(ctx.remote, 'srflx');
  if (ctx.hasTurn && sawRelay) {
    return (
      'ICE не собрался даже через TURN. ' +
      'Проверьте URL, логин и пароль своего релей-сервера.'
    );
  }
  if (ctx.hasTurn && !sawRelay) {
    if (ctx.gathering && ctx.gathering !== 'complete') {
      return (
        'ICE оборвался, пока TURN ещё собирал relay. ' +
        'Попробуйте ещё раз — кандидаты теперь досылаются по сокету, не только в SDP.'
      );
    }
    return (
      'ICE не собрался. TURN задан, но relay-кандидат не появился — ' +
      'сервер недоступен, порты закрыты или логин/пароль неверны.'
    );
  }
  if (!ctx.hasStun && !ctx.hasTurn) {
    return (
      'Нет STUN и TURN. Видны только локальные адреса — ' +
      'в разных сетях этого мало. Нужен свой TURN.'
    );
  }
  if (sawSrflx) {
    return (
      'Прямой путь закрыт NAT. STUN нашёл внешний адрес, ' +
      'но соединение не прошло. Нужен свой TURN.'
    );
  }
  return (
    'Прямой путь закрыт NAT. Свой TURN не задан — ' +
    'без него через интернет часто не соединиться.'
  );
};
