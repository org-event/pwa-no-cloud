#!/usr/bin/env bash
# Local gate before opening/updating a PR.
# Usage: ./scripts/pre-pr.sh [--audit]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

AUDIT=0
for arg in "$@"; do
  case "$arg" in
    --audit) AUDIT=1 ;;
    -h|--help)
      echo "Usage: $0 [--audit]"
      echo "  Runs: pnpm run check && pnpm test -- --run"
      echo "  --audit  also runs pnpm audit"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ ! -f package.json ]]; then
  echo "error: run from repo root (package.json missing)" >&2
  exit 1
fi

echo "==> pnpm run check"
pnpm run check

echo "==> pnpm test -- --run"
pnpm test -- --run

if [[ "$AUDIT" -eq 1 ]]; then
  echo "==> pnpm audit"
  pnpm audit
fi

echo "OK: pre-pr gate passed"
