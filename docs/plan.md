# NoCloud — план развития

Рабочее имя репозитория: `pwa-no-cloud`.
Продукт: устанавливаемое PWA для обмена файлами и папками между браузерами/телефонами без облака и без файлового трафика через наш сервер.

Этот документ — единственный источник порядка работ.
Шаги выполняем строго по номеру. Следующий шаг не начинаем, пока у текущего нет критериев готовности.

---

## 1. Зачем это делаем

Нужен обмен файлами «с телефона на телефон» или «ноутбук ↔ телефон»:

- без аккаунта и без облака;
- без обязательного интернета, если устройства рядом;
- с возможностью соединиться через интернет, когда рядом быть нельзя;
- с выбором своих STUN / TURN / signaling серверов или готовых пресетов.

Файлы, папки и стриминг после знакомства идут **напрямую** между клиентами.
Сервер не читает и не хранит содержимое передач.

---

## 2. Честная модель «без интернета»

WebRTC сам не умеет найти «Васю с Pixel». Ему нужно описание сессии (SDP) и ICE-кандидаты второго участника. Это и есть signaling.

Полностью без любого сервера через публичный интернет — обычно нельзя.
Полностью без сервера рядом — можно, если люди сами передадут приглашение.

### Три режима знакомства

| режим | интернет | сервер | как находят друг друга | когда работает |
|---|---|---|---|---|
| **A. Ручной signaling** | не нужен | не нужен | QR, copy/paste, мессенджер, позже NFC | всегда, если ICE нашёл путь (часто одна Wi‑Fi) |
| **B. Локальная сеть** | не нужен | локальный (одна из сторон или роутер) | комната + HTTP/WS на LAN | оба в одном Wi‑Fi |
| **C. Через интернет** | нужен на этапе знакомства | signaling, желательно свой | комната / ссылка / код | разные сети; при CGNAT ещё нужен TURN |

После знакомства файловый трафик:

1. **P2P напрямую** — host/srflx кандидаты, STUN помог узнать внешний адрес.
2. **Через TURN** — если NAT симметричный, CGNAT, разные мобильные операторы. Релей видит байты, поэтому TURN только свой или явно выбранный пользователем.
3. **Не соединилось** — честно показать, какой путь пробовали и чего не хватает (нет STUN, нет TURN, нет ответа на offer).

Google даёт публичный STUN. Публичного TURN у Google нет. В пресетах STUN Google допустим, TURN — только пользовательский/свой.

### Что PWA не умеет из нативного Android

Nearby Connections, Wi‑Fi Direct, NSD/mDNS как системный discovery, Bluetooth-сокеты — это не браузерный API. В v1 не обещаем «нашёл соседние телефоны сам».
Для PWA реалистичны: ручной QR, локальный signaling в LAN, установленное офлайн-приложение (Service Worker + OPFS).

---

## 3. Технологии и роли

| технология | роль в продукте |
|---|---|
| **WebRTC** | P2P-сессия браузер ↔ браузер |
| **RTCDataChannel** | канал файлов и служебных сообщений |
| **ICE** | перебор путей: host → srflx (STUN) → relay (TURN) |
| **STUN** | узнать свой внешний IP/порт, помочь «пробить» NAT |
| **TURN** | релей, если прямой путь не взлетел |
| **Signaling** | обмен offer / answer / ICE candidate до P2P |
| **OPFS** | приватное файловое дерево origin: inbox, outbox, недокачанные чанки, логи |
| **Service Worker** | кэш оболочки, работа без сети после установки |
| **Web Streams** | чтение файла чанками без загрузки всего в RAM |

Стек разработки — **Vite+** (`vp`): Vite, Rolldown, Vitest, Oxlint, Oxfmt, tsgo, Vite Task.
Один `vite.config.ts` на всё. Повседневные команды: `vp install`, `vp dev`, `vp check`, `vp test`, `vp build`, `vp preview`.

Стиль кода — Metarhia/HowProgrammingWorks: короткие функции, явные контракты, слои не смешивать, ошибки возвращать, исключения — только поломка инварианта.
Форматтер и линтер — встроенные в Vite+ (`vp check`), не отдельный Prettier/ESLint стек.

---

## 4. Что берём из HowMeta

Копируем подход, не файлы.

### Слои (Metarhia Docs + AbstractionLayers)

Как в impress/`Example`: тонкий вход, домен отдельно, утилиты отдельно, конфиг — JS-объекты.

