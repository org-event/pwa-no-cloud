# Бэклог M2 — нарезка на стори

Цель: за один заход закрывать **1–5 SP**, редко **8**.  
Всё ≥8 **обязательно** режем. Шкала как в [backlog-m1.md](./backlog-m1.md).

**DoD стори:** `vp check` + тесты стори зелёные; контракт не ломает соседей; usage при user-visible.

**Порядок:** сверху вниз по эпикам.

M1 закрыт (`docs/backlog-m1.md`). M2 = must следующего среза из [requirements.md](./requirements.md).

---

## Эпики M2 (ориентир)

| эпик | Σ SP | комментарий |
|---|---|---|
| T0 Scope / ADR M2 | 2 | границы среза |
| T1 Introduce / пересылка контакта | 8 → режем | FR-PR-04 |
| T2 Пучок реле: сервер → кэш → failover | 13 → режем | FR-RL-02/03, NFR-NE-03 |
| T3 Call video + screen polish | 10 → режем | FR-CA-03/04 (задел UI есть) |
| T4 Смена реле / редирект | 5 | FR-RL-05 |
| T5 Склейка + usage | 3 | NFR-OP-02 |
| **Итого M2** | **~35–40 SP** | ~8–12 заходов |

**Вне M2 (не брать):** chat E2EE, DHT, PoW, SFU groups, desktop node, WebTransport как must.

---

## Нарезка сторий

### T0 — Scope

| id | стори | SP | DoD |
|---|---|---|---|
| **T0.1** | ADR M2 scope + этот бэклог в `docs/README` | 2 | ADR accepted; ссылки живые |

### T1 — Introduce / пересылка контакта

| id | стори | SP | DoD |
|---|---|---|---|
| **T1.1** | Контракт introduce-карточки (`I1.` / pubkey + optional relay hints) + verify | 3 | unit parse/sign/verify |
| **T1.2** | Address book: принять introduce → upsert контакта после verify | 3 | alias локальный; подпись обязательна |
| **T1.3** | UI: «переслать контакт» / вставить introduce (грубо) | 2 | из shell focus или Контакты |

### T2 — Пучок реле

| id | стори | SP | DoD |
|---|---|---|---|
| **T2.1** | Контракт ответа реле: `peers`/`relays` bundle schema + фикстуры | 2 | |
| **T2.2** | Server: отдавать список известных relay URL (задел, даже если 1) | 3 | smoke одним клиентом |
| **T2.3** | Client: кэш пучка при коннекте + merge с локальным | 3 | storage + тесты |
| **T2.4** | Failover: при падении активного переключиться на следующий из пучка (≥2) | 5 | unit + ручной note |

### T3 — Call video / screen

| id | стори | SP | DoD |
|---|---|---|---|
| **T3.1** | Video 1:1: constraints + UI tiles уже есть → стабильный accept/outbound path | 3 | два окна / unit media constraints |
| **T3.2** | Screen share: getDisplayMedia path + hangup clears display tracks | 3 | не ломает data/ping |
| **T3.3** | Call UI: mute/camera toggle (грубо) | 2 | optional в хвосте T3 |

### T4 — Смена реле

| id | стори | SP | DoD |
|---|---|---|---|
| **T4.1** | Редирект-записка / signed «новый relay hint» типы | 3 | |
| **T4.2** | UX: потеряли друг друга → показать QR / скопировать S1 заново | 2 | текст в usage |

### T5 — Склейка

| id | стори | SP | DoD |
|---|---|---|---|
| **T5.1** | Чеклисты M2 в usage + проход check/test | 3 | |

---

## Первые заходы

1. **T0.1** → **T1.1**  
2. **T1.2** → **T1.3**  
3. **T2.1** → **T2.2**  
4. **T2.3** → **T2.4**  
5. **T3.1** → **T3.2**

---

## Трекинг

| id | status | SP |
|---|---|---|
| T0.1 | done | 2 |
| T1.1 | done | 3 |
| T1.2 | done | 3 |
| T1.3 | done | 2 |
| T2.1 | done | 2 |
| T2.2 | done | 3 |
| T2.3 | done | 3 |
| T2.4 | todo | 5 |
| T3.1 | todo | 3 |
| T3.2 | todo | 3 |
| T3.3 | todo | 2 |
| T4.1 | todo | 3 |
| T4.2 | todo | 2 |
| T5.1 | todo | 3 |
