# Требования NoCloud

Статус: черновик для закрытия решений (2026-09-13).  
Источники: [vision.md](./vision.md), [roadmap-wide.md](./roadmap-wide.md), [sources/ideas-essence.md](./sources/ideas-essence.md), задел кода, подход OpenPolySphere (модули по ответственности, ADR, явная сборка).

**UI:** внешний вид ориентир — Telegram; локальные правки позже, не отдельный дизайн-sprint в MVP.

**Организация кода (как OPS):** модули = доменные области с чёткими границами; домен не знает UI; транспорт (WebRTC/signaling) — адаптеры; решения фиксируем в `docs/adr/`; задачи сборки — явный entry (сейчас `vp` / позже `just` по аналогии с OPS).

Легенда приоритета:

| метка | смысл |
|---|---|
| **M1** | must для первого движения (можно пользоваться 1:1) |
| **M2** | must следующего среза |
| **L** | later / не блокирует старт |
| **?** | приоритет ещё не закрыт — нужно решение |

Статус требования: `proposed` → `accepted` / `deferred` / `rejected`.

---

## 0. Доменные модули (границы ответственности)

| модуль | ответственность | не входит |
|---|---|---|
| **identity** | ключи, подпись/проверка, fingerprint ID | UI, сеть |
| **profile** | подписанный профиль (ник, аватар-мета), локальный alias | хранение медиа-байтов аватара как «истина сети» |
| **contacts** | адресная книга, trust, introduce/QR card | роутинг реле |
| **relay** | контракт узла: presence, signal, peer-list, capabilities | файлы пользователей, E2EE plaintext |
| **discovery** | пучок реле, bootstrap, редиректы, (L) DHT | медиа WebRTC |
| **session** | WebRTC facade: ICE, DataChannel, media tracks | правила «кому звонить» |
| **presence** | онлайн/доступен, лобби, стук | push-провайдер облака |
| **call** | голос/видео/экран: сигналы accept/reject/busy | запись звонка (пока L) |
| **transfer** | файлы/папки по DataChannel + OPFS | чат-текст |
| **chat** | E2EE сообщения, локальная история | (приоритет ?) |
| **sync** | sync своих устройств / бэкап | чужие контакты |
| **node** | десктоп/VPS: полноценный реле+STUN/TURN | логика UI PWA |
| **ui** | Telegram-подобный shell, экраны | крипто, SDP |
| **config** | пресеты серверов, лимиты, feature flags | доменные автоматы |

Зависимости (разрешённые стрелки вниз):

```
ui → call | transfer | chat | contacts | presence | config
call | transfer | chat → session → relay adapters
presence → relay
contacts → profile → identity
discovery → relay
node implements relay (+ stun/turn)
sync → identity + local store
```

Циклов между доменами быть не должно. Как в OPS: отдельные «crates»/пакеты по смыслу, даже если пока папки внутри `src/`.

---

## 1. Функциональные требования

### 1.1 Identity

| id | требование | pri | status |
|---|---|---|---|
| FR-ID-01 | Пользователь создаёт личность **офлайн** без запроса к серверу | M1 | proposed |
| FR-ID-02 | Глобальный ID = криптографический публичный ключ (или стабильный fingerprint от него) | M1 | accepted (Ed25519; алгоритм за портом) |
| FR-ID-03 | Приватный ключ не покидает устройство (кроме явного экспорта пользователем) | M1 | proposed |
| FR-ID-04 | Любой публичный профиль/invite/редирект **подписывается**; чужая подпись → отброс | M1 | proposed |
| FR-ID-07 | Master-фраза при регистрации шифрует локальный ключ и бэкап; биометрия — optional unlock | M1 | accepted |
| FR-ID-06 | Миграция со старых коротких `profile.id` / карточек `C1.` | L | rejected (hard cut; старое — разведка) |

### 1.2 Profile & contacts

| id | требование | pri | status |
|---|---|---|---|
| FR-PR-01 | Профиль: nick + аватар + `updatedAt`, подписан ключом | M1 | accepted (аватар data-URL, лимит) |
| FR-PR-02 | Локальный alias контакта важнее глобального ника; alias не уходит в сеть | M1 | proposed |
| FR-PR-03 | Обмен «это я» через QR / copy-paste без сети | M1 | proposed |
| FR-PR-04 | Пересылка чужого контакта (pubkey + hints); профиль догружается и verify | M2 | proposed |
| FR-PR-05 | Новый ключ с тем же ником = другой человек (нет автослияния) | M1 | proposed |
| FR-PR-06 | Группы контактов | L | proposed |
| FR-PR-07 | Метка доверия «видели лично» в UI | M3 | accepted |

