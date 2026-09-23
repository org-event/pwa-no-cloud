## Why

NoCloud client grew from P2P file transfer into a messenger. The map people use must be product names — **Экраны → API → Домен (Контакты, Звонки, Сообщения, Файлы, Пользователи, Секьюрити, ДогИнОут) → Transport → Платформа** — not engineer jargon (L1 Shell / L4 Control adapters / PeerSession). Technical terms stay **inside** each layer. We need an adjacent-only dependency rule and incremental leak cleanup — without changing control-plane vs media-plane behavior.

## What Changes

- Document the **product-facing client map** above, plus the separate Relay Node (`server/`).
- Domain outer labels: Contacts, Calls, Messages, Files, Users, Security, Login/Logout (Russian product names OK in docs).
- **Dependency rule:** a layer may know **only the adjacent layer** (no UI→Transport leaks, no Domain→Vue, etc.).
- Plan **incremental** mechanical moves (signaling shim removal, API/controller placement, optional lint boundaries) — **no** big-bang rewrite of the transfer-era P2P hub.
- Phase 2 (separate change) sharpens **ports between the same Domain block names** — not a different naming scheme.
- **Non-goals:** product feature work; moving file/media bytes onto the relay; OwnedSecret redesign; pure Vapor migration; SFU/DHT/desktop node.

## Capabilities

- **New Capabilities:** none (structural only).
- **Modified Capabilities:** none at spec/requirement level.
- This change sets `skip_specs: true`.

## Impact

- Docs: `docs/architecture.md` (+ optional ADR).
- Code (after approve only): placement/imports under `src/`; possibly `lint:boundaries` / dep-cruise layer rules.
- No intentional change to relay wire protocol or P2P byte paths.

## Phase 2 (outline only — separate change later)

Change id sketch: `split-domain-blocks-by-interface`.

- Keep the same outer Domain names; define explicit doors between blocks and toward Transport.
- Do **not** implement in `simplify-architecture-layers`.

## Status

**Proposal / tasks for discussion.** Architecture execution is **not** approved yet — do not start the layer refactor until stakeholders approve the product map and the ≤3 remaining decisions in the store plan.
