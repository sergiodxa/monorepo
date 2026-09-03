# @sdxc/duration

Compile-time-checked duration strings, and the conversions from them to milliseconds and seconds.

## Overview

Lengths of time show up everywhere as bare numbers whose unit is only knowable from context: cache TTLs, session lifetimes, retry backoff, rate limit windows, cron grace periods. Two problems follow. Seconds and milliseconds are both `number`, so a value handed to the wrong API is off by a factor of a thousand and still type-checks; and `60 * 60 * 24 * 7` has to be read carefully every time it appears.

This package fixes both with a template literal type. A duration is written as text — `"5 minutes"`, `"30s"` — and a misspelled unit is a compile error rather than a runtime surprise, so no string parsing library is needed. `toMs()` and `toSeconds()` convert, and `parse()` handles text that only exists at runtime, returning a [`Result`](/packages/result) instead of throwing. A bare `number` is always milliseconds, matching JavaScript time arithmetic, so a seconds-based API cannot silently receive milliseconds.

The scope is deliberately small: a unit table, two conversions, and a parser, with no dependency beyond `@sdxc/result` and no platform API at all — not even `Intl`. Nothing here takes a `Date` or produces text for a reader; date arithmetic and human-readable formatting belong to date-aware APIs, which can depend on this package to accept a `DurationInput` of their own.

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

Declare the parameter as `DurationInput` and normalize once, so callers may pass either form and your function states its own unit exactly once.

```typescript
import type { DurationInput } from "@sdxc/duration";

import { toSeconds } from "@sdxc/duration";

interface CacheOptions {
	ttl: DurationInput;
}

function write(key: string, value: string, options: CacheOptions) {
	return store.put(key, value, { expirationTtl: toSeconds(options.ttl) });
}

write("session", value, { ttl: "30 days" });
write("session", value, { ttl: 2_592_000_000 }); // still valid
```

### Parsing Text That Arrives At Runtime

Configuration values and form fields are plain strings, where the compile-time type cannot help. `parse()` checks them and reports a failure.

```typescript
import { parse } from "@sdxc/duration";
import { isFailure } from "@sdxc/result";

let result = parse(env.SESSION_LIFETIME);

if (isFailure(result)) {
	logger.error(result.error.message); // Invalid duration: "7 dayz"
	return;
}

let lifetimeMs = result.data;
```

## API

### `toMs(input: DurationInput): number`

Convert a duration to milliseconds, the unit JavaScript time arithmetic and timers count in. A bare number passes through untouched, which keeps existing numeric call sites working.

**Parameters:**

- `input`: A `DurationString`, or a number already counted in milliseconds

**Returns:**

- The duration in milliseconds, or `NaN` when the compile-time type was bypassed (a cast or an unchecked runtime value). Use `parse()` for runtime text; it reports why the text was rejected.

**Example:**

```typescript
let backoff = toMs("250ms"); // 250
let expiresAt = new Date(Date.now() + toMs("1 hour"));
```

### `toSeconds(input: DurationInput): number`

Convert a duration to whole seconds, the unit HTTP cache headers and platform TTLs count in. Separate from `toMs()` so seconds are always handed over deliberately.

**Parameters:**

- `input`: A `DurationString`, or a number of milliseconds

**Returns:**

- The duration rounded to the nearest whole second, with halves rounding up (`1500` becomes `2`, `1400` becomes `1`). Anything under half a second rounds down to `0`, which most seconds-based APIs read as "no caching", so pass at least `"1 second"` when that matters. `NaN` propagates from `toMs()`.

**Example:**

```typescript
let maxAge = toSeconds("5 minutes"); // 300
let ttl = toSeconds("1 week"); // 604800
```

### `parse(text: string): Result<number, InvalidDurationError>`

Parse duration text into milliseconds. Accepts exactly the forms `DurationString` allows, plus a bare amount read as milliseconds, with surrounding whitespace trimmed.