| слой | папка | можно | нельзя |
|---|---|---|---|
| конфиг | `src/config/` | пресеты серверов, лимиты чанков, имена каналов | DOM, WebRTC |
| домен | `src/domain/` | сессия, пир, передача, дерево папки, статусы | `document`, `RTCPeerConnection` |
| библиотеки | `src/lib/` | адаптеры signaling, WebRTC-обёртка, OPFS, чанки, QR | правила «что отправлять» |
| UI | `src/ui/` | экраны, жесты, доступность | SDP, чанки, ICE |
| workers | `src/workers/` | кэш PWA, фоновая запись в OPFS | разметка |
| signaling-сервер | `server/` | комнаты, inbox сигналов, опционально свой STUN | файлы пользователей |

UI вызывает домен. Домен вызывает `lib` через контракты. Сервер не знает про OPFS и UI.

Ошибки: штатный отказ — `return` объекта ошибки (`{ ok: false, code, message }`).
`throw` — только поломка инварианта. Сообщения пользователю без stack trace.

### Каркас приложения (HowProgrammingWorks/Application + PWA)

- `EventEmitter` + `Application` как точка сборки.
- Состояние в `Map`/явных объектах, не размазано по DOM.
- Service Worker режется на модули: кэш статики / сообщения клиента. Как `worker.js` + `worker.static.js` в HPW/PWA.
- `domain` и `ui` — разные файлы. HPW/PWA прямо пишет это в TODO — у нас так с первого дня.

### WebRTC-образец (HowProgrammingWorks/WebRTC)

Оттуда берём разделение ролей, не опрос как единственный транспорт навсегда:

- `clientId`, комната, offer/answer/candidate.
- `RTCPeerConnection` + `RTCDataChannel`.
- ICE-логи в понятном виде (`host` / `srflx` / `relay`).
- Signaling — очередь сообщений `from → to`, не файлы.
- Свой простой STUN на UDP — как опция локального пресета.

Первый автоматический signaling — HTTP poll как в том примере (просто проверить контракт).
Следом — WebSocket. Контракт адаптера один и тот же.

### OPFS (HowProgrammingWorks/OPFS)

Обёртка над `navigator.storage.getDirectory()`:

- дерево `inbox/`, `outbox/`, `transfers/`, `logs/`;
- запись через `createWritable`, чтение через `getFile()` + streams;
- листинг `entries()`, удаление `removeEntry`;
- логгер может писать и в UI, и в файл OPFS.

### Конфиг (HowProgrammingWorks/Configuration + metaconfiguration)

Пресеты и пользовательские сервера — обычные JS-объекты с фиксированной формой.
Пользовательские значения живут в `localStorage` / OPFS, пресеты — в репозитории.
Слияние: `defaults ← preset ← userOverride`.

### Паттерны

- **Strategy** — способ signaling: `manual` | `http-poll` | `websocket`.
- **Adapter** — каждый способ приводит к одному контракту `SignalingPort`.
- **State** — автомат сессии WebRTC и автомат передачи файла.
- **Facade** — `Session` прячет `RTCPeerConnection` от UI.
- **Queue** — исходящие чанки с backpressure (`bufferedAmount`).

---

## 5. Целевая структура репозитория

Появится на шаге 0. Сейчас только план.

```
pwa-no-cloud/
  docs/                      ← мы здесь
  design-system/nocloud/     ← токены UI
  src/
    config/
      defaults.ts
      servers.ts             ← заготовленные STUN/TURN/signaling
      types.ts
    domain/
      session.ts
      transfer.ts
      folder.ts
      peer.ts
    lib/
      events.ts
      webrtc.ts
      ice.ts
      signaling/
        port.ts
        manual.ts
        http-poll.ts
        websocket.ts
      opfs.ts
      chunk.ts
      qr.ts
    ui/
      app.ts
      screens/
    workers/
      sw.ts
    main.ts
  server/                    ← опциональный локальный signaling + STUN
  public/
    manifest.webmanifest
    icons/
  vite.config.ts
  package.json
```

Язык ядра — TypeScript. UI первого прохода — vanilla + CSS-токены.
Фреймворк (Vue и т.п.) не тащим, пока домен и передача не стабильны.
Тесты — рядом с модулем или в `src/**/*.test.ts`, гоняет `vp test`.

---

## 6. Конфиг серверов

Пользователь либо выбирает пресет, либо вводит свои URL.

### Форма записи

```ts
type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

type SignalingConfig = {
  kind: 'manual' | 'http-poll' | 'websocket';
  url?: string; // нет у manual
};

type ServerPreset = {
  id: string;
  title: string;
  signaling: SignalingConfig;
  iceServers: IceServerConfig[];
};
```

### Пресеты в репозитории (`src/config/servers.ts`)

Черновик набора. URL поправить на шаге 1, когда зафиксируем порты.

