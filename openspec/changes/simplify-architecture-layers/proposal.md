## Why

NoCloud client grew from P2P file transfer into a messenger (identity, presence, calls, chat) on the same WebRTC session. Folders already hint at domains (`domain/`, `packages/signaling`, Pinia slices), but orchestration, controllers, and the transfer-era `PeerSession`/`FilePipe` hub live in a fat `src/lib/`. Logical layers would make dependency direction explicit and reduce accidental coupling — without changing control-plane vs media-plane behavior.

## What Changes

- Document **6 client layers** (Shell → Application → Domain; Control adapters; Media/P2P runtime; Platform) plus the separate Relay Node deployable.
- Define a **dependency rule**: upper depends on lower only; domain areas remain acyclic.
- Plan **incremental** mechanical moves (signaling shim removal, controller placement, optional lint boundaries) — **no** big-bang rewrite of PeerSession.
- Explicitly **defer** domain block / interface-by-interface split to a **phase-2** OpenSpec.
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

- Break messenger into blocks with explicit ports.
- Discuss interaction stages: unlock → presence → knock → link up → chat | call | transfer.
- Do **not** implement in `simplify-architecture-layers`.

## Status

**Proposal / tasks for discussion.** Architecture execution is **not** approved yet — do not start the layer refactor until stakeholders approve.
