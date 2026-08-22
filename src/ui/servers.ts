import { SERVER_PRESETS } from '../config/index.ts';
import { listIceUrls } from '../config/ice-urls.ts';
import { isTurnUrl } from '../config/merge.ts';
import type {
  CustomServerDraft,
  IceServerConfig,
  ResolveResult,
  SignalingKind,
  UserSettings,
} from '../config/types.ts';

export type ServersHandlers = {
  onPreset: (presetId: string) => void;
  onSaveCustom: (custom: CustomServerDraft) => void;
};

const KIND_OPTIONS: { id: SignalingKind; title: string }[] = [
  { id: 'manual', title: 'Вручную (QR / текст)' },
  { id: 'http-poll', title: 'HTTP poll' },
  { id: 'websocket', title: 'WebSocket' },
];

const splitIce = (servers: IceServerConfig[]) => {
  const stun: string[] = [];
  let turnUrl = '';
  let username = '';
  let credential = '';
  for (const server of servers) {
    const urls = listIceUrls(server.urls);
    for (const url of urls) {
      if (isTurnUrl(url)) {
        turnUrl = url;
        username = server.username ?? '';
        credential = server.credential ?? '';
        continue;
      }
      stun.push(url);
    }
  }
  return { stun, turnUrl, username, credential };
};

const readCustomDraft = (form: HTMLFormElement): CustomServerDraft => {
  const kind = form.elements.namedItem('kind') as HTMLSelectElement;
  const url = form.elements.namedItem('signalingUrl') as HTMLInputElement;
  const stun = form.elements.namedItem('stun') as HTMLTextAreaElement;
  const turnUrl = form.elements.namedItem('turnUrl') as HTMLInputElement;
  const username = form.elements.namedItem('turnUser') as HTMLInputElement;
  const credential = form.elements.namedItem('turnPass') as HTMLInputElement;
  const iceServers: IceServerConfig[] = [];
  const stunLines = stun.value.split('\n');
  for (const line of stunLines) {
    const value = line.trim();
    if (value) iceServers.push({ urls: value });
  }
  const relay = turnUrl.value.trim();
  if (relay) {
    iceServers.push({
      urls: relay,
      username: username.value.trim(),
      credential: credential.value,
    });
  }
  const signaling = { kind: kind.value as SignalingKind };
  if (signaling.kind !== 'manual') {
    return { signaling: { ...signaling, url: url.value.trim() }, iceServers };
  }
  return { signaling, iceServers };
};

const fillCustomForm = (form: HTMLFormElement, draft: CustomServerDraft) => {
  const kind = form.elements.namedItem('kind') as HTMLSelectElement;
  const url = form.elements.namedItem('signalingUrl') as HTMLInputElement;
  const stun = form.elements.namedItem('stun') as HTMLTextAreaElement;
  const turnUrl = form.elements.namedItem('turnUrl') as HTMLInputElement;
  const username = form.elements.namedItem('turnUser') as HTMLInputElement;
  const credential = form.elements.namedItem('turnPass') as HTMLInputElement;
  const ice = splitIce(draft.iceServers);
  kind.value = draft.signaling.kind;
  url.value = draft.signaling.url ?? '';
  stun.value = ice.stun.join('\n');
  turnUrl.value = ice.turnUrl;
  username.value = ice.username;
  credential.value = ice.credential;
};

const previewText = (result: ResolveResult): string => {
  if (!result.ok) return result.message;
  return JSON.stringify(result.value, null, 2);
};

export const mountServers = (root: HTMLElement, handlers: ServersHandlers) => {
  const list = document.createElement('fieldset');
  list.className = 'panel';
  const legend = document.createElement('legend');
  legend.textContent = 'Пресет';
  list.append(legend);

  for (const preset of SERVER_PRESETS) {
    const row = document.createElement('label');
    row.className = 'choice';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'preset';
    input.value = preset.id;
    input.addEventListener('change', () => {
      if (input.checked) handlers.onPreset(preset.id);
    });
    const text = document.createElement('span');
    text.textContent = preset.title;
    row.append(input, text);
    list.append(row);
  }

  const form = document.createElement('form');
  form.className = 'panel custom';
  form.innerHTML = `
    <fieldset>
      <legend>Свой сервер</legend>
      <label class="field">
        <span>Signaling</span>
        <select name="kind"></select>
      </label>
      <label class="field">
        <span>Signaling URL</span>
        <input name="signalingUrl" type="url" autocomplete="off" />
      </label>
      <label class="field">
        <span>STUN, по одному URL в строке</span>
        <textarea name="stun" rows="3"></textarea>
      </label>
      <p class="tagline">
        Чужой открытый TURN не подставляем. Если устройства в разных
        сетях и ICE падает — укажите свой релей (docs/turn.md).
      </p>
      <label class="field">
        <span>TURN URL</span>
        <input
          name="turnUrl"
          type="text"
          autocomplete="off"
          placeholder="turn:example.com:3478"
        />
      </label>
      <label class="field">
        <span>TURN логин</span>
        <input name="turnUser" type="text" autocomplete="off" />
      </label>
      <label class="field">
        <span>TURN пароль</span>
        <input name="turnPass" type="password" autocomplete="off" />
      </label>
      <button class="button" type="submit">Сохранить свой сервер</button>
    </fieldset>
  `;
  const kindSelect = form.elements.namedItem('kind') as HTMLSelectElement;
  for (const option of KIND_OPTIONS) {
    const node = document.createElement('option');
    node.value = option.id;
    node.textContent = option.title;
    kindSelect.append(node);
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.onSaveCustom(readCustomDraft(form));
  });

  const preview = document.createElement('pre');
  preview.className = 'resolved';
  preview.dataset.role = 'resolved';

  const hint = document.createElement('p');
  hint.className = 'tagline';
  hint.dataset.role = 'turn-hint';

  const error = document.createElement('p');
  error.className = 'error';
  error.hidden = true;
  error.dataset.role = 'error';

  root.append(list, hint, form, error, preview);

  return {
    sync(settings: UserSettings, result: ResolveResult) {
      const radios =
        list.querySelectorAll<HTMLInputElement>('input[name=preset]');
      for (const radio of radios) {
        radio.checked = radio.value === settings.presetId;
      }
      form.hidden = settings.presetId !== 'custom';
      const active = document.activeElement;
      const editing = Boolean(active && form.contains(active));
      if (settings.presetId === 'custom' && !editing) {
        fillCustomForm(form, settings.custom);
      }
      preview.textContent = previewText(result);
      if (result.ok && result.value.hasTurn) {
        hint.textContent =
          'TURN задан. Если увидите «сейчас путь = relay» — трафик идёт через ваш релей.';
      } else if (result.ok) {
        hint.textContent =
          'TURN не задан. В одной Wi‑Fi часто хватает host/STUN; через интернет при жёстком NAT нужен свой TURN.';
      } else {
        hint.textContent = '';
      }
      if (result.ok) {
        error.hidden = true;
        error.textContent = '';
        return;
      }
      error.hidden = false;
      error.textContent = result.message;
    },
  };
};
