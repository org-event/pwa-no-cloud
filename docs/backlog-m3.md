# Бэклог M3 — нарезка на стори

Цель: за один заход закрывать **1–5 SP**, редко **8**.  
Всё ≥8 **обязательно** режем. Шкала как в [backlog-m1.md](./backlog-m1.md).

**DoD стори:** `vp check` + тесты стори зелёные; контракт не ломает соседей; usage при user-visible.

**Порядок:** сверху вниз по эпикам.

M1/M2 закрыты. M3 = must следующего среза из [requirements.md](./requirements.md) + [adr/0004-m3-scope.md](./adr/0004-m3-scope.md).

---

## Эпики M3 (ориентир)

| эпик | Σ SP | комментарий |
|---|---|---|
| U0 Scope / ADR M3 | 2 | границы среза |
| U1 Чат 1:1 (DC + подпись + UI) | 18 → режем | FR-CH-01 (урезанный: без sealed sync); + первый экран входа |
| U2 Trust контакта | 3 | FR-PR-07 |
| U3 Реле: TTL redirect store | 5 | B6 / FR-RL-05 server side |
| U4 Abuse PoW slot | 3 | B11 задел |
| U5 Threat model + usage | 5 | NFR-SE-02, NFR-OP-02 |
| **Итого M3** | **~35–40 SP** | ~8–12 заходов |

**Вне M3 (не брать):** DHT, групповой чат/SFU, desktop node, WebTransport must, multi-device sealed sync.

---

## Нарезка сторий

### U0 — Scope

| id | стори | SP | DoD |
|---|---|---|---|
| **U0.1** | ADR M3 + этот бэклог в `docs/README` | 2 | ADR accepted; ссылки живые |

### U1 — Чат 1:1

| id | стори | SP | DoD |
|---|---|---|---|
| **U1.1** | Контракт сообщения `H1.` (peer, text, ts, sig) + verify | 3 | unit parse/sign/verify |
| **U1.2** | Локальное хранилище тредов (IndexedDB/OPFS) append/list | 3 | тесты store |
| **U1.3** | Send/receive через DataChannel PeerSession | 5 | не ломает ping/transfer |
| **U1.4** | Shell: список тредов + экран диалога (грубо) | 5 | каркас вместо stub; точить в конце M3 |
| **U1.5** | Usage: чеклист чата 1:1 | 2 | |
| **U1.6** | Первый экран после разлогина: учётка + вставка/скан | 5 | unlock/create; paste и camera QR (P1./I1./S1./backup) |

### U2 — Trust

| id | стори | SP | DoD |
|---|---|---|---|
| **U2.1** | Поле `trust` на контакте + UI «видели лично» | 3 | persist в book |

### U3 — Redirect на реле

| id | стори | SP | DoD |
|---|---|---|---|
| **U3.1** | Server RAM store R1. по pubkey + TTL + GET/POST | 5 | smoke |

### U4 — Abuse

| id | стори | SP | DoD |
|---|---|---|---|
| **U4.1** | PoW slot в abuse guard (noop default + простой stub) | 3 | unit |

### U5 — Склейка

| id | стори | SP | DoD |
|---|---|---|---|
| **U5.1** | Threat model doc + чеклисты M3 + check/test | 5 | |

---

## Первые заходы

1. **U0.1** → **U1.1**  
2. **U1.2** → **U1.3**  
3. **U1.4** (каркас) → **U1.3** (если ещё открыт) → **U1.5**  
4. **U1.6** первый экран (разлогин / paste / скан) — не откладывать на «полировку shell»  
5. **U2.1** → **U3.1**  
6. **U4.1** → точить UI shell → **U5.1**

### Заметка к U1.6

Сейчас onboarding есть, но после **разлогина** сценарий «войти в учётку» и единая точка **вставить или отсканировать** (карточка `P1.`, introduce `I1.`, pack `S1.`, backup) на первом экране не собраны. Нужно продумать UX до usage M3.

---

## Трекинг

| id | status | SP |
|---|---|---|
| U0.1 | done | 2 |
| U1.1 | done | 3 |
| U1.2 | done | 3 |
| U1.3 | done | 5 |
| U1.4 | done | 5 |
| U1.5 | done | 2 |
| U1.6 | done | 5 |
| U2.1 | todo | 3 |
| U3.1 | todo | 5 |
| U4.1 | todo | 3 |
| U5.1 | todo | 5 |
