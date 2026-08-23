import { domainCopy } from '@/content/index.ts';
import type { IceServerConfig } from '@/config/types.ts';
import { sortIceUrls } from '@/config/ice-urls.ts';

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

const PREFERRED_TURN_PORTS = [443, 80, 3478];

export const orderTurnPorts = (ports: number[]): number[] => {
  const preferred = PREFERRED_TURN_PORTS.filter((port) => ports.includes(port));
  const rest = ports.filter((port) => !PREFERRED_TURN_PORTS.includes(port));
  return [...preferred, ...rest];
};

export const stunUrlsForHost = (
  host: string,
  ports: number[],
): string | string[] => {
  const urls = orderTurnPorts(ports).map((port) => `stun:${host}:${port}`);
  if (urls.length <= 1) return urls[0] ?? `stun:${host}:3478`;
  return urls;
};

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
  if (!host) return fail('host-required', domainCopy.hostRequired);
  if (!isIpv4(host) && !isHostName(host)) {
    return fail('host-invalid', domainCopy.hostInvalid);
  }
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(sshUser)) {
    return fail('user-invalid', domainCopy.sshUserInvalid);
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
    return [domainCopy.hostCommandsFill, `# ${checked.message}`, ''].join('\n');
  }
  return [
    domainCopy.hostCommandsSsh,
    sshCommand(checked.value),
    '',
    domainCopy.hostCommandsInstall,
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
  const ordered = orderTurnPorts(ports);
  const urls: string[] = [];
  for (const port of ordered) {
    urls.push(`turn:${host}:${port}`);
    urls.push(`turn:${host}:${port}?transport=tcp`);
  }
  return [
    { urls: stunUrlsForHost(host, ports) },
    { urls: sortIceUrls(urls), username, credential },
  ];
};
