---
name: sdxc-semver
description: "@sdxc/semver parses SemVer 2.0.0 and compares versions without range strings: `parse()` answering a `Result<SemVer, InvalidSemVerError>`, `compare()` ready for `Array.prototype.sort`, and `satisfies(value, comparison, against)` over the closed `SemVerComparison` union `= != < <= > >= ~ ^`. Use when sorting a list of versions or dated releases, gating a feature on a client version, deciding whether an upgrade is breaking, or ranking tags from a registry."
---

# @sdxc/semver

Three functions and one error. `parse(text)` reads a version into `{ major, minor, patch,
prerelease }`, accepting an optional leading `v` and dropping build metadata, and reports a
rejection as a `Failure<InvalidSemVerError>` naming the text verbatim. `compare(a, b)` orders two
version strings by SemVer 2.0.0 precedence and hands straight to `sort`. `satisfies(value,
comparison, against)` answers whether a relation holds, over a closed union of eight comparisons
rather than a range grammar. Plain TypeScript, no runtime assumptions.

Full API, options and examples: [packages/semver/README.md](packages/semver/README.md)

## When to reach for it

- A list of versions arrived from somewhere unchecked — a registry, a tag listing, user input — and needs sorting in one call
- A feature should be gated on a client version, with the comparison stored as editable data rather than compiled in
- An upgrade's shape matters: whether moving from one version to another is breaking
- Dated releases written `YYYY.M.D` need ordering, where `2026.9.30` must come before `2026.10.1`

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/semver": "workspace:*" } }
```

```ts
import { compare, satisfies } from "@sdxc/semver";

satisfies("1.9.0", "^", "1.4.2"); // true
satisfies("1.5.0", "~", "1.4.2"); // false

["2026.10.1", "2026.9.4", "2026.9.30"].sort(compare);
// ["2026.9.4", "2026.9.30", "2026.10.1"]
```

## Suggestions

- `compare` is a total ordering: text that is not a version ranks below every version and ties with other such text, so a list needs no filtering pass first and the placeholders collect at the front where they are visible.
- `satisfies` answers `false` when either side is not a version, so a field holding something else matches nothing instead of failing the check.
- A prerelease takes part by precedence alone — `1.2.4-rc.1` satisfies `^ 1.2.3`. To test a release channel, compare against the prerelease you mean, as in `satisfies(value, ">=", "1.2.4-rc.1")`.
- Build metadata carries no precedence, so two versions differing only in it parse to the same `SemVer` and `compare` to `0`.
- Reach for `parse` over `satisfies` when the question is about the shape of a change rather than a threshold; `SemVerComparison` is a closed union, so a stored comparison round-trips through a schema and an editor offers the eight.

## Related

- `@sdxc/result` — `parse` reports failure as its `Result`, narrowed with `isFailure`; skill `sdxc-result`
