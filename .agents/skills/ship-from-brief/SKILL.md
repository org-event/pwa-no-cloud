---
name: ship-from-brief
description: Claim a ready-for-agent GitHub issue, implement from its agent brief, run local gates, and open a draft PR. Use for AFK delivery of triaged tickets. Never merge to main.
---

# Ship from brief (NoCloud)

Drive one `ready-for-agent` issue to a **draft PR**. Human merge remains required.

## Preconditions

1. Read [docs/agents/issue-tracker.md](../../../docs/agents/issue-tracker.md) and [docs/agents/triage-labels.md](../../../docs/agents/triage-labels.md).
2. Issue must have label `ready-for-agent` and an **agent brief** (body section or linked comment — see triage `AGENT-BRIEF.md`).
3. If the brief is missing or incomplete → stop, apply `needs-info` / ask, do **not** invent scope.
4. Security / secrets / OwnedSecret / TURN / ethics-sensitive work → prefer `ready-for-human`; do not auto-ship those.

## Steps

1. **List / pick**
   ```bash
   ./scripts/agent-ready.sh list
   ./scripts/agent-ready.sh show <n>
   ```
2. **Claim** (first write)
   ```bash
   ./scripts/agent-ready.sh claim <n>
   ```
3. **Branch** from latest `main`: `cursor/<short-slug>-<suffix>` (or repo convention).
4. **Implement** only what the brief requires. If an OpenSpec change id is listed, follow that change’s tasks; do not expand into unapproved architecture work.
5. **Local gate**
   ```bash
   ./scripts/pre-pr.sh
   ```
6. **Draft PR** — fill [.github/PULL_REQUEST_TEMPLATE.md](../../../.github/PULL_REQUEST_TEMPLATE.md):
   - Agent brief / issue number
   - OpenSpec change id (if any)
   - Test plan
7. **Comment on the issue** with the PR URL. Leave the issue open until a human merges and closes.
8. **Stop.** Do not merge, do not approve your own PR, do not delete human-gate labels.

## One-shot AFK entry

```bash
./scripts/afk-run.sh
```

Picks the first unassigned `ready-for-agent` issue (or `$ISSUE`), claims it, and prints the ship-from-brief checklist for the agent session. Empty queue → exit 0 with a clear message.

## Hard stops

- No brief → do not implement.
- `pnpm run check` or tests fail → fix or reopen as `needs-info` / `ready-for-human`; do not open a broken “LGTM” PR.
- Anything that contradicts ADR / threat-model → escalate to human.
