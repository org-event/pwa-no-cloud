## Summary

<!-- What changed and why (1–5 bullets). -->

## Agent brief / issue

<!-- Link the GitHub issue (`ready-for-agent`) and paste or link the Agent brief. -->

- Issue:
- Brief:

## OpenSpec change

<!-- `openspec/changes/<id>/` or "none" for brief-only tickets. -->

- Change id:
- `skip_specs`: yes / no / n/a

## Test plan

- [ ] `./scripts/pre-pr.sh` (or `pnpm run check` + `pnpm test -- --run`)
- [ ] Relevant focused tests if the change is narrow
- [ ] Manual / UI notes if applicable

## Invariants checklist

- [ ] Control plane ≠ media plane (no file/media bytes on the relay)
- [ ] OwnedSecret lifecycle respected (no long-lived secretKey in UI closures)
- [ ] User-visible strings in `src/content/ru/` when UI text changed
- [ ] No secrets / TURN credentials in the diff

## Merge

**Human-only.** Do not auto-merge. See `docs/agents/human-merge.md`.
