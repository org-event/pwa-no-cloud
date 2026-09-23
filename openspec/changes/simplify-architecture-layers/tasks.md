## Discussion gate (required before any code move)

- [ ] Approve product map: Экраны → API → Домен(блоки) → Transport → Платформа
- [ ] Decide: Пользователи = профиль+онлайн one label, or online separate?
- [ ] Decide: ДогИнОут separate from Секьюрити, or nested?
- [ ] Decide: after approve — boundaries-only first, or gather Transport out of `lib/` next?

## Repo / docs (after approval)

- [ ] Update `docs/architecture.md` (product map + adjacent-only rule; no L1–L6 as primary)
- [ ] Optional ADR `0005-client-layers.md`
- [ ] Open **phase-2** change stub only: `split-domain-blocks-by-interface` (same Domain names, ports between them)

## Incremental mechanical steps (after approval — not yet authorized)

- [ ] Remove `src/lib/signaling/*` shims; fix imports to `@/packages/signaling`
- [ ] Place API/controllers convention; move one controller as pilot
- [ ] Optional: extend `lint:boundaries` / dependency-cruiser for adjacent-layer directions
- [ ] Nest clearly misplaced flat domain files under Domain block folders (mechanical)

## Explicit non-tasks

- Do **not** rewrite PeerSession / FilePipe / Link in this change
- Do **not** start phase-2 domain interface split here
- Do **not** put WebRTC/Signaling/Pinia/OPFS in outer map labels
