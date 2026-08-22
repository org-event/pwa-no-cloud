import {
  EMPTY_TURN_HOST,
  generateHostCommands,
  validateTurnHost,
  type TurnHostDraft,
} from '../domain/turn-host.ts';

export type HostHandlers = {
  onSaveHost: (draft: TurnHostDraft) => void;
  onCopyHostScript: (script: string) => void;
  onApplySharePack: (text: string) => void;
  onScanSharePack: (file: File) => void;
};

const readDraft = (form: HTMLFormElement): TurnHostDraft => {
  const host = form.elements.namedItem('host') as HTMLInputElement;
  const sshUser = form.elements.namedItem('sshUser') as HTMLInputElement;
  return {
    host: host.value,
    sshUser: sshUser.value,
  };
};

export const mountHost = (root: HTMLElement, handlers: HostHandlers) => {
  const form = document.createElement('form');
  form.className = 'panel custom';
  form.innerHTML = `
    <fieldset>
      <legend>Мой сервер</legend>
      <p class="tagline">
        1) ssh на VPS. 2) curl установщика. Скрипт спросит пароль,
        порты (80/443) и сокет с HTTPS. Имя sslip.io, Let’s Encrypt
        ~90 дней, email один раз — дальше cron. В конце — QR S1.
      </p>
      <label class="field">
        <span>SSH-логин</span>
        <input
          name="sshUser"
          type="text"
          autocomplete="username"
          placeholder="root"
        />
      </label>
      <label class="field">
        <span>IP или DNS</span>
        <input
          name="host"
          type="text"
          autocomplete="off"
          inputmode="url"
          placeholder="203.0.113.10"
        />
      </label>
      <div class="home-actions">
        <button class="button" type="submit">Сохранить адрес</button>
        <button class="button button-secondary" type="button" data-role="copy">
          Скопировать команды
        </button>
      </div>
      <label class="field">
        <span>Пакет S1. с консоли или QR</span>
        <textarea
          name="sharePack"
          rows="4"
          autocomplete="off"
          placeholder="S1.{...}"
        ></textarea>
      </label>
      <div class="home-actions">
        <button class="button" type="button" data-role="pack">
          Сохранить пакет
        </button>
        <button class="button button-secondary" type="button" data-role="scan">
          Считать QR
        </button>
      </div>
    </fieldset>
  `;

  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/*';
  file.setAttribute('capture', 'environment');
  file.className = 'file-input';
  file.setAttribute('aria-hidden', 'true');
  file.tabIndex = -1;
  file.addEventListener('change', () => {
    const picked = file.files?.[0];
    file.value = '';
    if (picked) handlers.onScanSharePack(picked);
  });

  const script = document.createElement('pre');
  script.className = 'resolved';
  script.dataset.role = 'script';
  script.setAttribute('aria-label', 'Команды для консоли');

  const hint = document.createElement('p');
  hint.className = 'tagline';
  hint.dataset.role = 'host-hint';
  hint.setAttribute('aria-live', 'polite');

  const error = document.createElement('p');
  error.className = 'error';
  error.hidden = true;
  error.dataset.role = 'error';
  error.setAttribute('role', 'alert');

  const refresh = () => {
    script.textContent = generateHostCommands(readDraft(form));
  };

  form.addEventListener('input', refresh);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const draft = readDraft(form);
    const checked = validateTurnHost(draft);
    if (!checked.ok) {
      error.hidden = false;
      error.textContent = checked.message;
      hint.textContent = '';
      return;
    }
    error.hidden = true;
    error.textContent = '';
    handlers.onSaveHost(checked.value);
  });

  const copy = form.querySelector('[data-role=copy]') as HTMLButtonElement;
  copy.addEventListener('click', () => {
    handlers.onCopyHostScript(generateHostCommands(readDraft(form)));
  });

  const pack = form.querySelector('[data-role=pack]') as HTMLButtonElement;
  pack.addEventListener('click', () => {
    const box = form.elements.namedItem('sharePack') as HTMLTextAreaElement;
    handlers.onApplySharePack(box.value);
  });

  const scan = form.querySelector('[data-role=scan]') as HTMLButtonElement;
  scan.addEventListener('click', () => file.click());

  root.append(form, file, hint, error, script);

  return {
    node: root,
    sync(draft: TurnHostDraft, notice = '') {
      const host = form.elements.namedItem('host') as HTMLInputElement;
      const sshUser = form.elements.namedItem('sshUser') as HTMLInputElement;
      const active = document.activeElement;
      const editing = Boolean(active && form.contains(active));
      if (!editing) {
        host.value = draft.host;
        sshUser.value = draft.sshUser || EMPTY_TURN_HOST.sshUser;
      }
      refresh();
      hint.textContent = notice;
    },
  };
};