The grammar is the runtime mirror of the type: a long spelling requires its single space and a short alias requires none, so `"5 m"` and `"5minutes"` are failures. Text a call site could not have written in code is not accepted here either.

**Parameters:**

- `text`: Text to parse, such as an environment variable or a form value

**Returns:**

- A `Success<number>` with the duration in milliseconds, or a `Failure<InvalidDurationError>` naming the rejected text

**Example:**

```typescript
parse("15 minutes"); // { status: "success", data: 900000 }
parse("900000"); // { status: "success", data: 900000 }
parse("15 minuts"); // { status: "failure", error: InvalidDurationError }
```

### `InvalidDurationError`

Error describing text that does not match the duration grammar. It is returned inside a `Failure` and never thrown.

**Properties:**

- `text`: `string` - The rejected text, kept verbatim and untrimmed for diagnostics
- `name`: `string` - Always `"InvalidDurationError"`
- `message`: `string` - `Invalid duration: "<text>"`, quoted so whitespace and empty strings stay visible in logs

### Types

#### `DurationString`

```typescript
type DurationString = `${bigint} ${DurationUnit}` | `${bigint}${DurationUnitShort}`;
```

A duration written as text: a whole amount plus a unit, either spelled out after a single space or abbreviated with no space. The amount placeholder is `${bigint}` rather than `${number}` because `${number}` also admits `1.5`, `5e3` and `0x10`, and only whole amounts are supported.

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

Rejected at compile time, and by `parse()` at runtime: fractional and exponent amounts (`"1.5h"`, `"5e3s"`), unit-only text (`"hour"`), the other form's spacing (`"5 m"`, `"5minutes"`), uppercase units (`"30S"`), leading zeros and plus signs (`"05s"`, `"+5s"`), compound durations (`"1 hour 30 minutes"`), and months and years, which have no fixed length.

## Pattern: One Unit Per Boundary

Convert at the boundary that consumes the value, not at the call site that writes it. The caller writes the duration once, in units a reader understands, and each boundary converts to the unit it needs.

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
```

## Pattern: Strings In Code, Numbers In Storage

Duration strings are for code and configuration. Keep storage and wire formats numeric, converting on the way in and reading the number back out, so a stored value never depends on this package's grammar.

```typescript
import type { DurationInput } from "@sdxc/duration";

import { toMs } from "@sdxc/duration";

async function schedule(job: string, delay: DurationInput) {
	// the column stores milliseconds, not "5 minutes"
	await db.insert(jobs).values({ job, runAfterMs: Date.now() + toMs(delay) });
}
```

## Related Packages

- [`@sdxc/result`](/packages/result) - The `Result` type `parse()` returns, and the `isFailure`/`isSuccess`/`unwrap` helpers for reading it

## Tips

1. **Declare `DurationInput`, never `number`** - Accepting the union costs nothing and lets every call site read as a duration; convert inside your function.
2. **Convert with the unit you need, at the point you need it** - `toMs()` for timers and `Date` arithmetic, `toSeconds()` for cache headers and platform TTLs; never divide by 1000 yourself.
3. **Use `parse()` for anything that was not written in code** - Environment variables, form fields and stored settings cannot be checked by the compiler, and `parse()` turns a typo into a reported failure.
4. **Keep the unit list closed** - Each unit multiplies the size of the `DurationString` union, and editor responsiveness degrades before correctness does.
5. **Reach for a date-aware API for calendar work** - Months and years are absent on purpose: they have no fixed length, so adding a month to a date is not a duration conversion.
6. **Watch the sub-second floor** - `toSeconds("400ms")` is `0`, which most caches treat as "do not store"; use at least `"1 second"` when a TTL must be non-zero.
7. **A `NaN` from `toMs()` means the type was bypassed** - It only happens behind a cast or an unchecked value, and is a signal to route that input through `parse()` instead.
8. **Compute durations as numbers, not as assembled text** - A template built from a variable widens to `` `${number} minutes` `` and is rejected; multiply instead, as in `count * toMs("1 minute")`, since a bare number is already milliseconds.
