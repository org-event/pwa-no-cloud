# ADR 0002 — Ownership of secrets and third-party access

Дата: 2026-09

## Контекст

Identity material (Ed25519 `secretKey`), WebRTC handles, signaling sockets и чужие SDK живут в одном процессе PWA. Нужна явная модель: кто владеет секретом, когда он уничтожается, и что можно отдать наружу.

Ориентир: [HowProgrammingWorks/Ownership](https://github.com/HowProgrammingWorks/Ownership) (Owned / move / borrow / revocable / AbortScope / dispose).

## Решение

1. **OwnedSecret** (`src/lib/owned-secret.ts`): exclusive ownership байтов ключа; `use` / `borrow` / `move` / `dispose` с затиранием памяти (`fill(0)`).
2. **revocableView**: временный Proxy для передачи API третьей стороне; после `dispose` доступ ломается.
3. **AbortScope**: отмена fetch/probe при уходе со scope (presence, challenge).
4. **Сторонние зависимости**: не держать `secretKey` в долгоживущих замыканиях UI; подпись/challenge только через `OwnedSecret.use` или короткий `borrow()` внутри доменного вызова.
5. **Vue Vapor**: гибрид — leaf UI на `script setup vapor` + `vaporInteropPlugin`, без полного `createVaporApp` пока Pinia/shell не проверены на pure vapor.

## Почему не альтернативы

- Только GC / надежда на GC — недетерминированно; секрет может жить дольше сессии unlock.
- Полный pure Vapor сейчас — высокий риск для Pinia + крупного shell; RC рекомендует точечный opt-in.

## Последствия

Плюсы: явный lifecycle секретов; меньше случайных ссылок на ключ; задел под `using` / Explicit Resource Management.

Минусы: JS не гарантирует wipe против heap snapshots; это best-effort, не hardware enclave.
