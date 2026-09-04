# @sdxc/duration

Compile-time-checked duration strings, and the conversions from them to milliseconds and seconds.

## Installation

```bash
npm add @sdxc/duration
```

`parse()` reports failures as a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this package.

## Usage

### Basic Example

```typescript
import { toMs, toSeconds } from "@sdxc/duration";

toMs("5 minutes"); // 300000
toMs("30s"); // 30000
toMs(1500); // 1500 — a bare number is already milliseconds

toSeconds("1 hour"); // 3600
toSeconds("30 days"); // 2592000

toMs("5 minuts"); // Type error: "minuts" is not a unit
```

### Accepting A Duration In Your Own API

Declare the parameter as `DurationInput` and convert once, so callers may pass either form and your function states its own unit exactly once.

```typescript
import type { DurationInput } from "@sdxc/duration";

import { toSeconds } from "@sdxc/duration";

interface CacheOptions {
	ttl: DurationInput;
}

function write(key: string, value: string, options: CacheOptions) {
	return cache.set(key, value, { ttlSeconds: toSeconds(options.ttl) });
}

write("session", value, { ttl: "30 days" });
write("session", value, { ttl: 2_592_000_000 }); // still valid
```

### Parsing Text That Arrives At Runtime

Configuration values and form fields are plain strings, where the compile-time type cannot help. `parse()` checks them and reports a failure.

```typescript
import { parse } from "@sdxc/duration";
import { isFailure } from "@sdxc/result";

let result = parse(process.env.SESSION_LIFETIME ?? "");

if (isFailure(result)) {
	console.error(result.error.message); // Invalid duration: "7 dayz"
	return;
}

let lifetimeMs = result.data;
```

## API

### `toMs(input: DurationInput): number`

Convert a duration to milliseconds, the unit JavaScript time arithmetic and timers count in. A bare number passes through untouched. A value that reaches it behind a cast returns `NaN`; route runtime text through `parse()`, which reports why the text was rejected.

```typescript
let timeout = toMs("5 minutes");
// same as
let timeout = 5 * 60 * 1000;
```

```typescript
let backoff = toMs("250ms"); // 250
let expiresAt = new Date(Date.now() + toMs("1 hour"));
```

### `toSeconds(input: DurationInput): number`

Convert a duration to whole seconds, the unit HTTP cache headers and platform TTLs count in. Rounds to the nearest second with halves rounding up, so `1500` becomes `2` and `1400` becomes `1`. Anything under half a second rounds to `0`, which most seconds-based APIs read as "no caching", so pass at least `"1 second"` when a TTL must be non-zero.

```typescript
let ttl = toSeconds("1 week");
// same as
let ttl = Math.round((7 * 24 * 60 * 60 * 1000) / 1000);
```

```typescript
let maxAge = toSeconds("5 minutes"); // 300
let ttl = toSeconds("1 week"); // 604800
```

### `parse(text: string): Result<number, InvalidDurationError>`

Parse duration text into milliseconds, returning a `Success<number>` or a `Failure<InvalidDurationError>` naming the rejected text. It accepts exactly the forms `DurationString` allows, plus a bare amount read as milliseconds, with surrounding whitespace trimmed. The grammar mirrors the type: a long spelling takes its single space and a short alias takes none, so `"5 m"` and `"5minutes"` are failures.

```typescript
parse("15 minutes"); // { status: "success", data: 900000 }
parse("900000"); // { status: "success", data: 900000 }
parse("15 minuts"); // { status: "failure", error: InvalidDurationError }
```

### `InvalidDurationError`

Error describing text that fails the duration grammar. It arrives inside a `Failure` value.

- `text`: `string` - The rejected text, kept verbatim and untrimmed for diagnostics
- `name`: `string` - Always `"InvalidDurationError"`
- `message`: `string` - `Invalid duration: "<text>"`, quoted so whitespace and empty strings stay visible in logs