### 1.3 Relay & discovery

| id | требование | pri | status |
|---|---|---|---|
| FR-RL-01 | Клиент регистрируется на реле по pubkey (challenge/подпись — см. NFR) | M1 | accepted (signed challenge) |
| FR-RL-02 | Реле отдаёт **пучок** живых узлов (порядок N, см. решения) | M2 | proposed |
| FR-RL-03 | Клиент кэширует пучок и обновляет при коннекте | M2 | proposed |
| FR-RL-04 | Presence/signaling через реле; реле **не** видит содержимое файлов/чата | M1 | proposed |
| FR-RL-05 | После смены реле: редирект-записка и/или повторный QR | M2 | proposed |
| FR-RL-06 | DHT / распределённый directory | L | proposed |
| FR-RL-07 | Режим без реле: ручной signaling (QR) как сейчас | M1 | proposed |
| FR-RL-08 | LAN-режим: локальный узел одной из сторон | M1 | proposed |

### 1.4 Calls

| id | требование | pri | status |
|---|---|---|---|
| FR-CA-01 | Голосовой звонок 1:1 по WebRTC после знакомства/стука | M1 | accepted (один PC с data+media) |
| FR-CA-02 | Входящий: принять / отклонить / busy | M1 | proposed |
| FR-CA-03 | Видео 1:1 | M2 | proposed |
| FR-CA-04 | Демонстрация экрана | M2 | proposed |
| FR-CA-05 | Групповые звонки | L | accepted later (задел; ориентир mesh 4–6, больше — SFU) |
| FR-CA-06 | Запись звонка | L | proposed |
| FR-CA-07 | Честный fail: нет P2P → нужен TURN / нет ответа | M1 | proposed |

### 1.5 Transfer (уже в продукте — сохранить)

| id | требование | pri | status |
|---|---|---|---|
| FR-TR-01 | Передача файла P2P (DataChannel) в OPFS получателя | M1 | accepted |
| FR-TR-02 | Передача папки с деревом путей | M1 | accepted |
| FR-TR-03 | Pause / resume / докачка после обрыва | M1 | accepted |
| FR-TR-04 | Явный accept входящего файла | M1 | accepted |

### 1.6 Presence

| id | требование | pri | status |
|---|---|---|---|
| FR-PE-01 | Контакты показывают онлайн при наличии presence | M1 | accepted (задел) |
| FR-PE-02 | Стук (knock) к онлайн-контакту | M1 | accepted (задел) |
| FR-PE-03 | Режим «доступен» + Wake Lock пока вкладка видима | M1 | accepted (задел) |
| FR-PE-04 | Скрытый режим / last seen | L | proposed |
| FR-PE-05 | Push вне вкладки | L | proposed |

### 1.7 Chat & sync

| id | требование | pri | status |
|---|---|---|---|
| FR-CH-01 | Текст 1:1 с E2EE, история локально | L | deferred (после M1, при развитии) |
| FR-CH-02 | Синк устройств: выкл / P2P / encrypted blob на реле | L | proposed |
| FR-CH-03 | Пересылка контакта из чата | L | proposed |
| FR-CH-04 | Групповой чат | L | accepted later (с групповыми звонками; N — задел) |

### 1.8 Clients & node

| id | требование | pri | status |
|---|---|---|---|
| FR-CL-01 | PWA: установка, офлайн-оболочка | M1 | accepted |
| FR-CL-01b | Клиентский UI портабелен в WebView (нативная оболочка / сторы) без переписывания доменов | M1 | accepted |
| FR-CL-02 | UI оболочка в духе Telegram (список чатов/контактов, экран звонка) | M1 | proposed |
| FR-CL-03 | Десктоп-нода (Tauri/аналог OPS packaging): реле+хранилище для себя | ? | proposed |
| FR-CL-04 | Экран «Серверы»: пресеты / свой URL / QR share-pack | M1 | accepted |

### 1.9 Безопасность (функционально видимая)

