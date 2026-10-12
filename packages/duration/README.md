# @sdxc/duration

Typed duration strings converted to milliseconds or seconds.

## Installation

```sh
npm add @sdxc/duration
```

`parse()` answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this package.

## Usage

### Convert a duration

```typescript
import { toMs, toSeconds } from "@sdxc/duration";

toMs("5 minutes"); // 300000
toMs("30s"); // 30000
toMs(1500); // 1500, a bare number is already milliseconds

toSeconds("1 hour"); // 3600

toMs("5 minuts"); // type error: "minuts" is not a unit
```

### Accept a duration in your own API

Declare the parameter as `DurationInput` and convert once inside, so callers pass either form and your function names its own unit in one place.

```typescript
import type { DurationInput } from "@sdxc/duration";

import { toSeconds } from "@sdxc/duration";

interface CacheOptions {
	ttl: DurationInput;
}

async function write(cache: KVNamespace, key: string, value: string, options: CacheOptions) {
	await cache.put(key, value, { expirationTtl: toSeconds(options.ttl) });
}

await write(cache, "greeting", "hello", { ttl: "1 day" });
await write(cache, "greeting", "hello", { ttl: 86_400_000 });
```

### Parse text that arrives at runtime

Configuration values and form fields are plain strings, so the type cannot check them. `parse()` does, and reports the rejected text.

```typescript
import { parse } from "@sdxc/duration";
import { isFailure } from "@sdxc/result";

let result = parse(process.env.SESSION_LIFETIME ?? "");

if (isFailure(result)) throw result.error; // Invalid duration: "7 dayz"

let lifetimeMs = result.data;
```

## API

### `toMs(input: DurationInput): number`

Converts a duration to milliseconds; a number passes through unchanged. Text that reaches it behind a cast returns `NaN`, so send untrusted text through `parse()`.

```typescript
toMs("5 minutes"); // same as 5 * 60 * 1000
```

### `toSeconds(input: DurationInput): number`

Converts a duration to whole seconds, rounding to the nearest second with halves rounding up (`1500` is `2`, `1400` is `1`). Anything under half a second is `0`, so pass at least `"1 second"` where a TTL must be non-zero.

```typescript
toSeconds("1 week"); // same as Math.round((7 * 24 * 60 * 60 * 1000) / 1000)
```

### `parse(text: string): Result<number, InvalidDurationError>`

Parses text into milliseconds after trimming surrounding whitespace. It accepts exactly what `DurationString` accepts, plus a bare amount read as milliseconds (`"900000"`).

### `InvalidDurationError`

The error inside a failed `parse()`. `text` holds the rejected input verbatim, and `message` quotes it (`Invalid duration: "7 dayz"`) so empty or whitespace-only values stay visible in logs.

### Types

#### `DurationString`

A whole amount plus a unit: spelled out after one space (`"5 minutes"`) or abbreviated with none (`"5m"`).

| Unit        | Long forms                    | Short | Milliseconds |
| ----------- | ----------------------------- | ----- | ------------ |
| Millisecond | `millisecond`, `milliseconds` | `ms`  | 1            |
| Second      | `second`, `seconds`           | `s`   | 1000         |
| Minute      | `minute`, `minutes`           | `m`   | 60000        |
| Hour        | `hour`, `hours`               | `h`   | 3600000      |
| Day         | `day`, `days`                 | `d`   | 86400000     |
| Week        | `week`, `weeks`               | `w`   | 604800000    |

Amounts may be `0` or negative (`"-5 minutes"`). Both the type and `parse()` reject fractions and exponents (`"1.5h"`, `"5e3s"`), leading zeros and plus signs (`"05s"`, `"+5s"`), the other form's spacing (`"5 m"`, `"5minutes"`), uppercase units, compound durations (`"1 hour 30 minutes"`), and months and years, which have no fixed length.

#### `DurationInput`

`number | DurationString`, the type a duration-taking API declares. A number is always milliseconds.

#### `DurationUnit`

The long unit spellings, singular and plural.

#### `DurationUnitShort`

The short aliases: `ms`, `s`, `m`, `h`, `d`, `w`.

## Pattern: One Value, Several Units

Take the duration once and convert at each boundary that consumes it, in the unit that boundary counts in.

```typescript
import type { DurationInput } from "@sdxc/duration";

import { toMs, toSeconds } from "@sdxc/duration";

interface SessionOptions {
	lifetime: DurationInput;
}

function sessionCookie(id: string, options: SessionOptions) {
	let maxAge = toSeconds(options.lifetime);
	let expires = new Date(Date.now() + toMs(options.lifetime));
	return `session=${id}; Max-Age=${maxAge}; Expires=${expires.toUTCString()}; HttpOnly`;
}

sessionCookie("abc123", { lifetime: "30 days" });
```

## Pattern: Validate Configuration at Startup

Parse every duration setting where it is read, so a typo fails by name at boot instead of becoming a `NaN` timer later.

```typescript
import type { Result } from "@sdxc/result";

import { parse } from "@sdxc/duration";
import { failure, isFailure } from "@sdxc/result";

function readDuration(name: string, fallback: string): Result<number, Error> {
	let value = process.env[name] ?? fallback;
	let result = parse(value);
	if (isFailure(result))
		return failure(new Error(`${name} is not a duration: ${result.error.text}`));
	return result;
}

let lifetime = readDuration("SESSION_LIFETIME", "30 days");
let pollInterval = readDuration("POLL_INTERVAL", "15s");
```

## Pattern: Strings in Code, Numbers in Storage

Write durations as strings in code and configuration, and store or send the number, so persisted data reads the same whatever grammar this package accepts.

```typescript
import type { DurationInput } from "@sdxc/duration";

import { toMs } from "@sdxc/duration";

interface Reminder {
	message: string;
	dueAt: number;
}

function remindIn(message: string, delay: DurationInput): Reminder {
	return { message, dueAt: Date.now() + toMs(delay) };
}

let reminder = remindIn("Renew the certificate", "2 weeks");
await storage.put("reminder", JSON.stringify(reminder));
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
