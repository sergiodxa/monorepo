# @sdxc/semver

SemVer 2.0.0 parsing, precedence ordering and range-free version comparisons.

## Installation

```bash
npm add @sdxc/semver
```

`parse()` reports failures as a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this package.

## Usage

### Comparing Two Versions

```typescript
import { satisfies } from "@sdxc/semver";

satisfies("1.9.0", "^", "1.4.2"); // true
satisfies("1.5.0", "~", "1.4.2"); // false
satisfies("2.0.0", ">", "1.99.99"); // true

satisfies("nightly", ">", "1.0.0"); // false — "nightly" is not a version
```

### Sorting A List Of Versions

```typescript
import { compare } from "@sdxc/semver";

["2026.10.1", "2026.9.4", "2026.9.30"].sort(compare);
// ["2026.9.4", "2026.9.30", "2026.10.1"]

["1.0.0", "1.0.0-rc.1", "1.0.0-beta.11", "1.0.0-beta.2"].sort(compare);
// ["1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0"]
```

### Reading A Version's Elements

```typescript
import { parse } from "@sdxc/semver";
import { isFailure } from "@sdxc/result";

let result = parse("v2.1.0-rc.3+build.9");

if (isFailure(result)) {
	console.error(result.error.message); // Invalid version: "v2.1.0-rc.3+build.9"
	return;
}

result.data; // { major: 2, minor: 1, patch: 0, prerelease: ["rc", "3"] }
```

## API

### `parse(text: string): Result<SemVer, InvalidSemVerError>`

Read a version string into its elements, returning a `Success<SemVer>` or a `Failure<InvalidSemVerError>` naming the rejected text. The grammar is SemVer 2.0.0 with one addition: an optional leading `v`, as a git tag or a user agent writes it. Build metadata is dropped, since it carries no precedence.

```typescript
parse("1.2.3"); // { status: "success", data: { major: 1, minor: 2, patch: 3, prerelease: [] } }
parse("v1.0.0-rc.1"); // prerelease: ["rc", "1"]
parse("01.2.3"); // { status: "failure", error: InvalidSemVerError } — a padded element
```

### `compare(a: string, b: string): number`

Order two version strings by SemVer 2.0.0 precedence, ready to hand to [`Array.prototype.sort`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort). Returns a negative number when `a` comes first, a positive one when `b` does, and `0` when the two rank equally.

The ordering is total, so a list whose entries come from somewhere unchecked — a registry, a tag listing, user input — sorts in one call. Text that is not a version ranks below every version and ties with other such text, which collects those entries at the front where the caller can see them.

```typescript
compare("1.9.0", "1.10.0"); // negative — elements compare as numbers
compare("1.0.0-rc.1", "1.0.0"); // negative — a prerelease precedes its release
compare("1.2.3+a", "1.2.3+b"); // 0 — build metadata carries no precedence
compare("latest", "0.0.0"); // negative — text that is not a version sorts first
```

### `satisfies(value: string, comparison: SemVerComparison, against: string): boolean`

Answer whether `value` stands in the named relation to `against`. Either side that is not a version answers `false`, so a field holding something else matches nothing instead of failing the check.

A prerelease takes part by precedence alone: `1.2.4-rc.1` satisfies `^ 1.2.3`, because it outranks `1.2.3` and shares its major. Test a release channel by comparing against the prerelease you mean — `satisfies(value, ">=", "1.2.4-rc.1")` — when that is the boundary you want.

```typescript
satisfies("1.2.3", "=", "1.2.3"); // true
satisfies("1.4.5", "~", "1.4.2"); // true, the same minor
satisfies("1.5.0", "~", "1.4.2"); // false, a later minor
satisfies("0.3.0", "^", "0.2.3"); // false, the left-most non-zero element moved
```

| Comparison | Holds when                                                             |
| ---------- | ---------------------------------------------------------------------- |
| `=`        | The two rank equally                                                   |
| `!=`       | The two rank differently                                               |
| `<`        | `value` precedes `against`                                             |
| `<=`       | `value` precedes `against` or ranks equally                            |
| `>`        | `value` follows `against`                                              |
| `>=`       | `value` follows `against` or ranks equally                             |
| `~`        | `value` is at least `against` and shares its major and minor           |
| `^`        | `value` is at least `against` and keeps its left-most non-zero element |

### `InvalidSemVerError`

Error describing text that fails the SemVer 2.0.0 grammar. It arrives inside a `Failure` value.

- `text`: `string` - The rejected text, kept verbatim for diagnostics
- `name`: `string` - Always `"InvalidSemVerError"`
- `message`: `string` - `Invalid version: "<text>"`, quoted so whitespace and empty strings stay visible in logs

### Types

#### `SemVer`

```typescript
interface SemVer {
	major: number;
	minor: number;
	patch: number;
	prerelease: string[];
}
```

A version taken apart for precedence. `prerelease` holds the dot-separated identifiers after the `-` and is empty for a release. Build metadata is absent, so two versions differing only in it are the same `SemVer`.

#### `SemVerComparison`

```typescript
type SemVerComparison = "=" | "!=" | "<" | "<=" | ">" | ">=" | "~" | "^";
```

The comparisons `satisfies()` accepts. It is a closed union, so an editor offers the eight as a list and a stored value round-trips through a schema.

### Precedence Rules

Versions compare element by element: major, then minor, then patch, each as a number rather than as text, so `1.10.0` follows `1.9.0`. Build metadata is ignored throughout.

A version carrying a prerelease precedes the same version without one. Two prereleases compare identifier by identifier: numerically when both identifiers are numeric, by character otherwise, with a numeric identifier ranking below a textual one. When one list runs out while the other continues, the shorter one comes first, so `1.0.0-alpha` precedes `1.0.0-alpha.1`.

## Pattern: Gating A Feature On A Client Version

Store the comparison and the version as data, and let an operator edit the rule without a deploy.

```typescript
import type { SemVerComparison } from "@sdxc/semver";

import { satisfies } from "@sdxc/semver";

interface VersionRule {
	comparison: SemVerComparison;
	version: string;
}

function allows(rule: VersionRule, clientVersion: string): boolean {
	return satisfies(clientVersion, rule.comparison, rule.version);
}

allows({ comparison: "^", version: "2.0.0" }, "2.4.1"); // true
allows({ comparison: ">=", version: "3.0.0" }, "2.4.1"); // false
```

## Pattern: Picking The Newest Published Version

Registries hand back whatever they hold, including placeholders and tags. Sorting with `compare()` needs no filtering pass first, because the newest version is the last entry either way.

```typescript
import { compare } from "@sdxc/semver";

function newest(versions: string[]): string | undefined {
	return [...versions].sort(compare).at(-1);
}

newest(["0.0.0-pre.1", "2026.9.4", "2026.10.1"]); // "2026.10.1"
newest(["0.0.0-pre.9", "0.0.0-pre.10"]); // "0.0.0-pre.10"
```

## Pattern: Deciding Whether An Upgrade Is Breaking

Parse both sides once and read the elements, when the question is about the shape of the change rather than about a threshold.

```typescript
import { parse } from "@sdxc/semver";
import { isFailure } from "@sdxc/result";

function isBreaking(from: string, to: string): boolean {
	let before = parse(from);
	let after = parse(to);

	if (isFailure(before) || isFailure(after)) return true;
	if (before.data.major !== 0) return after.data.major !== before.data.major;

	return after.data.minor !== before.data.minor;
}

isBreaking("1.4.2", "1.9.0"); // false
isBreaking("0.2.3", "0.3.0"); // true — below 1.0.0 the minor carries compatibility
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/semver": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
