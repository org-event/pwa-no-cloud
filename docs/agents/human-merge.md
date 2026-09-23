# Human merge gate

**Merging to `main` is human-only.** Agents may open and update **draft** (or ready-for-review) pull requests, run CI, and comment on issues. Agents must not:

- merge PRs into `main`
- dismiss required reviews or self-approve as a substitute for a maintainer
- push directly to `main`
- auto-merge via bots or scripts

Sensitive areas (identity / OwnedSecret / vault / WebAuthn, TURN credentials, relay trust, threat-model expansions, messenger trust UX) additionally stay `ready-for-human` or require an explicit human ACK before an agent ships a PR — see [docs/threat-model.md](../threat-model.md) and [.github/SECURITY.md](../../.github/SECURITY.md).

AFK entry (`./scripts/afk-run.sh` + `ship-from-brief`) stops at the draft PR.