1. **`manual-only`** — signaling руками, ICE: host + публичный STUN Google.
2. **`local-dev`** — signaling `http://127.0.0.1:8000`, STUN `stun:127.0.0.1:3478` (как HPW/WebRTC).
3. **`lan`** — тот же протокол, URL подставляется из текущего origin (телефон открыл PWA с ноутбука в LAN).
4. **`google-stun`** — signaling manual или свой WS, ICE: `stun:stun.l.google.com:19302` и запасной `stun:stun1.l.google.com:19302`.
5. **`custom`** — пустой шаблон: поля signaling URL, список STUN, список TURN.

TURN в пресетах не хардкодим с чужими секретами.
Если появится свой coturn — отдельный пресет с `urls`, `username`, `credential` из env при сборке **или** из пользовательского ввода в runtime. Секреты TURN не коммитить.

### UI настроек

- список пресетов;
- «свой сервер»: signaling URL, тип (`http-poll` / `websocket`), STUN URL[], TURN URL + user + credential;
- проверка: ICE gathering до `complete` и показ найденных типов кандидатов;
- сохранение пользовательского набора локально, пресеты не затираются.

---

## 7. Контракты ядра

Пишем типы до реализации. Это закон модулей.

### SignalingPort

```ts
type SignalMessage = {
  from: string;
  to: string;
  data: { type: 'offer' | 'answer' | 'candidate'; payload: unknown };
};

type SignalingPort = {
  connect(input: { roomId: string; clientId: string }): Promise<void>;
  send(message: SignalMessage): Promise<void>;
  subscribe(handler: (message: SignalMessage) => void): () => void;
  listPeers?(): Promise<string[]>;
  close(): void;
};
```

`manual` реализует тот же порт: `send` кладёт текст/QR, `subscribe` срабатывает после вставки ответа.

### Session (WebRTC facade)

Состояния: `idle → signaling → connecting → connected → failed | closed`.
События: `state`, `ice`, `channel-open`, `error`.
Не отдаёт UI сырой `RTCPeerConnection`.

Два канала:

- `control` — JSON: манифест файла, дерево папки, pause/resume/cancel, ack;
- `bytes` — бинарные чанки (`ArrayBuffer`), `ordered: true` для простоты v1.

Имена каналов — в конфиге, не магические строки по коду.

### Transfer

Состояния файла: `queued → offering → sending | receiving → writing → done | paused | failed | canceled`.
Протокол control (черновик):

- `file-offer { transferId, name, size, mime, chunkSize, hash? }`
- `file-accept { transferId }` / `file-reject { transferId, reason }`
- `file-chunk-meta { transferId, index, size }` + байты в `bytes`
- `file-ack { transferId, index }`
- `file-done { transferId, hash? }`
- `file-error { transferId, code }`
- `folder-offer { folderId, entries: [{ path, size }] }`

Размер чанка — из конфига (старт: 64 KiB). Backpressure: не слать, пока `bufferedAmount` выше порога.
Большие файлы не читаем целиком в память: `blob.stream()` / OPFS stream.

### OPFS layout

```
/inbox/<transferId>/<filename>
/outbox/<transferId>/...          # снимок исходящего, если нужен resume
/transfers/<transferId>.json      # курсор чанка, манифест
/logs/app.log
```

Пока передача не закончена — пишем во временный файл, затем переименовываем/переносим в inbox.
Пользователь забирает файл через File System Access (`showSaveFilePicker`) там, где есть, иначе — download из Blob, прочитанного из OPFS.

---

## 8. UI и UX

Токены: `design-system/nocloud/MASTER.md`.
Стиль: flat, тёмная база `#0F172A`, акцент папок `#2563EB`, акцент файлов `#D97706`.
Шрифт: Inter. Иконки: Lucide SVG, не эмодзи.
Движение короткое (150–200ms), без теней и 3D. Учитывать `prefers-reduced-motion`.

Экраны v1:

1. **Дом** — «Создать комнату / приглашение» и «Присоединиться».
2. **Сессия** — статус ICE/канала, список пиров, выбор файлов/папки, прогресс.
3. **Входящие** — inbox OPFS, сохранить / удалить.
4. **Серверы** — пресеты и свой ввод.
5. **Диагностика** — кандидаты ICE, выбранный путь (`host`/`srflx`/`relay`), причина fail.

Мобильный first: цели нажатия ≥ 44px, safe-area, одна основная кнопка на экран.
Состояния сети и соединения показывать текстом, не только цветом.

