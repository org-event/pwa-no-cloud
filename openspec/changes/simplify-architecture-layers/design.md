## Context

- Invariants: control ≠ media plane; OwnedSecret (ADR 0002) under Security + Login outside; UI via domain facades; thin `server/`; P2P first / TURN explicit (`CODING_STANDARDS.md`, `docs/architecture.md`).
- Existing deep-module pattern: `src/packages/README.md` + `pnpm run lint:boundaries`.
- Growth evidence: ADR 0001–0004 (chat deferred then added on DataChannel).
- User-facing plan (store): product map + **contracts-first** — not the old L1–L6 primary narrative; not “ports after code”.

## Goals / Non-Goals

**Goals:** scannable product map; **explicit interaction contracts** before code; Transport as facade; Codec separated from connection lifecycle; shrink conceptual overload of `lib/`.

**Non-Goals:** any `src/` refactor before contracts approve; rewrite Link/PeerSession/FilePipe; redesign chat wire format; exhaustive wire-format tables.

## Sequencing

1. Approve product map  
2. Approve contracts (layers + sparse domain edges + Transport/Codec)  
3. Docs in repo  
4. Only then mechanical leak cleanup  

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
| Transport | **Facade** for all connection paths | `packages/signaling`, webrtc, ice, peer-session/link, file-pipe, call-media *(inside)* |
| Codec | Encode/decode only | demux/parsers *(target: not mixed with session lifecycle)* |
| Платформа | Browser storage/config | `config/`, OPFS, `owned-secret`, workers |
| Relay Node | Control-plane process | `server/` |

**Dependency rule:** UI ↔ API ↔ Domain ↔ Transport ↔ Platform (adjacent only). Codec sits beside or clearly inside Transport. Domain may use Platform for storage. Relay is not a client layer and must not carry media/file bytes. Transport splits relay signaling vs P2P/TURN.

```text
Экраны → API → Домен → Transport(+Codec) → Платформа
                      ↘ (storage) ↗
Transport ···signaling···> Relay
Transport ···P2P/TURN····> peers
```

## Contract sketch (few surfaces)

| Surface | Parties | One-liner |
|---|---|---|
| ScreenAPI | Экраны ↔ API | scenarios only; no keys/SDP |
| ApiDomain | API ↔ Domain facades | orchestration; rules stay in Domain |
| DomainTransport | Domain ↔ Transport facade | connect / send / subscribe / state / close |
| Codec | beside Transport | encode(kind, payload) / decode(bytes) |
| Sparse domain edges | see store plan | Login↔Security; Contacts/Users→Security; Calls/Chat/Files→Contacts; blocks→Transport |

**Forbidden:** UI↔Transport; Messages↔Files; Calls↔Files; Domain↔Vue; long-lived secrets in UI.

Message-kind outline (later, not full wire format): `offer|answer|candidate` · `presence` · `chat` · `transfer-control` · `call-signal` · …

## Decisions left for product owner (≤3)

1. **Пользователи** — one label for profile + online, or keep online as a separate feel?
2. **ДогИнОут vs Секьюрити** — two neighbor blocks, or login nested under Security?
3. **First cleanup after map+contracts approve** — docs/lint boundaries only, or gather all transports out of fat `lib/` next?

(Codec separation is already a **design yes** — not a fourth decision. Engineer trivia — Link vs PeerSession naming — stay internal.)

## Risks

- Code before contracts → thrash → **blocked** by tasks gate.
- Premature P2P-hub split → regressions in transfer/call/chat → behavior-neutral only after gate.
- Controllers becoming a shadow domain → rules stay in Domain; API only orchestrates.
- Codec leaking into UI/API → keep next to Transport only.
- Reverting to L1–L6 jargon in user docs → product names remain primary.

## Migration strategy (post-contracts-approve)

1. Docs + this OpenSpec change (map + contracts) in repo.
2. Remove `lib/signaling` re-export shims.
3. Optional layer lint (imports).
4. Relocate controllers under clear API home without rewriting Transport hub.
5. Nest flat `domain/*.ts` into Domain block folders (still not typed port codegen).
6. Stop; open a later change only if typed ports in `src/` are still needed.
