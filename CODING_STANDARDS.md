# Coding standards

Judgement calls for agents reviewing or writing code. Mechanical rules (`vp check`, `lint:boundaries`, typecheck) are enforced by tooling — do not restate them here.

## Architecture

- **Control plane vs media plane.** Relays never carry file/media bytes. A blocked relay must not break an already-established P2P channel. Prefer P2P; TURN only when the user opts in.
- **Domain facades.** UI and stores talk to `src/domain/*` facades, not raw SDP/crypto/`RTCPeerConnection` helpers. If a screen needs WebRTC details, push them behind a domain call.
- **No cycles across domain areas.** Keep `identity`, `relay`, `call`, `chat`, `transfer`, … acyclic; share via `lib/` only when the shared piece is infrastructure, not a domain concept.

## Secrets

- Ed25519 `secretKey` bytes live in `OwnedSecret` (`src/lib/owned-secret.ts`). Sign/challenge through `use` or a short `borrow()` inside a domain call — never stash the key in long-lived UI closures or Pinia state.
- Details: [docs/adr/0002-ownership-and-secrets.md](./docs/adr/0002-ownership-and-secrets.md).

## Vue

- Leaf SFCs may use `script setup vapor` with `vaporInteropPlugin`. The shell stays VDOM. Do not migrate the app to pure `createVaporApp`.
- User-visible strings live in `src/content/ru/` — no hardcoded Russian (or English UI copy) in SFCs/stores.

## Tests

- Prefer `@total-typescript/shoehorn` (`fromPartial` / `fromAny`) over `as` / `as unknown as` in tests. Never use shoehorn in production code.
- Name tests and fixtures with terms from [docs/glossary.md](./docs/glossary.md) (via [CONTEXT.md](./CONTEXT.md)).

## Packages

- New modules under `src/packages/` are deep modules: import only through package root entry points. See [src/packages/README.md](./src/packages/README.md).
