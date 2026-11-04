# ADR-190: `@sdxc/bench` for size and HTTP budgets

## Status

**Accepted** - 2026-11-04

## Background

The monorepo already invents the same two measurements in place: entry-point weight
(`test/markdown-weight.ts` for `@sdxc/markdown`) and ad-hoc HTTP timing against a running
app. Dozens of package tests also hand-roll `performance.now()` ceilings for pathological
inputs. Without a shared package, each new budget copies a minified browser bundle or a
curl loop, and doctor’s `module-size` check (source lines) is easy to confuse with
bundle bytes.

## Context

- Bundle weight is a **package** concern (gzipped entry after a minified browser bundle),
  not an app doctor check. ADR-058 already ratchets markdown on size in CI.
- Weighing uses **esbuild** in-process so the package stays independent of Bun’s CLI.
- Vitest 4.1 ships suite-level `bench()` via `vp test bench`; Vitest 5 adds
  `bench.compare` and `toBeFasterThan` inside normal tests. Custom timing matchers would
  duplicate that path and fight the pin.
- Package CLIs follow ADR-187 (`sdxc-<name>`, `@sdxc/cli`, kit catalog for `sdxc pkg`).
- Time budgets elsewhere already speak `@sdxc/duration`’s `DurationInput`.

## Decision

1. Publish **`@sdxc/bench`** with `weigh` / `assertWeight` (gzipped first-class),
   `sampleHttp` / `assertHttpBudgets`, and `sdxc-bench` (`weigh`, `http`).
2. Wire the CLI through **`sdxc pkg bench` / `bunx sdxc-bench`** only — no first-class
   `sdxc bench` yet.
3. **Do not** add a doctor check for bundle weight or wall-clock timing.
4. **Do not** ship custom Vitest timing matchers; document Vitest’s `bench` /
   `toBeFasterThan` and add suite `*.bench.ts` files for parsers opportunistically.
5. Duration flags accept **duration strings and bare millisecond numbers**.
6. Migrate markdown weight tests onto the package and assert **gzipped** budgets.

## Consequences

### Positive

- One weigh implementation; markdown and future packages share budgets.
- Operators get a latency CLI without inventing curl scripts.
- Clear split: gzipped entry weight in tests, source LOC still in doctor `module-size`.

### Negative

- Vitest 5 compare assertions wait on a Vitest upgrade; Vitest 4 benches are measurement-only.
- `bun run release:bootstrap @sdxc/bench` still needs a human with npm access for the first
  registry publish.

### Neutral

- Pathological linear-time tests keep hand-rolled `toBeLessThan` ceilings until someone
  touches those packages.

## Alternatives considered

- **`@sdxc/benchmark`:** longer name; rejected for house short-name style.
- **Doctor `bundle-weight`:** wrong layer for package entries; apps do not declare them.
- **Custom `toBeFasterThan(ms)` matchers:** overlaps Vitest’s own bench/compare API.
- **First-class `sdxc bench`:** premature; ADR-187 keeps project-unaware tools on `sdxc pkg`.

## References

- ADR-007 (dated releases), ADR-058 (markdown size), ADR-187 (package command lines)
- Proposal: Project store `docs/bench-package-proposal.md`
