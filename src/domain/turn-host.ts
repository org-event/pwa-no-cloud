import type { IceServerConfig } from '../config/types.ts';
import { sortIceUrls } from '../config/ice-urls.ts';

export type TurnHostDraft = {
  host: string;
  sshUser: string;
};

export type TurnHostError = {
  ok: false;
  code: string;
  message: string;
};

export type TurnHostResult<T> = { ok: true; value: T } | TurnHostError;

export const EMPTY_TURN_HOST: TurnHostDraft = {
  host: '',
  sshUser: 'root',
};

export const COTURN_IMAGE = 'coturn/coturn:4.6.2';

export const INSTALL_TURN_SCRIPT_URL =
  'https://raw.githubusercontent.com/org-event/pwa-no-cloud/main/deploy/install-turn.sh';

const fail = (code: string, message: string): TurnHostError => ({
  ok: false,
  code,
  message,
});

export const isIpv4 = (value: string): boolean => {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false;
    if (Number(part) > 255) return false;
  }
  return true;
};

export const isHostName = (value: string): boolean => {
  if (value.length > 253) return false;
  if (value.includes('://') || value.includes('/')) return false;
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/.test(
    value,
  );
};

export const validateTurnHost = (
  draft: TurnHostDraft,
): TurnHostResult<TurnHostDraft> => {
  const host = draft.host.trim();
  const sshUser = draft.sshUser.trim() || EMPTY_TURN_HOST.sshUser;
  if (!host) return fail('host-required', 'Укажите IP или DNS сервера');
  if (!isIpv4(host) && !isHostName(host)) {
    return fail(
      'host-invalid',
      'Хост должен быть IPv4 или DNS-именем, без URL',
    );
  }
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(sshUser)) {
    return fail(
      'user-invalid',
      'SSH-логин: латиница, цифры, точка, _ или -, до 32 символов',
    );
  }
  return { ok: true, value: { host, sshUser } };
};

export const sshCommand = (draft: TurnHostDraft): string =>
  `ssh ${draft.sshUser}@${draft.host}`;

export const installCommand = (): string =>
  `curl -fsSL ${INSTALL_TURN_SCRIPT_URL} | sudo bash`;

export const generateHostCommands = (draft: TurnHostDraft): string => {
  const checked = validateTurnHost(draft);
  if (!checked.ok) {
    return [
      '# Заполните SSH-логин и IP, затем скопируйте команды.',
      `# ${checked.message}`,
      '',
    ].join('\n');
  }
  return [
    '# 1. Войдите на VPS',
    sshCommand(checked.value),
    '',
    '# 2. На сервере: Docker если нет, порты, пароль — спросит скрипт',
    installCommand(),
    '',
  ].join('\n');
};

export const iceServersFromTurnHost = (
  host: string,
  username: string,
  credential: string,
  ports: number[],
): IceServerConfig[] => {
  const urls: string[] = [];
  const stunPort = ports.includes(3478) ? 3478 : (ports[0] ?? 3478);
  for (const port of ports) {
    urls.push(`turn:${host}:${port}`);
    urls.push(`turn:${host}:${port}?transport=tcp`);
  }
  return [
    { urls: `stun:${host}:${stunPort}` },
    { urls: sortIceUrls(urls), username, credential },
  ];
};
