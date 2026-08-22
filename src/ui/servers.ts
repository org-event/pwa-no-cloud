import { SERVER_PRESETS } from '../config/index.ts';
import {
  draftIceServersFromText,
  parseIceServersJson,
  splitIceServers,
} from '../config/ice-draft.ts';
import type {
  CustomServerDraft,
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

const readCustomDraft = (
  form: HTMLFormElement,
): CustomServerDraft | { error: string } => {
  const kind = form.elements.namedItem('kind') as HTMLSelectElement;
  const url = form.elements.namedItem('signalingUrl') as HTMLInputElement;
  const stun = form.elements.namedItem('stun') as HTMLTextAreaElement;
  const turnUrl = form.elements.namedItem('turnUrl') as HTMLTextAreaElement;
  const username = form.elements.namedItem('turnUser') as HTMLInputElement;
  const credential = form.elements.namedItem('turnPass') as HTMLInputElement;
  const iceJson = form.elements.namedItem('iceJson') as HTMLTextAreaElement;
  const parsed = parseIceServersJson(iceJson.value);
  if (!parsed.ok) return { error: parsed.message };
  const iceServers =
    parsed.value.length > 0
      ? parsed.value
      : draftIceServersFromText({
          stun: stun.value,
          turn: turnUrl.value,
          username: username.value,
          credential: credential.value,
        });
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
  const turnUrl = form.elements.namedItem('turnUrl') as HTMLTextAreaElement;
  const username = form.elements.namedItem('turnUser') as HTMLInputElement;
  const credential = form.elements.namedItem('turnPass') as HTMLInputElement;
  const iceJson = form.elements.namedItem('iceJson') as HTMLTextAreaElement;
  const ice = splitIceServers(draft.iceServers);
  kind.value = draft.signaling.kind;
  url.value = draft.signaling.url ?? '';
  stun.value = ice.stun.join('\n');
  turnUrl.value = ice.turn.join('\n');
  username.value = ice.username;
  credential.value = ice.credential;
  iceJson.value = '';
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
        <span>Адрес сокета</span>
        <input name="signalingUrl" type="url" autocomplete="off" placeholder="ws://203.0.113.10:8443/ws" />
      </label>
      <p class="tagline">
        Сокет — не файлы, а «комната»: два телефона стучатся сюда и находят друг друга.
        Берётся из пакета S1. после curl на VPS. Без адреса ссылка «открой и получи» не сойдётся.
      </p>
      <label class="field">
        <span>STUN, по одному URL в строке</span>
        <textarea name="stun" rows="3"></textarea>
      </label>
      <p class="tagline">
        Чужой открытый TURN в пресеты не кладём. Для теста через интернет
        можно вписать бесплатный Open Relay: см. docs/turn.md. На сотовой
        сети нужны несколько URL (UDP, TCP и turns на 443).
      </p>
      <label class="field">
        <span>TURN, по одному URL в строке</span>
        <textarea
          name="turnUrl"
          rows="4"
          autocomplete="off"
          placeholder="turn:example.com:3478"
        ></textarea>
      </label>
      <label class="field">
        <span>TURN логин</span>
        <input name="turnUser" type="text" autocomplete="off" />
      </label>
      <label class="field">
        <span>TURN пароль</span>
        <input name="turnPass" type="password" autocomplete="off" />
      </label>
      <label class="field">
        <span>или iceServers JSON</span>
        <textarea
          name="iceJson"
          rows="5"
          autocomplete="off"
          placeholder='[{"urls":"turn:...","username":"...","credential":"..."}]'
        ></textarea>
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
  error.setAttribute('role', 'alert');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const draft = readCustomDraft(form);
    if ('error' in draft) {
      error.hidden = false;
      error.textContent = draft.error;
      return;
    }
    handlers.onSaveCustom(draft);
  });

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
