# @sdxc/semver

SemVer 2.0.0 parsing, precedence ordering and range-free version comparisons.

## Installation

```sh
npm add @sdxc/semver
```

`parse()` answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this package.

## Usage

### Compare two versions

```typescript
import { satisfies } from "@sdxc/semver";

satisfies("2.0.0", ">", "1.99.99"); // true
satisfies("1.9.0", "^", "1.4.2"); // true, same major
satisfies("1.5.0", "~", "1.4.2"); // false, a later minor
satisfies("nightly", ">", "1.0.0"); // false, not a version
```

### Sort a list of versions

```typescript
import { compare } from "@sdxc/semver";

["2026.10.1", "2026.9.4", "2026.9.30"].sort(compare);
// ["2026.9.4", "2026.9.30", "2026.10.1"]

["1.0.0", "1.0.0-rc.1", "1.0.0-beta.11", "1.0.0-beta.2"].sort(compare);
// ["1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0"]
```

### Read a version's elements

```typescript
import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/semver";

let result = parse("v2.1.0-rc.3+build.9");

if (isFailure(result)) {
	result.error.message; // Invalid version: "..."
} else {
	result.data; // { major: 2, minor: 1, patch: 0, prerelease: ["rc", "3"] }
}
```

## API

### `parse(text: string): Result<SemVer, InvalidSemVerError>`

Reads a version into its elements, or fails with an `InvalidSemVerError`. The grammar is SemVer 2.0.0 plus an optional leading `v`; build metadata is dropped, and padded elements such as `01.2.3` are rejected.

### `compare(a: string, b: string): number`

Orders two version strings by precedence, ready for [`Array.prototype.sort`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort): negative when `a` comes first, positive when `b` does, `0` when they rank equally. Text that is not a version ranks below every version and ties with other such text, so any list sorts in one call.

### `satisfies(value: string, comparison: SemVerComparison, against: string): boolean`

Whether `value` stands in the named relation to `against`. Either side that is not a version answers `false`. A prerelease takes part by precedence alone, so `1.2.4-rc.1` satisfies `^ 1.2.3`.

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

The error inside a failed `parse()`. `text` holds the rejected input verbatim, `name` is `"InvalidSemVerError"`, and `message` is `Invalid version: "<text>"` with the text JSON-quoted so whitespace and empty strings stay visible.

### Precedence

Major, minor and patch compare as numbers, so `1.10.0` follows `1.9.0`; build metadata never counts. A prerelease precedes its release. Prerelease identifiers compare one by one: numerically when both are numeric, by character otherwise, a numeric identifier below a textual one, and a shorter list first when the other continues (`1.0.0-alpha` precedes `1.0.0-alpha.1`).

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

A parsed version. `prerelease` holds the dot-separated identifiers after the `-`, empty for a release.

#### `SemVerComparison`

```typescript
type SemVerComparison = "=" | "!=" | "<" | "<=" | ">" | ">=" | "~" | "^";
```

The comparisons `satisfies()` accepts, a closed union that stores and validates as plain data.

## Pattern: Gating A Feature On A Client Version

Keep the rule as data so an operator can change it without a deploy.

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
allows({ comparison: ">=", version: "3.0.0" }, "unknown"); // false
```

## Pattern: Picking The Newest Stable Version

Sort with `compare()`, then skip prereleases by reading the parsed elements. Entries that are not versions sort to the front and never win.

```typescript
import { isSuccess } from "@sdxc/result";
import { compare, parse } from "@sdxc/semver";

function newestStable(versions: string[]): string | undefined {
	return [...versions]
		.sort(compare)
		.reverse()
		.find((version) => {
			let result = parse(version);
			return isSuccess(result) && result.data.prerelease.length === 0;
		});
}

newestStable(["latest", "1.4.0", "2.0.0-rc.1", "1.10.0"]); // "1.10.0"
```

## Pattern: Checking Whether An Upgrade Is Compatible

`^` answers "same compatibility line, and not a downgrade", including the `0.x` and `0.0.x` cases.

```typescript
import { satisfies } from "@sdxc/semver";

function isCompatibleUpgrade(from: string, to: string): boolean {
	return satisfies(to, "^", from);
}

isCompatibleUpgrade("1.4.2", "1.9.0"); // true
isCompatibleUpgrade("1.4.2", "2.0.0"); // false
isCompatibleUpgrade("0.2.3", "0.3.0"); // false, below 1.0.0 the minor is the line
```

## Pattern: Reporting Invalid Entries

Validate input once with `parse()` and name each rejection from the error's `text`.

```typescript
import type { SemVer } from "@sdxc/semver";

import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/semver";

function readVersions(input: string[]): { versions: SemVer[]; rejected: string[] } {
	let versions: SemVer[] = [];
	let rejected: string[] = [];

	for (let text of input) {
		let result = parse(text);
		if (isFailure(result)) rejected.push(result.error.text);
		else versions.push(result.data);
	}

	return { versions, rejected };
}

readVersions(["1.0.0", "v2.1.0", "1.2", " 3.0.0"]);
// two SemVer values, rejected: ["1.2", " 3.0.0"]
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
