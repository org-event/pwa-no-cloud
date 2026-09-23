#!/usr/bin/env bash
# Refresh vendored mattpocock engineering skills into .agents/skills (copied),
# then re-symlink .claude/skills → .agents/skills.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

npx skills@latest add mattpocock/skills \
  -s triage -s domain-modeling -s grill-with-docs -s grilling \
  -s to-tickets -s to-spec -s wayfinder -s setup-matt-pocock-skills \
  -s ask-matt -s implement \
  -a universal -a cursor -a claude-code \
  --copy -y

mkdir -p .claude/skills
for d in .agents/skills/*/; do
  name="$(basename "$d")"
  # Keep local-only skills as real dirs; only re-link names that exist under agents
  if [[ -f ".agents/skills/$name/SKILL.md" ]]; then
    rm -rf ".claude/skills/$name"
    ln -s "../../.agents/skills/$name" ".claude/skills/$name"
  fi
done

echo "OK: skills refreshed. Review git diff; commit skills-lock.json if hashes changed."
