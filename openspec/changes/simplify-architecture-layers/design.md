## Context

- Invariants: control ≠ media plane; OwnedSecret (ADR 0002); UI via domain facades; thin `server/`; P2P first / TURN explicit (`CODING_STANDARDS.md`, `docs/architecture.md`).
- Existing deep-module pattern: `src/packages/README.md` + `pnpm run lint:boundaries`.
- Growth evidence: ADR 0001–0004 (chat deferred then added on DataChannel).

## Goals / Non-Goals

**Goals:** clarify layers; shrink conceptual overload of `lib/`; finish half-migrations (signaling package, RelayCatalog-as-deep-module story).

**Non-Goals:** rewrite Link/PeerSession; redesign chat wire format; domain interface split (phase 2).

## Layer design

| Layer | Responsibility | Today’s primary homes |
|---|---|---|
| L1 Shell/UI | Presentation | `components/`, `ui/`, `content/` |
| L2 Application | Orchestration, Pinia, controllers | `stores/nocloud/*`, `lib/*-controller.ts`, `lib/relay-catalog.ts`, transfer/invite session helpers |
| L3 Domain | Pure rules/types/events | `domain/**` |
| L4 Control adapters | Signaling & relay I/O | `packages/signaling`, presence/probe/auth fetch helpers |
| L5 Media/P2P runtime | PC, ICE, channels, FilePipe, media | `peer-session`/`link`, `webrtc`, `ice`, `file-pipe`, `call-media` |
| L6 Platform | Browser/storage/crypto primitive | `config/`, OPFS, `owned-secret`, workers |
| Relay Node | Control-plane process | `server/` |

**Dependency rule:** a layer may depend only on layers below it. Domain areas stay acyclic. Relay Node is not a client layer and must not carry media/file bytes.

## Decisions needed in discussion

1. Physical home for L2 (`src/application/` vs packages).
2. Keep public name `Link` vs `PeerSession`.
3. ADR vs architecture.md-only documentation.
4. How strict early lint should be (warn vs error).

## Risks

- Premature PeerSession split → regressions in transfer/call/chat.
- Controllers becoming a shadow domain → keep rules in L3.
- Over-ceremony → stay at ≤6 layers.

## Migration strategy (post-approve)

1. Docs + OpenSpec in repo (this change).
2. Remove `lib/signaling` re-export shims.
3. Optional layer lint (imports).
4. Relocate controllers without behavior change.
5. Nest flat `domain/*.ts` into area folders (still not phase-2 ports).
6. Stop; open phase-2 OpenSpec for domain interfaces.
