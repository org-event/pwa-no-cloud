#!/usr/bin/env bash
# List / show / claim GitHub issues labelled ready-for-agent.
# Requires: gh (authenticated), jq optional (falls back to gh --json jq expressions).
# Usage:
#   ./scripts/agent-ready.sh list
#   ./scripts/agent-ready.sh show <n>
#   ./scripts/agent-ready.sh claim <n>
#   ./scripts/agent-ready.sh next          # print first unassigned ready issue number
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LABEL="${AGENT_READY_LABEL:-ready-for-agent}"
BRIEF_MARKERS=('## Agent brief' '## Agent Brief' '### Agent brief' 'Agent brief:')

die() { echo "error: $*" >&2; exit 1; }

need_gh() {
  command -v gh >/dev/null 2>&1 || die "gh CLI not found; install GitHub CLI and authenticate"
}

has_brief() {
  local body="$1"
  local m
  for m in "${BRIEF_MARKERS[@]}"; do
    if grep -Fq "$m" <<<"$body"; then
      return 0
    fi
  done
  return 1
}

cmd_list() {
  need_gh
  local rows
  rows="$(gh issue list --state open --label "$LABEL" \
    --json number,title,assignees,url \
    --jq '.[] | [
      ("#" + (.number|tostring)),
      .title,
      (([.assignees[].login] | join(",")) | if . == "" then "-" else . end),
      .url
    ] | @tsv')"
  if [[ -z "$rows" ]]; then
    echo "No open issues with label ${LABEL}."
    return 0
  fi
  printf '%s\n' "$rows"
}

cmd_show() {
  need_gh
  local n="${1:-}"
  [[ -n "$n" ]] || die "usage: $0 show <issue-number>"
  local json body assignees labels
  json="$(gh issue view "$n" --json number,title,body,labels,assignees,url)"
  assignees="$(echo "$json" | jq -r '[.assignees[].login] | join(", ")')"
  [[ -n "$assignees" ]] || assignees="(none)"
  labels="$(echo "$json" | jq -r '[.labels[].name] | join(", ")')"
  echo "$json" | jq -r '"#\(.number) \(.title)\n\(.url)"'
  echo "labels: $labels"
  echo "assignees: $assignees"
  body="$(echo "$json" | jq -r '.body // ""')"
  if has_brief "$body"; then
    echo "brief: present"
  else
    echo "brief: MISSING — add an '## Agent brief' section before claiming/shipping" >&2
  fi
  echo "----- body -----"
  printf '%s\n' "$body"
}

cmd_claim() {
  need_gh
  local n="${1:-}"
  [[ -n "$n" ]] || die "usage: $0 claim <issue-number>"
  local json body labels
  json="$(gh issue view "$n" --json body,labels,assignees,state)"
  state="$(echo "$json" | jq -r '.state')"
  [[ "$state" == "OPEN" ]] || die "issue #$n is not open"
  labels="$(echo "$json" | jq -r '[.labels[].name] | join("\n")')"
  grep -Fxq "$LABEL" <<<"$labels" || die "issue #$n lacks label $LABEL"
  body="$(echo "$json" | jq -r '.body // ""')"
  if ! has_brief "$body"; then
    die "issue #$n has no Agent brief; refuse to claim (see docs/agents/skills.md)"
  fi
  assignees="$(echo "$json" | jq -r '[.assignees[].login] | length')"
  if [[ "$assignees" -gt 0 ]]; then
    echo "warning: issue #$n already has assignees; still assigning @me" >&2
  fi
  gh issue edit "$n" --add-assignee "@me"
  gh issue comment "$n" --body "Claimed for AFK ship-from-brief by $(gh api user --jq .login). Draft PR will follow; merge stays human-only."
  echo "Claimed #$n"
}

cmd_next() {
  need_gh
  # Prefer unassigned ready-for-agent issues, oldest first.
  local n
  n="$(gh issue list --state open --label "$LABEL" --limit 50 \
    --json number,assignees \
    --jq '[.[] | select((.assignees | length) == 0)] | sort_by(.number) | .[0].number // empty')"
  if [[ -z "$n" ]]; then
    echo "none"
    return 0
  fi
  echo "$n"
}

usage() {
  cat <<EOF
Usage: $0 <list|show|claim|next> [args]

  list           Open issues with label ${LABEL}
  show <n>       Show issue + whether Agent brief is present
  claim <n>      Assign @me and comment (requires brief)
  next           Print first unassigned ready issue number, or "none"

Env:
  AGENT_READY_LABEL   default: ready-for-agent
EOF
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    list) cmd_list "$@" ;;
    show) cmd_show "$@" ;;
    claim) cmd_claim "$@" ;;
    next) cmd_next "$@" ;;
    -h|--help|"") usage; [[ -n "$cmd" ]] || exit 0 ;;
    *) die "unknown command: $cmd" ;;
  esac
}

main "$@"
