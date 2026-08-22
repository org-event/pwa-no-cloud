# Документация NoCloud

PWA для обмена файлами и папками между устройствами без облака.
Трафик файлов идёт напрямую по WebRTC (`RTCDataChannel`).
Сервер нужен только для знакомства клиентов (signaling) и, при жёстком NAT, как TURN-релей.

## Как читать

1. [usage.md](./usage.md) — как соединиться и передать файл или папку.
2. [turn.md](./turn.md) — свой coturn для режима через интернет. Чужой TURN не подключаем.
3. [plan.md](./plan.md) — план развития по шагам.
4. [design-system/nocloud/MASTER.md](../design-system/nocloud/MASTER.md) — визуальные токены UI.

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
