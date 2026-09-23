## Context

- Invariants: control ≠ media plane; OwnedSecret (ADR 0002) under Security + Login outside; UI via domain facades; thin `server/`; P2P first / TURN explicit (`CODING_STANDARDS.md`, `docs/architecture.md`).
- Existing deep-module pattern: `src/packages/README.md` + `pnpm run lint:boundaries`.
- Growth evidence: ADR 0001–0004 (chat deferred then added on DataChannel).
- User-facing plan (store): product map — not the old L1–L6 primary narrative.

## Goals / Non-Goals

**Goals:** ship a scannable product map; shrink conceptual overload of `lib/`; finish half-migrations (signaling package); make “only adjacent layer” enforceable later.

**Non-Goals:** rewrite Link/PeerSession/FilePipe; redesign chat wire format; full domain port split (phase 2).

## Layer design (names outside / tech inside)

| Outside | Owns | Today’s primary homes |
|---|---|---|
| Экраны (UI) | Screens, copy | `components/`, `ui/`, `content/` |
| API | Requests / use-case orchestration | `stores/nocloud/*`, `lib/*-controller.ts`, non-WebRTC session helpers |
| Домен · Контакты | Known people, cards | `domain/contacts/**` |
| Домен · Звонки | Voice/video call rules | `domain/call/**` (+ controllers in API) |
| Домен · Сообщения | Chat rules | `domain/chat/**` |
| Домен · Файлы | Transfer rules / queue semantics | `domain/transfer*`, transfer-session |
| Домен · Пользователи | Profile + who’s online | profile + `domain/presence/**` |
| Домен · Секьюрити | Keys, vault, signatures | `domain/identity/**` crypto surfaces |
| Домен · ДогИнОут | Unlock / login / logout | identity-session, vault unlock |
| Transport | **All** transports | `packages/signaling`, webrtc, ice, peer-session/link, file-pipe, call-media *(inside)* |
| Платформа | Browser storage/config | `config/`, OPFS, `owned-secret`, workers |
| Relay Node | Control-plane process | `server/` |

**Dependency rule:** UI ↔ API ↔ Domain ↔ Transport ↔ Platform (adjacent only). Domain may use Platform for storage. Relay is not a client layer and must not carry media/file bytes. Transport splits relay signaling vs P2P/TURN.

```text
Экраны → API → Домен → Transport → Платформа
                      ↘ (storage) ↗
Transport ···signaling···> Relay
Transport ···P2P/TURN····> peers
```

## Decisions left for product owner (≤3)

1. **Пользователи** — one label for profile + online, or keep online as a separate feel?
2. **ДогИнОут vs Секьюрити** — two neighbor blocks, or login nested under Security?
3. **First cleanup after approve** — docs/lint boundaries only, or gather all transports out of fat `lib/` next?

(Engineer trivia — Link vs PeerSession naming, warn vs error lint — stay internal after the map is approved.)

## Risks

- Premature P2P-hub split → regressions in transfer/call/chat → phase 1 behavior-neutral only.
- Controllers becoming a shadow domain → rules stay in Domain; API only orchestrates.
- Reverting to L1–L6 jargon in user docs → product names remain primary.

## Migration strategy (post-approve)

1. Docs + this OpenSpec change (already in repo on bootstrap branch).
2. Remove `lib/signaling` re-export shims.
3. Optional layer lint (imports).
4. Relocate controllers under clear API home without rewriting Transport hub.
5. Nest flat `domain/*.ts` into Domain block folders (still not phase-2 ports).
6. Stop; open phase-2 OpenSpec for domain interfaces.
