# ADR 0003 — M2 scope

Дата: 2026-09

## Контекст

M1 закрыт: identity, contacts/QR, relay challenge, voice call, Telegram shell, e2e checklists.
Нужна граница следующего среза без расползания в chat/DHT/SFU.

## Решение

M2 must (см. [backlog-m2.md](../backlog-m2.md)):

1. **Introduce** чужого контакта (pubkey + verify + optional relay hints).
2. **Пучок реле**: сервер отдаёт / клиент кэширует / failover при ≥2.
3. **Video + screen** 1:1 на существующем PC (polish, не новый стек).
4. **Смена реле**: signed hint / UX «снова QR».
5. Usage + check зелёные.

Явно **не** в M2: E2EE chat, PoW, DHT, групповые звонки/SFU, desktop node, WebTransport как must.

## Последствия

Плюсы: продолжаем тем же ритмом 1–5 SP; опираемся на M1 контракты.
Минусы: failover и introduce потребуют аккуратных версий карточек/ответов реле.
