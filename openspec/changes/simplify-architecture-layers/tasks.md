## Discussion gate (required before any code move)

- [ ] Approve product map: Экраны → API → Домен(блоки) → Transport(+Codec) → Платформа
- [ ] Approve **contracts**: layer doors + sparse domain edges + Transport facade / Codec split (see store plan + design.md)
- [ ] Decide: Пользователи = профиль+онлайн one label, or online separate?
- [ ] Decide: ДогИнОут separate from Секьюрити, or nested?
- [ ] Decide: after map+contracts approve — boundaries-only first, or gather Transport out of `lib/` next?
- [ ] **STOP:** no `src/` layer moves until the boxes above are checked

## Repo / docs (after contracts gate)

- [ ] Update `docs/architecture.md` (product map + contracts + adjacent-only rule; no L1–L6 as primary)
- [ ] Optional ADR `0005-client-layers.md`

## Incremental mechanical steps (after gate — not yet authorized)

- [ ] Remove `src/lib/signaling/*` shims; fix imports to `@/packages/signaling`
- [ ] Place API/controllers convention; move one controller as pilot
- [ ] Optional: extend `lint:boundaries` / dependency-cruiser for adjacent-layer directions
- [ ] Nest clearly misplaced flat domain files under Domain block folders (mechanical)

## Explicit non-tasks

- Do **not** write application code or ports in `src/` before contracts gate
- Do **not** rewrite PeerSession / FilePipe / Link in this change
- Do **not** treat “phase 2 after layer code” as the contracts moment — contracts are **now**
- Do **not** put WebRTC/Signaling/Pinia/OPFS in outer map labels
- Do **not** mix Codec with connection lifecycle