### Types

#### `DurationString`

```typescript
type DurationString = `${bigint} ${DurationUnit}` | `${bigint}${DurationUnitShort}`;
```

A duration written as text: a whole amount plus a unit, either spelled out after a single space or abbreviated with no space. The amount placeholder is `${bigint}` rather than `${number}` so only whole amounts type-check.

#### `DurationInput`

```typescript
type DurationInput = number | DurationString;
```

What a duration-taking API declares. A bare number is always milliseconds.

#### `DurationUnit`

A unit spelled out after a single space: `millisecond`, `second`, `minute`, `hour`, `day`, `week`, and the plural of each.

#### `DurationUnitShort`

A unit abbreviated with no space: `ms`, `s`, `m`, `h`, `d`, `w`.

### Accepted Forms

| Unit        | Singular          | Plural               | Short form | Milliseconds |
| ----------- | ----------------- | -------------------- | ---------- | ------------ |
| Millisecond | `"1 millisecond"` | `"250 milliseconds"` | `"250ms"`  | 1            |
| Second      | `"1 second"`      | `"30 seconds"`       | `"30s"`    | 1000         |
| Minute      | `"1 minute"`      | `"15 minutes"`       | `"15m"`    | 60000        |
| Hour        | `"1 hour"`        | `"6 hours"`          | `"6h"`     | 3600000      |
| Day         | `"1 day"`         | `"30 days"`          | `"30d"`    | 86400000     |
| Week        | `"1 week"`        | `"2 weeks"`          | `"1w"`     | 604800000    |

An amount may be `0` or negative (`"-5 minutes"` is `-300000`). Rejected at compile time, and by `parse()` at runtime: fractional and exponent amounts (`"1.5h"`, `"5e3s"`), unit-only text (`"hour"`), the other form's spacing (`"5 m"`, `"5minutes"`), uppercase units (`"30S"`), leading zeros and plus signs (`"05s"`, `"+5s"`), compound durations (`"1 hour 30 minutes"`), and months and years, which have no fixed length.

## Pattern: One Unit Per Boundary

Convert at the boundary that consumes the value, not at the call site that writes it. The caller writes the duration once, and each boundary converts to the unit it needs.

```typescript
import type { DurationInput } from "@sdxc/duration";

import { toMs, toSeconds } from "@sdxc/duration";

interface SessionOptions {
	lifetime: DurationInput;
}

function createSession(options: SessionOptions) {
	return {
		// a cookie's Max-Age counts seconds
		maxAge: toSeconds(options.lifetime),
		// Date arithmetic counts milliseconds
		expiresAt: new Date(Date.now() + toMs(options.lifetime)),
	};
}

createSession({ lifetime: "30 days" });
```

## Pattern: Validating Configuration Once At Startup

Parse duration configuration where it is read, so a typo in an environment variable is reported by name instead of becoming a `NaN` timer far away.

```typescript
import type { Result } from "@sdxc/result";

import { parse } from "@sdxc/duration";
import { failure, isFailure } from "@sdxc/result";

function readDuration(name: string, value: string): Result<number, Error> {
	let result = parse(value);
	if (isFailure(result)) return failure(new Error(`${name} is not a duration: ${value}`));
	return result;
}

let lifetime = readDuration("SESSION_LIFETIME", process.env.SESSION_LIFETIME ?? "");
```

## Pattern: Strings In Code, Numbers In Storage

Duration strings are for code and configuration. Keep storage and wire formats numeric, so a stored value never depends on this package's grammar.

```typescript
import type { DurationInput } from "@sdxc/duration";

import { toMs } from "@sdxc/duration";

async function schedule(job: string, delay: DurationInput) {
	// the column stores milliseconds, not "5 minutes"
	await db.jobs.insert({ job, runAfterMs: Date.now() + toMs(delay) });
}

await schedule("send-digest", "5 minutes");
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/duration": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
