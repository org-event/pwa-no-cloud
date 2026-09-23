#!/usr/bin/env bash
# Minimal AFK entry: pick one ready-for-agent issue and drive ship-from-brief prep.
# Does NOT merge. Does NOT open a PR by itself — prints the checklist for the agent.
#
# Usage:
#   ./scripts/afk-run.sh           # pick next unassigned ready issue
#   ISSUE=42 ./scripts/afk-run.sh  # force issue number
#   ./scripts/afk-run.sh --dry-claim-skip   # list/show only (no claim) — default claims
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CLAIM=1
for arg in "$@"; do
  case "$arg" in
    --dry-claim-skip|--no-claim) CLAIM=0 ;;
    -h|--help)
      sed -n '1,20p' "$0"
      exit 0
      ;;
  esac
done

echo "==> AFK runner (human merge still required; no auto-merge)"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh not available" >&2
  exit 1
fi

ISSUE_NUM="${ISSUE:-}"
if [[ -z "$ISSUE_NUM" ]]; then
  ISSUE_NUM="$("$ROOT/scripts/agent-ready.sh" next)"
fi

if [[ "$ISSUE_NUM" == "none" || -z "$ISSUE_NUM" ]]; then
  echo "Queue empty: no unassigned open issues with label ready-for-agent."
  echo "Triage something with /triage, attach an ## Agent brief, label ready-for-agent, then re-run."
  exit 0
fi

echo "==> Selected #$ISSUE_NUM"
"$ROOT/scripts/agent-ready.sh" show "$ISSUE_NUM"

if [[ "$CLAIM" -eq 1 ]]; then
  echo "==> Claiming #$ISSUE_NUM"
  "$ROOT/scripts/agent-ready.sh" claim "$ISSUE_NUM"
else
  echo "==> Skipping claim (--no-claim)"
fi

cat <<EOF

==> ship-from-brief checklist for #$ISSUE_NUM
1. Create branch from main (cursor/<slug>-…).
2. Implement only the Agent brief (and linked OpenSpec change id if any).
3. ./scripts/pre-pr.sh
4. Open a DRAFT PR using .github/PULL_REQUEST_TEMPLATE.md
5. Comment the PR URL on the issue.
6. Stop — a human merges to main.

Skill: .agents/skills/ship-from-brief/SKILL.md
Docs:  docs/agents/human-merge.md
EOF
