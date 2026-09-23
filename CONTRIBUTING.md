# Contributing to NoCloud

## Development

```bash
pnpm install
pnpm run check
pnpm test -- --run
pnpm run dev
```

Local relay: `pnpm run serve` (after `pnpm run build` if you need static files).

## Pull requests

1. Prefer a feature branch and an open PR into `main`.
2. Local gate: `./scripts/pre-pr.sh` (or `pnpm run check` + `pnpm test -- --run`).
3. CI must be green: `check + test`, `pnpm audit`, CodeQL, dependency review.
4. Keep commits focused; do not commit secrets or TURN credentials.
5. User-visible changes should update `docs/usage.md` when relevant.
6. **Merge to `main` is human-only** — see [docs/agents/human-merge.md](./docs/agents/human-merge.md). Agents open draft PRs via `ship-from-brief` / `./scripts/afk-run.sh`.

## Security

Do not file public issues for vulnerabilities — see [.github/SECURITY.md](./.github/SECURITY.md)
and [docs/threat-model.md](./docs/threat-model.md).

## License

MIT — see [LICENSE](./LICENSE).
