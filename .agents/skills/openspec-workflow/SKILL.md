---
name: openspec-workflow
description: Run NoCloud's OpenSpec cycle — intent → change (proposal/design/tasks) → implement → archive. Use when the user wants OpenSpec, a structured change proposal, or to apply/archive an openspec/changes/* item. Prefer this over inventing a parallel process.
---

# OpenSpec workflow (NoCloud)

Canonical cycle for non-trivial work:

1. **Intent** — idea / bug / issue (may start from `/triage` or a grill).
2. **Change** — `openspec/changes/<id>/` with proposal → design → tasks (and specs unless `skip_specs: true`).
3. **Implement** — apply tasks; respect ADR, OwnedSecret, control≠media.
4. **Archive** — after human merge, archive the change.

## When OpenSpec vs issue brief

| Use OpenSpec | Use issue agent brief only |
|---|---|
| Cross-cutting structure, protocol, domain boundaries | Small scoped ticket already `ready-for-agent` |
| New/changed product requirements (spec deltas) | Docs typo, one-file fix with clear DoD |
| Change needs discussion before code | Brief already has acceptance criteria |

Do **not** invent a second triage system — labels stay in [docs/agents/triage-labels.md](../../../docs/agents/triage-labels.md).

## Commands / sibling skills

Prefer the installed OpenSpec skills (same behavior as `/opsx-*` commands):

| Step | Skill / command |
|---|---|
| Explore before committing | `openspec-explore` / `/opsx-explore` |
| Propose a change | `openspec-propose` / `/opsx-propose` |
| Update artifacts | `openspec-update-change` / `/opsx-update` |
| Implement tasks | `openspec-apply-change` / `/opsx-apply` |
| Sync specs (if any) | `openspec-sync-specs` / `/opsx-sync` |
| Archive after merge | `openspec-archive-change` / `/opsx-archive` |

CLI: `@fission-ai/openspec` (`npx openspec …` or a global install). See [docs/agents/skills.md](../../../docs/agents/skills.md).

## NoCloud hard rules while applying

- Relays never carry file/media bytes.
- Do not weaken `OwnedSecret` wipe / lifecycle.
- UI strings stay in `src/content/ru/`.
- Open a **draft** PR; **merge to main is human-only** ([docs/agents/human-merge.md](../../../docs/agents/human-merge.md)).
- Before PR: `./scripts/pre-pr.sh`.

## Current structural change (discussion only)

`openspec/changes/simplify-architecture-layers/` is proposal/tasks for stakeholder discussion. Do **not** execute layer code moves until that change is approved.