| id | требование | pri | status |
|---|---|---|---|
| FR-SE-01 | Нет чужого TURN по умолчанию | M1 | accepted |
| FR-SE-02 | Пользователь видит путь ICE: host / srflx / relay | M1 | accepted (задел) |
| FR-SE-03 | Антиабьюз реле (rate-limit и/или PoW / signed challenge) | M1 | accepted (M1: rate-limit+pubkey; PoW — pluggable later) |

---

## 2. Нефункциональные требования

### 2.1 Архитектура и модульность

| id | требование | pri | status |
|---|---|---|---|
| NFR-AR-01 | Код режется по доменам §0; UI не импортирует SDP/crypto напрямую | M1 | proposed |
| NFR-AR-02 | Ошибки домена — результат `{ ok:false, code }`, не stack пользователю | M1 | accepted (стиль) |
| NFR-AR-03 | Долгоживущие решения — ADR в `docs/adr/` (как OPS) | M1 | proposed |
| NFR-AR-04 | Язык клиента: TypeScript; UI: Vue (текущий стек) | M1 | proposed |
| NFR-AR-05 | Сборка/check: Vite+ (`vp`); при росте — `just` как фасад (как OPS) | M2 | proposed |
| NFR-AR-06 | Реле/нода: тонкий сервер (сейчас Node); эволюция к отдельному пакету/бинарнику без ломки контракта | M2 | proposed |
| NFR-AR-08 | Signaling: WS/HTTP poll сейчас; WebTransport/HTTP3/QUIC — адаптер, пробуем где уместно | M2 | proposed |

### 2.2 Безопасность и приватность

| id | требование | pri | status |
|---|---|---|---|
| NFR-SE-01 | Содержимое файлов/чата/медиа не на реле | M1 | accepted |
| NFR-SE-02 | Threat model задокументирован до публичных обещаний «неубиваемо» | M3 | accepted ([threat-model.md](./threat-model.md)) |
| NFR-SE-03 | Ключ переживает обычный рестарт; потеря кэша PWA = честный UX восстановления | M1 | accepted (master-фраза + encrypted backup; биометрия = unlock opt-in) |
| NFR-SE-04 | Целевой противник на M1–M3: облако/случайный админ реле/фишинг ника — **не** полноценный DPI-state adversary | M3 | accepted |

### 2.3 Надёжность и сеть

| id | требование | pri | status |
|---|---|---|---|
| NFR-NE-01 | Работа без интернета: QR + одна LAN | M1 | accepted |
| NFR-NE-02 | Разные сети: STUN; при fail — свой TURN | M1 | accepted |
| NFR-NE-03 | Падение одного реле не требует ручного экрана серверов (при пучке ≥2) | M2 | proposed |
| NFR-NE-05 | Control-plane (signaling) ≠ media-plane (P2P/TURN); multi-relay; Call multi-leg; topology mesh→SFU | M1 | accepted (уточним пороги в процессе) |

### 2.4 UX / UI

| id | требование | pri | status |
|---|---|---|---|
| NFR-UX-01 | Визуальный ориентир — Telegram (списки, шапка чата/звонка, FAB/actions) | M1 | proposed |
| NFR-UX-02 | Mobile-first, touch ≥44px, safe-area | M1 | accepted |
| NFR-UX-03 | Состояния сети текстом, не только цветом | M1 | accepted |
| NFR-UX-04 | RU UI в M1; i18n — L | M1 | proposed |
| NFR-UX-05 | Один основной CTA на экран критичных флоу | M1 | accepted |

### 2.5 Производительность и ресурсы

| id | требование | pri | status |
|---|---|---|---|
| NFR-PE-01 | Файлы стримами, не целиком в RAM | M1 | accepted |
| NFR-PE-02 | Лимит размера файла — конфиг (понятный отказ) | M1 | accepted |
| NFR-PE-03 | Индекс/граф кода (Serena/CodeGraph) не в runtime продукта | — | n/a |

### 2.6 Сопровождение

| id | требование | pri | status |
|---|---|---|---|
| NFR-OP-01 | `vp check` + тесты доменов зелёные перед merge шага | M1 | accepted |
| NFR-OP-02 | usage.md обновляется при user-visible change M1/M2/M3 | M3 | accepted |
| NFR-OP-03 | Секреты TURN не в git | M1 | accepted |

---

## 3. Решения, которые надо закрыть, чтобы двигаться

