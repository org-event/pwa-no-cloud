# NoCloud

PWA для обмена файлами без облака. Файловый трафик идёт по WebRTC
(`RTCDataChannel`). Сервер нужен только для знакомства клиентов
и, при жёстком NAT, как свой TURN.

План работ: [docs/plan.md](docs/plan.md).

## Команды

Инструментарий — [Vite+](https://viteplus.dev/) (`vp`).

```bash
pnpm install   # зависимости
pnpm dev       # dev-сервер
pnpm exec vp check
pnpm exec vp test
pnpm exec vp build
pnpm exec vp preview   # сборка + HTTPS/localhost, можно поставить PWA
```

В этом репозитории `vite-plus` 0.2.9. Если глобальный `vp` старше, вызывайте
локальный CLI через `pnpm exec vp` или `pnpm dev`.

## Слои

| папка          | роль                        |
| -------------- | --------------------------- |
| `src/config/`  | пресеты и настройки         |
| `src/domain/`  | сессия, передача, пир       |
| `src/lib/`     | WebRTC, signaling, OPFS     |
| `src/ui/`      | экраны                      |
| `src/workers/` | Service Worker              |
| `server/`      | локальный signaling (позже) |
