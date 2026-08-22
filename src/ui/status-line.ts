export type StatusLineInput = {
  online: boolean;
  session: string;
  ice: string;
  pongMs: number | null;
};

export const formatStatusLine = (input: StatusLineInput): string => {
  const session =
    input.session === 'idle'
      ? 'нет пары'
      : input.session === 'signaling'
        ? 'ждём пару'
        : input.session === 'connecting'
          ? 'сходимся'
          : input.session === 'connected'
            ? 'связь'
            : input.session === 'failed'
              ? 'ошибка'
              : input.session;
  const parts = [input.online ? 'сеть' : 'нет сети', session];
  if (input.ice.includes('путь = relay')) parts.push('интернет');
  else if (/путь = host/.test(input.ice)) parts.push('локально');
  else {
    const path = /путь = ([^·]+)/.exec(input.ice);
    if (path?.[1]) parts.push(path[1].trim());
  }
  if (input.pongMs !== null) parts.push(`${input.pongMs} мс`);
  return parts.join(' · ');
};
