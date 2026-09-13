# Документация NoCloud

PWA для обмена файлами и папками между устройствами без облака.
Трафик файлов идёт напрямую по WebRTC (`RTCDataChannel`).
Сервер нужен только для знакомства клиентов (signaling) и, при жёстком NAT, как TURN-релей.

## Как читать

1. [usage.md](./usage.md) — установка, режимы A/B/C, чеклисты M1 (QR и реле).
2. [turn.md](./turn.md) — свой coturn для режима через интернет. Чужой TURN не подключаем.
3. [plan.md](./plan.md) — план фундамента (WebRTC, файлы, PWA) по шагам.
4. [vision.md](./vision.md) — к чему идём шире: суверенная P2P-звонилка.
5. [requirements.md](./requirements.md) — функциональные и нефункциональные требования + решения к закрытию.
6. [architecture.md](./architecture.md) — системный дизайн со схемами (для новых разработчиков).
7. [glossary.md](./glossary.md) — термины по-русски (P2P, STUN, TURN, реле, PoW…).
8. [adr/](./adr/) — архитектурные решения (почему так).
9. [roadmap-wide.md](./roadmap-wide.md) — пошаговый план горизонта + вопросы на закрытие пунктов.
10. [backlog-m1.md](./backlog-m1.md) — нарезка M1 на стори (закрыт).
10b. [backlog-m2.md](./backlog-m2.md) — нарезка M2 на стори (1–5 SP).
11. [sources/ideas-essence.md](./sources/ideas-essence.md) — сжатая суть идей горизонта.
12. [design-system/nocloud/MASTER.md](../design-system/nocloud/MASTER.md) — визуальные токены UI.
13. [features-realtime.md](./features-realtime.md) — presence, стук, звонки (задел).

## Источники подхода

Локальный каталог: `/Users/org-event/git-step/HowMeta`.

| тема | куда смотреть |
|---|---|
| слои, контракты, конфиг | `HowMeta/Metarhia/Docs`, `Example`, `metaconfiguration` |
| стиль JS | `HowMeta/Metarhia/metaskills/skills/js-conventions` |
| WebRTC + signaling + STUN | `HowMeta/HowProgrammingWorks/WebRTC` |
| PWA, SW, offline, Application | `HowMeta/HowProgrammingWorks/PWA`, `ServiceWorker`, `Application` |
| OPFS | `HowMeta/HowProgrammingWorks/OPFS` |
| слои абстракции | `HowMeta/HowProgrammingWorks/AbstractionLayers` |
| адаптеры и стратегии | `HowMeta/HowProgrammingWorks/Adapter`, `Strategy` |
| очереди, стримы | `HowMeta/HowProgrammingWorks/AsyncQueue`, `WebStreams` |
| конфигурация как JS-объекты | `HowMeta/HowProgrammingWorks/Configuration` |

Копируем **подход и структуру**, не файлы слепо.
