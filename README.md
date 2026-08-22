# NoCloud

PWA для обмена файлами без облака. Файловый трафик идёт по WebRTC
(`RTCDataChannel`). Сервер нужен только для знакомства клиентов
и, при жёстком NAT, как свой TURN.

Как пользоваться: [docs/usage.md](docs/usage.md).
План работ: [docs/plan.md](docs/plan.md).
Свой TURN (coturn): [docs/turn.md](docs/turn.md). Чужой открытый TURN
в пресеты не кладём. Установщик на VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/org-event/pwa-no-cloud/main/deploy/install-turn.sh | sudo bash
```

Поставить PWA с GitHub Pages (HTTPS):
https://org-event.github.io/pwa-no-cloud/

Signaling и TURN задаются в приложении на экране «Серверы».
Со страницы Pages ставится только оболочка.

## Команды

Инструментарий — [Vite+](https://viteplus.dev/) (`vp`).

```bash
pnpm install   # зависимости
pnpm dev       # dev-сервер
pnpm exec vp check
pnpm exec vp test
pnpm exec vp build
pnpm exec vp preview   # сборка + HTTPS/localhost, можно поставить PWA
vp build && node server/index.js   # LAN: signaling :8000 + STUN :3478
```

Пресеты `Локальный dev` и `Локальная сеть` ходят на этот сервер
(HTTP poll). Второй телефон открывает `http://<lan-ip>:8000`, оба
входят в одну комнату — канал открывается без QR.

В этом репозитории `vite-plus` 0.2.9. Если глобальный `vp` старше, вызывайте
локальный CLI через `pnpm exec vp` или `pnpm dev`.

## Слои

| папка          | роль                       |
| -------------- | -------------------------- |
| `src/config/`  | пресеты и настройки        |
| `src/domain/`  | сессия, передача, пир      |
| `src/lib/`     | WebRTC, signaling, OPFS    |
| `src/ui/`      | экраны                     |
| `src/workers/` | Service Worker             |
| `server/`      | локальный signaling + STUN |
