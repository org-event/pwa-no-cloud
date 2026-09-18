# Packages as deep modules

Each folder under `src/packages/<name>/` is a **deep module**: a lot of behaviour behind a small interface.

## Layout (copy-me)

```
src/packages/<name>/
  index.ts        ← entry point (public). Import this from outside.
  client.ts       ← another entry point is fine; packages may expose several.
  lib/            ← implementation: hidden from outside.
  tests/          ← co-located tests; import only through entry points.
```

Starter template: `src/packages/example/` (copy or delete).

## Rules

1. **Entry-point boundary.** Outside a package (app code or another package), import only that package's **root files** — never anything in its subfolders.
2. **Intra-package freedom.** Files inside one package may import each other freely.
3. **Tests through entry points.** Files under `<pkg>/tests/` may import any package's entry points and their own `tests/` fixtures, but never package internals (not even their own `lib/`).
4. **No cycles.** No dependency cycles among cruised files.

**No barrels.** Prefer several small root entry points over one giant `index.ts` that re-exports a whole subtree.

## Check

```bash
pnpm run lint:boundaries
```

This also runs as part of `pnpm run check`. Parser is SWC (`@swc/core`) because dependency-cruiser does not yet support TypeScript 7's compiler API.
