# ADR 0004 — M3 scope

Дата: 2026-09

## Контекст

M1 и M2 закрыты: identity, contacts/introduce, пучок реле, video/screen, R1. redirect.
В shell остаётся заглушка «Чаты»; FR-CH-01 был L, но продуктовый ориентир — Telegram.
Нужна граница без расползания в DHT / SFU / desktop node.

## Решение

M3 must (см. [backlog-m3.md](../backlog-m3.md)):

1. **Чат 1:1** по существующему DataChannel: подписанные сообщения + локальная история + грубый UI вместо stub.
2. **Trust** контакта: unverified / introduced / met-in-person (UI).
3. **Реле:** TTL-хранилище R1. redirect в RAM на сервере (GET/POST).
4. **Abuse:** слот PoW в интерфейсе антиабьюза (noop по умолчанию).
5. Threat model + usage + `vp check`.

Транспорт чата уже DTLS на PC — реле plaintext не видит. Подпись Ed25519 даёт аутентичность отправителя; отдельный sealed-box слой — later при sync устройств.

Явно **не** в M3: DHT, групповой чат/SFU, desktop node, WebTransport как must, полноценный multi-device sync.

## Последствия

Плюсы: закрываем дыру Telegram-shell; опираемся на PeerSession/data.
Минусы: история только локально; без sealed sync между своими устройствами.
