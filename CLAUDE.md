# CLAUDE.md — Project rules for AI-assisted development

These rules apply to all AI-assisted work in this repository.

---

## Architecture contract

This codebase is split into **pure-logic modules** and **I/O modules**. Never violate the boundary.

| Module | Rule |
|--------|------|
| `types/` | Interfaces only. No logic, no imports from other src modules. |
| `chemistry/` | No Node.js I/O. Implements `ChemistryEngine` interface. |
| `formations/` | Pure data. No logic beyond the `slot()` helper. |
| `scorer/` | No I/O. Pure functions over typed inputs. |
| `optimizer/` | No I/O. Depends only on `types/`, `scorer/`. |
| `explainer/` | No I/O. Depends only on `types/`, `scorer/`, `optimizer/`. |
| `adapters/` | I/O allowed (fs). Depends only on `types/`. |
| `cli/` | I/O hub. May import anything. |

---

## Naming and style

- Use `camelCase` for variables and functions, `PascalCase` for types/classes.
- No `any`. Avoid type assertions (`as X`) unless unavoidable, and add a comment explaining why.
- Explicit return types on exported functions.
- Constants that configure behaviour (thresholds, weights) go at the **top of the file** with a comment explaining what they control.

---

## Chemistry engine

The chemistry model is intentionally isolated behind `ChemistryEngine`. If EA changes rules in a new season:
- Create `chemistry/fc26.ts` implementing the interface.
- Do **not** modify `fc25.ts`.
- Pass the new engine instance into `findBestLineups()`.

Document all assumptions in the file header (see existing `fc25.ts` as the template).

---

## Adding formations

Formation definitions live in `src/formations/index.ts` as pure data. Each formation must:
- Have exactly 11 slots.
- Use the `slot()` helper.
- Be added to `ALL_FORMATIONS` and `FORMATION_MAP`.
- Have slots that accept realistic position codes (cross-check real FC UI).

---

## Adding CSV adapters

New adapters go in `src/adapters/index.ts`:
1. Implement `CSVAdapter`.
2. Add to the `AdapterRegistry` constructor call **before** `GenericAdapter`.
3. `canHandle()` must be deterministic and fast (header inspection only).
4. `normalize()` must never throw — return `null` for unrecognisable rows.

---

## Tests

- Tests live in `tests/`. No test logic in `src/`.
- Every new engine, scorer variant, or adapter needs at least: happy path, edge case, failure case.
- Use `makePlayer()` / `makeLineup()` fixtures — don't repeat player construction inline.
- No real file I/O in unit tests. Mock or use inline data.
- All tests must be deterministic (no `Date.now()`, no random).

---

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(module): short description
fix(module): what was wrong
test: what coverage was added
docs: what was documented
chore: build, config, deps
refactor(module): what changed and why
```

Keep commits atomic: one logical change per commit. If you're touching more than two modules, split.

---

## What NOT to do

- Do not add `console.log` to non-CLI modules.
- Do not add optional config parameters "just in case" — add them when there's a real use case.
- Do not reformat files that weren't touched by the current change.
- Do not commit `club.csv` or any personal card data.
- Do not add `dist/` to git.
