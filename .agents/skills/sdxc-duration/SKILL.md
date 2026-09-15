---
name: sdxc-duration
description: "@sdxc/duration is the `DurationInput` type — a compile-time-checked duration string like `\"30 days\"` or `\"250ms\"`, or a bare number of milliseconds — plus `toMs`, `toSeconds` and a `Result`-returning `parse` for text that arrives at runtime. Use when declaring a TTL, timeout, grace period or session lifetime in your own API, converting one to a `Max-Age` or a platform TTL, or validating a duration read from configuration or a form."
---

# @sdxc/duration

A duration written in code should be readable and wrong spellings should not compile. `DurationString` is a template literal type — a whole amount plus a unit, spelled out after a single space (`"5 minutes"`) or abbreviated with no space (`"30s"`) — and `DurationInput` is that or a bare number, which is always milliseconds. `toMs()` and `toSeconds()` convert, and `parse()` checks text whose type cannot be known at compile time, returning a `Result<number, InvalidDurationError>`. No runtime dependency beyond `@sdxc/result`; runs anywhere.

Full API, options and examples: [packages/duration/README.md](packages/duration/README.md)

## When to reach for it

- Your own function takes a TTL, timeout, retry backoff or lifetime, and you want the caller to write `"30 days"` rather than a bare millisecond literal.
- The same duration has to reach two boundaries counting different units — a cookie `Max-Age` in seconds and `Date` arithmetic in milliseconds.
- An environment variable or form field holds a duration and a typo should be reported by name at startup instead of becoming a `NaN` timer later.
- A magic number like `2_592_000_000` appears in the code and nobody can read what it means.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/duration": "workspace:*" } }
```

```ts
import type { DurationInput } from "@sdxc/duration";

import { toMs, toSeconds } from "@sdxc/duration";

toMs("5 minutes"); // 300000
toMs(1500); // 1500 — a bare number is already milliseconds
toSeconds("1 hour"); // 3600
toMs("5 minuts"); // Type error: "minuts" is not a unit

interface CacheOptions {
	ttl: DurationInput;
}

function write(key: string, value: string, options: CacheOptions) {
	return cache.set(key, value, { ttlSeconds: toSeconds(options.ttl) });
}
```

## Suggestions

- Declare the parameter as `DurationInput` and convert at the boundary that consumes the value, not at the call site that writes it — the caller writes the duration once, and each boundary converts to the unit it needs.
- Keep storage and wire formats numeric. Duration strings belong in code and configuration, so a stored value never depends on this package's grammar.
- `toMs()` on a value that reached it behind a cast returns `NaN` rather than failing loudly; route runtime text through `parse()`, which names the rejected text.
- The grammar mirrors the type exactly: a long spelling takes its single space and a short alias takes none, so `"5 m"` and `"5minutes"` are both rejected, as are fractional amounts, uppercase units, compound durations, and months and years, which have no fixed length.
- `toSeconds()` rounds to the nearest second with halves up, so anything under half a second becomes `0` — which most seconds-based APIs read as "no caching". Pass at least `"1 second"` when a TTL must be non-zero.

## Related

- `@sdxc/result` — the `Result` `parse()` returns; skill `sdxc-result`
- `@sdxc/dates` — `add`, `subtract` and `formatDuration` take a `DurationInput`; skill `sdxc-dates`
- `@sdxc/cron` — the `grace` option on its lateness helpers is a `DurationInput`; skill `sdxc-cron`
