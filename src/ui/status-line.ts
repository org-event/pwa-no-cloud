export type StatusLineInput = {
  online: boolean;
  session: string;
  ice: string;
  pongMs: number | null;
};

export const formatStatusLine = (input: StatusLineInput): string => {
  const parts = [input.online ? 'онлайн' : 'офлайн', input.session];
  const path = /путь = ([^·]+)/.exec(input.ice);
  if (path?.[1]) parts.push(path[1].trim());
  if (input.pongMs !== null) parts.push(`${input.pongMs} мс`);
  return parts.join(' · ');
};
