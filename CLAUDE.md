# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NoCloud — a PWA for exchanging files (and voice/video/chat) between devices without a cloud. File traffic goes peer-to-peer over WebRTC `RTCDataChannel`; the server is only a control plane (signaling, presence, relay discovery) and, behind hard NAT, an optional self-hosted TURN.

## Commands

Tooling is [Vite+](https://viteplus.dev/) (`vp`), pnpm 12.4.1, Node 22. Always invoke the local CLI via `pnpm exec vp` or the npm scripts — a global `vp` may be older than the pinned version.

```bash
pnpm install
pnpm run check        # fmt + lint (type-aware) + type check
pnpm test -- --run    # vitest, single run (no watch)
pnpm test -- --run src/lib/chunk.test.ts   # single test file
pnpm test -- --run -t "name"               # single test by name
pnpm dev              # dev server
pnpm run build        # production build to dist/
pnpm run preview      # build + HTTPS/localhost (installable PWA)
pnpm run serve        # node server/index.js — LAN signaling :8000 + STUN :3478 (run after build; serves dist/)
```

CI (must be green for PRs): `pnpm run check`, `pnpm test -- --run`, `pnpm audit`, CodeQL, dependency review.

Build env: `PAGES_BASE` sets the `base` path (GitHub Pages builds use `/pwa-no-cloud/`). `import.meta.env.VITE_GIT_DESCRIBE` is injected from `git describe` at build time.

## Architecture

Docs live in `docs/` (Russian): start with `glossary.md`, then `architecture.md`, then `requirements.md`. Decisions are in `docs/adr/`.

**Control plane vs media plane** is the core invariant: relays (Node servers) never carry file/media bytes. A blocked relay must not break an already-established P2P channel. Media prefers P2P; TURN is only used explicitly.

### Client (`src/`)

- `domain/` — business logic per area: `identity` (Ed25519 keys, BIP39 mnemonic, vault, WebAuthn unlock), `relay` (relay bundle, signed challenge auth, redirect notes, abuse limits), `call`, `chat`, `transfer`, `session`, `presence`, `discovery`, `contacts`. No dependency cycles; UI never imports SDP/crypto directly — only domain facades.
- `lib/` — infrastructure: `webrtc.ts`, `ice.ts`, `opfs.ts` (OPFS inbox), `chunk.ts`, `file-pipe.ts`, `owned-secret.ts`, `qr.ts`, and `signaling/` adapters.
- `signaling/` — pluggable transports behind one `SignalingPort` contract, selected by `signaling/factory.ts`: `http-poll`, `websocket`, `manual` (QR/paste, no server).
- `config/` — server presets, ICE URLs, settings merge, storage.
- `ui/` — screen logic (sections, status line, shell nav); `content/ru/` — all Russian UI strings.
- `stores/nocloud.ts` — one Pinia store composed of slices (`calls`, `chat`, `contacts`, `presence`, `servers`, `session`, `shell`) wired through a shared context; cross-slice callbacks are assigned via `ctx.refs`.
- `workers/` — service worker. `shell-sw.js` is a **template**, not the real SW: the build plugin (`workers/plugin.ts`) fills in the asset list and emits `sw.js` + `version.json` into the bundle. It is excluded from lint/format — edit it knowing the template placeholders.

### Server (`server/`)

Thin Node.js relay (plain JS, not the PWA): HTTP poll endpoints (`/join`, `/signal`, `/peers`, `/leave`), WebSocket at `/ws`, signed-challenge auth (`/challenge`), relay-bundle discovery (`/relays`), redirect-note store (`/redirect`), STUN on UDP :3478, and static serving of `dist/`. Rate-limited per IP. `deploy/` holds Docker images for a public wss signal server (:8443) and coturn, plus `install-turn.sh` for VPS.

### Conventions

- **Secrets lifecycle** (ADR 0002): Ed25519 `secretKey` bytes live in an `OwnedSecret` (`src/lib/owned-secret.ts`) with `use`/`borrow`/`move`/`dispose` and memory wipe. Signing/challenges must go through `OwnedSecret.use` or a short `borrow()` inside a domain call — never hold the key in long-lived UI closures.
- **Vue hybrid Vapor** (ADR 0002): leaf SFCs may use `script setup vapor` with `vaporInteropPlugin` (registered in `main.ts`); the shell stays VDOM. Don't migrate to pure `createVaporApp`.
- TypeScript is strict with `verbatimModuleSyntax` and `erasableSyntaxOnly`; imports use explicit `.ts` extensions; path alias `@/` → `src/`.
- Tests are colocated `*.test.ts` (vitest globals enabled); `fast-check` property/fuzz tests exist (e.g. `src/lib/parser-fuzz.test.ts`).
- `vp check` runs on staged files via the `staged` config (lint-staged style) — expect `vp check --fix` on commit.

## Agent skills

### Issue tracker

GitHub Issues in `org-event/pwa-no-cloud` via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