Ответы пишем сюда (`accepted`) и коротко в ADR при необходимости.

### Блок A — продукт (нетехнические)

| # | вопрос | предложение | ваше |
|---|---|---|---|
| A1 | Имя продукта на горизонте | оставить **NoCloud**, слоган «P2P звонки и файлы без облака» | **ок, пока NoCloud** |
| A2 | M1 scope | identity + контакты QR + голос 1:1 + файлы (как есть) + Telegram-shell; **чат и DHT — не M1** | **ок** |
| A3 | Десктоп-нода | **после** M1 (M2/L), контракт реле готовим сразу | **после MVP; сначала быстрее на тест работы** |
| A4 | Аудитория M1 | self-host + LAN + QR; официальные публичные seed — позже / опционально | **максимум путей на отказоустойчивость: что бы ни стало — соединить** (QR + LAN + self-host + bootstrap/seed, не резать варианты ради «чистоты») |
| A5 | UI | Telegram-like сразу; полировка визуала не блокер логики | **грубо по блокам сразу; недочёты позже; главное — не блокер** |

### Блок B — технические

| # | вопрос | предложение | ваше |
|---|---|---|---|
| B1 | Алгоритм ключей | Ed25519 (или Web Crypto ECDSA P-256, если без wasm); fingerprint в UX короткий | **Ed25519 + `@noble/ed25519`; за интерфейсом identity — можно сменить позже. Отдельно: пробовать WebTransport/HTTP3/QUIC как транспорт signaling, где уместно (адаптер рядом с WS, не блокер MVP)** |
| B2 | Восстановление | файл экспорта в M1; BIP39 — L | **оба: файл экспорта + BIP39** |
| B3 | Старые `C1.` id | hard cut + импорт «старый контакт → пометить unverified» **или** dual на 1 релиз — выбрать | **hard cut: только новый подход; старое было разведкой направления** |
| B4 | Хранение ключа PWA | IndexedDB/OPFS + явный backup UX; честно про снос кэша | **локально IndexedDB/OPFS; приватный ключ под master-фразой (при регистрации); бэкап/архив только зашифрованный той же фразой; где получится — биометрия как удобный unlock (WebAuthn/платформа), не единственный способ восстановления** |
| B5 | Аватар M1 | data-URL с лимитом (как сейчас); blob на реле — M2 | **пока простой: data-URL с лимитом** |
| B6 | Реле persistence | RAM + optional TTL редиректов на диск; не «аккаунты» | **пока простой: RAM (+ TTL-редиректы позже). Комнаты для пользователя в 1:1 не нужны — связь = контакт(ы). Внутри signaling — служебный channel id. Групповые чат/звонки — later; задел по комфортному N (mesh ~4–6, больше — SFU/отдельный медиа-релей)** |
| B7 | K реле в M1 | **1** активное; пучок кэшировать уже в M2 | **ок (проверим в процессе): до 3 активных реле; медиа P2P; Call multi-leg; mesh→SFU задел** |
| B8 | Auth на реле | signed challenge с M1 | **сразу нормально: signed challenge** |
| B9 | Call + files | **один** PeerConnection, data + позже media tracks | **ок: один PC** |
| B10 | Chat E2EE | **не** в M1 (FR-CH-01 → L / M2 явно) | **ок, позже при развитии** |
| B11 | Антиабьюз | сначала rate-limit + pubkey; PoW — M2 | **проще сейчас: rate-limit + pubkey; интерфейс антиабьюза с заделом под PoW/квоты позже (макс. устойчивость без переделки)** |
| B12 | Язык ноды | Node тонкий в M1 (есть); Rust-нода как OPS — только если/когда десктоп | **тонкий реле на Node.js (папка `server/`) — не путать с PWA. Клиент = PWA/Vue, задел на WebView (Capacitor и т.п.) для сторов. Контракт реле стабильный; смена языка ноды позже без ломки клиента** |

---

## 4. Критерий «можно кодить M1»

Блоки A и B закрыты (2026-09-13).  
Первый ADR: [adr/0001-m1-scope-and-modules.md](./adr/0001-m1-scope-and-modules.md).  
Системный дизайн: [architecture.md](./architecture.md), термины: [glossary.md](./glossary.md).

Дальше: обновлять статусы FR M1 → `accepted` по мере кода; двигаться по доменам identity → contacts → call media → Telegram shell.
