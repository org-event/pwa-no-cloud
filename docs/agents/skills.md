# Agent skills

How skills are installed, updated, and used in this repo. Triage roles stay in [triage-labels.md](./triage-labels.md); tracker ops stay in [issue-tracker.md](./issue-tracker.md). Do not invent a second triage vocabulary.

## Where skills live

| Path | Role |
|---|---|
| `.agents/skills/<name>/` | **Canonical** project skills (committed). Cursor and other agents discover this tree. |
| `.claude/skills/<name>` | Symlinks → `.agents/skills/<name>` for Claude Code. |
| `.cursor/commands/` | OpenSpec slash commands (`/opsx-*`); committed. |
| `.cursor/skills/` | Local OpenSpec skill links (gitignored with the rest of `.cursor/*` except `commands/`). Prefer `.agents/skills`. |

Lockfile: `skills-lock.json` (from [skills.sh](https://skills.sh/)).

## Installed now (P0)

### mattpocock/skills (MIT)

Engineering set expected by `docs/agents/*`:

- `triage`, `grill-with-docs`, `grilling`, `domain-modeling`, `to-tickets`, `to-spec`, `wayfinder`, `implement`, `ask-matt`, `setup-matt-pocock-skills`

Install / refresh:

```bash
npx skills@latest add mattpocock/skills \
  -s triage -s domain-modeling -s grill-with-docs -s grilling \
  -s to-tickets -s to-spec -s wayfinder -s setup-matt-pocock-skills \
  -s ask-matt -s implement \
  -a universal -a cursor -a claude-code \
  --copy -y
```

Then re-symlink Claude copies if the installer re-duplicated files:

```bash
for d in .agents/skills/*/; do
  name=$(basename "$d")
  rm -rf ".claude/skills/$name"
  ln -s "../../.agents/skills/$name" ".claude/skills/$name"
done
```

Update pinned hashes: `npx skills@latest update -y` (project scope).

Attribution: vendored copies keep upstream MIT copyright; see [THIRD_PARTY_SKILLS.md](./THIRD_PARTY_SKILLS.md) and [https://github.com/mattpocock/skills](https://github.com/mattpocock/skills).

### OpenSpec workflows

From `@fission-ai/openspec` (`openspec init`): `openspec-propose`, `openspec-explore`, `openspec-apply-change`, `openspec-update-change`, `openspec-archive-change`, `openspec-sync-specs` under `.agents/skills/`, plus Cursor commands in `.cursor/commands/`.

CLI:

```bash
npx --yes @fission-ai/openspec@latest --help
# or: npm i -g @fission-ai/openspec
openspec update   # refresh AI instruction files after CLI upgrades
```

Config: `openspec/config.yaml` (schema `spec-driven`).

### Local thin skills

| Skill | Purpose |
|---|---|
| `openspec-workflow` | Repo-specific intent → change → implement → archive map; points at OpenSpec skills + human merge. |
| `ship-from-brief` | Claim `ready-for-agent` → implement brief → `pre-pr` → draft PR (no merge). |

## AFK scripts

```bash
./scripts/agent-ready.sh list          # ready-for-agent issues
./scripts/agent-ready.sh show <n>      # require ## Agent brief
./scripts/agent-ready.sh claim <n>     # assign @me
./scripts/afk-run.sh                   # pick one + claim + checklist
./scripts/pre-pr.sh                    # pnpm run check && pnpm test -- --run
./scripts/pre-pr.sh --audit            # + pnpm audit
```

Package aliases: `pnpm run pre-pr`, `pnpm run agent-ready`, `pnpm run afk`.

**Merge to main is human-only** — see [human-merge.md](./human-merge.md).

## First-time setup note

`docs/agents/issue-tracker.md`, `triage-labels.md`, and `domain.md` already encode the setup-matt-pocock-skills answers for this repo. Re-run `/setup-matt-pocock-skills` only if those files drift.
