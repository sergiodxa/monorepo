---
name: sdxc-random
description: "@sdxc/random is the `Random` interface — `next`, `int`, `float`, `bool`, `pick`, `shuffle` — with a seeded stream (`createRandom(seed)`) that replays, derives independent streams and saves/restores its state (`state()`, `restoreRandom`, and `RANDOM_STATE_SCHEMA` from `@sdxc/random/schema`), and a Web Crypto stream (`systemRandom()`) plus `systemSeed()`. Use when code needs a random number, a dice roll, jitter, sampling, a shuffle or a pick; when a test must not stub `Math.random`; when a game or simulation must replay from a logged seed or resume a saved stream; or when building a reproducible fuzz corpus."
---

# @sdxc/random

Anything that draws a random value accepts a `Random` and lets its caller decide whether the stream is reproducible. `createRandom(seed)` opens a seeded sfc32 stream — the same seed yields the same sequence on any machine — whose `derive(label)` opens an independent child stream and whose `state()` is a JSON snapshot `restoreRandom` resumes from. `systemRandom()` draws from `crypto.getRandomValues` and has no seed or state. The main entry has no dependencies; `@sdxc/random/schema` needs `remix`. Runs anywhere Web Crypto does.

Full API, options and examples: [packages/random/README.md](packages/random/README.md)

## When to reach for it

- A function needs a random number and its test should pass a seeded stream instead of stubbing `Math.random` or a `() => number`.
- A game, simulation or battle must replay a reported bug from a logged seed.
- A save file must resume a stream so a loaded run draws what the uninterrupted run would have.
- A fuzz corpus must be reproducible, with a fresh seed per run that a failure prints.
- Retry jitter, log sampling or a short non-secret suffix needs a well-spread value.

## Using it

```json
{ "dependencies": { "@sdxc/random": "workspace:*" } }
```

```ts
import type { Random } from "@sdxc/random";

import { createRandom, restoreRandom, systemRandom, systemSeed } from "@sdxc/random";

function rollEncounter(rate: number, random: Random = systemRandom()): boolean {
	return random.bool(rate);
}

let session = createRandom(systemSeed());
log.set({ seed: session.seed });

let encounters = session.derive("encounters");
rollEncounter(0.1, encounters);

let saved = encounters.state(); // JSON
let resumed = restoreRandom(saved); // continues where `encounters` stopped
```

## Suggestions

- Accept `Random`, not `SeededRandom`, unless the function itself derives or saves; a seeded stream satisfies `Random`.
- Give each subsystem its own `derive(label)` stream, so an extra draw in one never shifts the values another sees.
- Validate a stored snapshot with `RANDOM_STATE_SCHEMA` (from `@sdxc/random/schema`) before `restoreRandom` — a save file is untrusted input.
- `int` and `pick` throw `RangeError` on non-integer or reversed bounds and on an empty list; those are bugs in the call.
- Keys, tokens, nonces and IVs come from `@sdxc/crypto` (`randomBytes`, `randomToken`), never from this package.

## Related

- `@sdxc/sample` — `createSample({ seed })` accepts a `SeededRandom`, so fake data shares one seed with other draws; skill `sdxc-sample`
- `@sdxc/crypto` — secrets and tokens; skill `sdxc-crypto`
