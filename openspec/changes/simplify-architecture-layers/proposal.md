## Why

NoCloud client grew from P2P file transfer into a messenger. The map people use must be product names — **Экраны → API → Домен (Контакты, Звонки, Сообщения, Файлы, Пользователи, Секьюрити, ДогИнОут) → Transport (+ Codec) → Платформа** — not engineer jargon (L1 Shell / L4 Control adapters / PeerSession). Technical terms stay **inside** each layer.

**Sequencing (hard):** approve map → **write and agree contracts** → only then any code.  
Former “phase 2 = contracts after layer refactor” is **superseded**: contracts come **before** mechanical cleanup.

## What Changes

- Document the **product-facing client map** above, plus the separate Relay Node (`server/`).
- Document **interaction contracts** first: vertical layer doors and sparse domain-to-domain edges (no spaghetti).
- **Transport** = facade for all connection paths; **Codec** = encode/decode beside or clear inside Transport — **not** mixed with connect/close lifecycle.
- Domain outer labels: Contacts, Calls, Messages, Files, Users, Security, Login/Logout (Russian product names OK in docs).
- **Dependency rule:** a layer may know **only the adjacent layer** (no UI→Transport leaks, no Domain→Vue, etc.).
- After contracts are approved: **incremental** mechanical moves (signaling shim removal, API/controller placement, optional lint) — **no** big-bang rewrite of the transfer-era P2P hub.
- **Non-goals:** product feature work; moving file/media bytes onto the relay; OwnedSecret redesign; pure Vapor migration; SFU/DHT/desktop node; full wire-format tables in this change.

## Capabilities

- **New Capabilities:** none (structural / contracts docs only).
- **Modified Capabilities:** none at spec/requirement level.
- This change sets `skip_specs: true`.

## Impact

- Docs: `docs/architecture.md` (+ optional ADR) — map **and** contracts.
- Code: **only after** contracts gate; placement/imports under `src/`; possibly `lint:boundaries` / dep-cruise layer rules.
- No intentional change to relay wire protocol or P2P byte paths.

## Later (outline — separate change after contracts)

- Typed ports in `src/` if still needed; same outer Domain names.
- Do **not** implement mechanical layer moves until the contracts gate is checked.

## Status

**Proposal / tasks for discussion.** Architecture execution is **not** approved yet — do not start any `src/` layer work until stakeholders approve the product map, the contracts, and the ≤3 remaining decisions in the store plan.