PWA: `manifest`, иконки, `display: standalone`, install prompt как в HPW/PWA (`beforeinstallprompt`).
После установки оболочка открывается без сети. Передача без signaling-сервера возможна только в режиме A или если оба уже в LAN и знают адрес.

---

## 9. Безопасность и границы

- Файлы не уходят на signaling.
- Signaling видит только SDP и candidates (в них бывают IP — предупредить в UI).
- TURN видит весь трафик — не использовать чужой TURN «по умолчанию».
- Комната — короткий код, не секрет. Для интернета позже: одноразовый токен приглашения.
- Не принимать файл без явного `file-accept` в UI.
- Лимит размера в v1 — конфиг (например 2 GiB на файл), выше — отказ с понятной ошибкой.
- Path traversal в именах папок: нормализовать `path`, запретить `..`.
- Статический сервер (если будет) — проверка корня как в HPW/WebRTC `prepareFile`.

---

## 10. Дорожная карта по шагам

Каждый шаг: цель → работы → критерий готовности → тесты.
Остановка после шага — валидное состояние репозитория.

### Шаг 0. Каркас Vite+

**Цель.** Пустой, но «правильный» проект: `vp` ведёт всё.

Работы:

- `vp create` (vanilla + TypeScript) в этом каталоге или рядом с переносом файлов.
- Один `vite.config.ts`: `dev`, `build`, `test`, `lint`, `fmt`, `staged`.
- `vp config` для git hooks, если уже есть git.
- Базовые папки `src/config`, `src/domain`, `src/lib`, `src/ui`, `src/workers`.
- README с командами `vp`.
- `.gitignore` стандартный.

Готово когда: `vp check` и `vp build` проходят на пустом приложении «Hello NoCloud».

### Шаг 1. Конфиг и пресеты серверов

**Цель.** Можно выбрать пресет или ввести свой сервер без WebRTC.

Работы:

- типы из раздела 6;
- `src/config/servers.ts` с пресетами;
- загрузка/сохранение пользовательского оверлея;
- слияние `defaults ← preset ← user`;
- экран «Серверы» (даже простой form).

Готово когда: смена пресета меняет объект, который потом получит `Session`. Тест на merge и на отказ пустого TURN-секрета в репозитории.

### Шаг 2. Оболочка PWA

**Цель.** Приложение ставится и открывается офлайн.

Работы:

- `manifest.webmanifest`, иконки, тема из MASTER.md;
- Service Worker: precache оболочки (Vite PWA plugin или ручной SW как HPW);
- `Application` + `EventEmitter`;
- онлайн/офлайн индикатор;
- install prompt;
- тёмная вёрстка домашнего экрана.

Готово когда: `vp build` + `vp preview` (HTTPS/localhost), Add to Home Screen, при выключенной сети оболочка открывается. Передача ещё не нужна.

### Шаг 3. OPFS-обёртка

**Цель.** Локальное хранилище готово до сети.

Работы:

- `lib/opfs.ts`: init дерева, write/read/list/remove, лог в `/logs`;
- экран «Входящие» на фикстурах (записать тестовый файл из UI);
- тесты с моком `FileSystemDirectoryHandle` где возможно.

Готово когда: создать / прочитать / удалить файл в OPFS через UI. Как демо HPW/OPFS, но с контрактом, а не кнопками в одном файле.

### Шаг 4. Контракт signaling + manual режим

**Цель.** Два клиента обмениваются offer/answer руками. Это главный офлайн-путь.

Работы:

- `SignalingPort`;
- `manual.ts`: экспорт текста/JSON приглашения, импорт ответа;
- QR encode/decode (текст SDP может быть длинным — сжатие/chunk QR или «скопировать» как запас);
- UI: «Показать приглашение» / «Вставить ответ»;
- пока без файлов: только установка DataChannel и ping/pong.

Готово когда: два браузера на одной машине (два окна) соединяются через copy/paste, канал `open`, пинг проходит. Интернета и своего сервера нет (кроме, возможно, публичного STUN — и отдельная проверка с `iceServers: []` в одной LAN).

### Шаг 5. Facades WebRTC и ICE

**Цель.** Домен не знает про DOM-кнопки, UI не знает про SDP.

Работы:

- `lib/webrtc.ts`, `lib/ice.ts`, `domain/session.ts`;
- автомат состояний сессии;
- логирование типов кандидатов;
- диагностика: выбранный pair, `connectionState`;
- подстановка `iceServers` из конфига шага 1.

Готово когда: тесты автомата сессии (без браузера — fake port). В браузере диагностика показывает `host`/`srflx`/`relay`.

### Шаг 6. Локальный signaling-сервер (режим B)

**Цель.** Знакомство в LAN без ручного текста.

