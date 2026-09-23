## Discussion gate (required before any code move)

- [ ] Discuss and approve layer list / non-goals with stakeholders
- [ ] Confirm physical home for L2 and Link vs PeerSession naming
- [ ] Confirm ADR vs architecture.md-only for the layer doc

## Repo / docs (after approval)

- [ ] Update `docs/architecture.md` (layer diagram + dependency rule)
- [ ] Optional ADR `0005-client-layers.md`
- [ ] Open **phase-2** change stub only: `split-domain-blocks-by-interface` (proposal outline, no impl)

## Incremental mechanical steps (after approval — not yet authorized)

- [ ] Remove `src/lib/signaling/*` shims; fix imports to `@/packages/signaling`
- [ ] Decide L2 directory convention; move one controller as pilot
- [ ] Optional: extend `lint:boundaries` / dependency-cruiser for layer directions
- [ ] Nest clearly misplaced flat domain files (mechanical)

## Explicit non-tasks

- Do **not** rewrite PeerSession / FilePipe / Link in this change
- Do **not** start phase-2 domain interface split here