Работы:

- `server/` по мотивам HPW/WebRTC: `/join`, `/signal`, `/peers`, статика из `vp build`;
- адаптер `http-poll`;
- затем адаптер `websocket` с тем же контрактом;
- опционально свой STUN UDP `:3478` как в образце;
- пресеты `local-dev` и `lan`.

Готово когда: два устройства в одном Wi‑Fi: одно раздаёт `server/`, второе открывает `http://<lan-ip>:8000`, оба в одной комнате, канал открывается без QR.

Не тащить impress/metacom в v1. Это отдельный Node-сервер, тонкий, как учебный пример.

### Шаг 7. Протокол файла по DataChannel

**Цель.** Один файл уходит и появляется в OPFS получателя.

Работы:

- `lib/chunk.ts` + backpressure;
- `domain/transfer.ts` + сообщения control;
- чтение через streams, запись в OPFS;
- прогресс, отмена, отказ принять;
- лимит размера из конфига.

Готово когда: файл 1–20 МБ передаётся между двумя окнами, имя и размер совпадают, файл открывается из inbox. Тесты: нарезка чанков, ack, отмена посередине.

### Шаг 8. Папки

**Цель.** Дерево относительных путей.

Работы:

- обход `FileSystemDirectoryHandle` / input `webkitdirectory`;
- `folder-offer` + очередь файлов;
- нормализация путей;
- прогресс «3/40 файлов».

Готово когда: папка с вложенностями восстанавливается в OPFS inbox как дерево.

### Шаг 9. TURN, пресеты интернета, диагностика fail

**Цель.** Режим C честный.

Работы:

- поле TURN в custom-пресете;
- UI: «сейчас путь = relay» если ушли в TURN;
- если ICE failed и TURN не задан — текст: прямой путь закрыт NAT, нужен свой TURN;
- не подключать чужой открытый TURN по умолчанию.

Готово когда: с выключенным STUN/TURN в разных сетях видим понятный fail; с своим TURN (если есть) — передача идёт. Если своего TURN ещё нет — документируем, как поднять coturn, пресет оставляем пустым.

### Шаг 10. Resume, большие файлы, устойчивость

**Цель.** Обрыв не убивает гигабайтный файл.

Работы:

- курсор в `/transfers/<id>.json`;
- повтор с `file-offer` + `startIndex`;
- пауза/продолжить;
- проверка свободного места (`navigator.storage.estimate`);
- Persistent Storage (`storage.persist()`).

Готово когда: оборвать канал на середине, соединиться снова, докачать, файл целый.

### Шаг 11. Полировка продукта

**Цель.** Можно пользоваться каждый день.

Работы:

- уведомление «файл получен» (как HPW/PWA notify);
- share target / «открыть в NoCloud», если браузер даёт;
- a11y: фокус, подписи, не только цвет;
- light theme токены из MASTER;
- `vp check` + набор тестов зелёные;
- короткий user-guide в `docs/usage.md` (только на этом шаге).

Готово когда: сценарии A и B проходят на двух телефонах; сценарий C — если задан TURN или мягкий NAT.

---

## 11. Что сознательно не делаем в v1

- Облачные аккаунты, Firebase, PeerJS cloud как зависимость ядра.
- Nearby Connections / Wi‑Fi Direct / системный Bluetooth discovery.
- Видео/аудио звонки (DataChannel only).
- Шифрование поверх DTLS «свой протокол» — DTLS WebRTC достаточно; e2e сверх этого — позже.
- Многопользовательская комната на N пиров (v1 = 1:1).
- Impress, metacom, PostgreSQL.
- Раздача чужого контента через наш TURN без явного согласия.

После v1 (не планировать в коде сейчас): mesh, WebTransport, сжатие QR, NFC, свой coturn в репо `server/turn`.

---

## 12. Порядок выполнения в чате

Когда скажем «делаем», идём так:

1. Шаг 0 — только каркас `vp`.
2. Останавливаемся, проверяем `vp check` / `vp build`.
3. Шаг 1 — конфиг.
4. Дальше по таблице шагов, по одному, с критерием готовности.

Не смешивать шаг передачи файла с каркасом.
Не добавлять Vue/React, пока не попросим.
Не писать exploit/PoC обхода NAT кроме штатного ICE/STUN/TURN API браузера.

---

## 13. Критерий успеха продукта

NoCloud можно поставить на два телефона.
В одной комнате / по QR они соединяются.
Файл и папка доходят в OPFS без облака.
Если интернета нет — работает ручной или LAN режим.
Если сети разные и NAT жёсткий — приложение говорит, что нужен TURN, а не «просто ошибка».
