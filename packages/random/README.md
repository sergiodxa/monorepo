# @sdxc/random

Seeded and system random streams with integer, float, pick and shuffle draws, and resumable state.

## Installation

```bash
npm add @sdxc/random
```

The main entry point has no dependencies. `@sdxc/random/schema` exports `RANDOM_STATE_SCHEMA`, a [`remix/data-schema`](https://www.npmjs.com/package/remix) schema; install `remix` to use it.

## Usage

### Rolling From A Seed

```typescript
import { createRandom } from "@sdxc/random";

let dice = createRandom("battle-42");

dice.int(1, 6); // the same six numbers, in the same order, on every run
dice.float(0.85, 1);
dice.bool(0.1);
dice.pick(["rock", "paper", "scissors"]);
dice.shuffle([1, 2, 3, 4, 5]);
```

### Accepting Randomness In Your Own API

Declare the parameter as `Random` and default it to `systemRandom()`. Production passes nothing, and a test passes a seeded stream instead of stubbing `Math.random`.

```typescript
import type { Random } from "@sdxc/random";

import { createRandom, systemRandom } from "@sdxc/random";

function shouldSample(rate: number, random: Random = systemRandom()): boolean {
	return random.bool(rate);
}

shouldSample(0.1); // crypto-backed
shouldSample(0.1, createRandom("sampler-test")); // reproducible
```

### Saving And Resuming A Stream

`state()` is plain JSON. `restoreRandom` continues from the next draw the original would have taken.

```typescript
import { createRandom, restoreRandom } from "@sdxc/random";

let encounters = createRandom("world-7");
encounters.int(1, 100);

let saved = JSON.stringify(encounters.state());
let resumed = restoreRandom(JSON.parse(saved));

resumed.int(1, 100) === encounters.int(1, 100); // true
```

### Independent Streams From One Seed

`derive(label)` opens a stream seeded from the parent's seed and the label, so extra draws in one part of a program never shift the values another part sees.

```typescript
import { createRandom, systemSeed } from "@sdxc/random";

let session = createRandom(systemSeed());

let battle = session.derive("battle");
let loot = session.derive("loot");
```

## API

### `createRandom(seed: Seed): SeededRandom`

Open a stream on a seed. The same seed produces the same values in the same order on any machine; `42` and `"42"` name the same stream.

### `restoreRandom(state: RandomState): SeededRandom`

Rebuild a stream from a `state()` snapshot, positioned exactly where the snapshot was taken.

### `systemRandom(): Random`

An unseeded stream drawing from `crypto.getRandomValues`, for jitter, sampling and short tie-breakers. It has no seed and no state, so it cannot be replayed. Use Web Crypto directly, or a token library, for keys and secrets.

### `systemSeed(): number`

A fresh 32-bit seed from `crypto.getRandomValues`. Log it, and the run replays by passing it back to `createRandom`.

### `RANDOM_STATE_SCHEMA` from `@sdxc/random/schema`

A `remix/data-schema` schema for a `RandomState` read from storage. It checks the seed's type and that each of the four words is an unsigned 32-bit integer.

### `Random`

The draws every stream offers:

- `next()`: the raw draw, in `[0, 1)`
- `int(min, max)`: an integer with both ends included; throws `RangeError` on non-integer bounds or `max < min`
- `float(min = 0, max = 1)`: a number in `[min, max)`
- `bool(chance = 0.5)`: `true` with probability `chance`
- `pick(items)`: one element, each equally likely; throws `RangeError` on an empty list
- `shuffle(items)`: a shuffled copy, leaving the input untouched

### `SeededRandom`

A `Random` with `seed`, `derive(label)` and `state()`.

### `Seed` and `RandomState`

`Seed` is `number | string`. `RandomState` is `{ seed, words }`, where `words` holds the generator's four unsigned 32-bit words.

## Pattern: A Reproducible Fuzz Run

Draw a fresh seed per run unless one is supplied, and print it, so a failing run replays from that number.

```typescript
import { createRandom, systemSeed } from "@sdxc/random";

let seed = Number(process.env.FUZZ_SEED) || systemSeed();
console.info(`fuzz seed: ${seed}`);

let random = createRandom(seed);
let cases = Array.from({ length: 1000 }, () => ({
	minute: random.int(0, 59),
	hour: random.int(0, 23),
	weekday: random.pick(["MON", "TUE", "WED", "THU", "FRI"]),
}));
```

## Pattern: Persisting A Simulation

Store each stream's state next to the world it shaped, and validate it on load, since a save file is untrusted input.

```typescript
import * as s from "remix/data-schema";

import { createRandom, restoreRandom } from "@sdxc/random";
import { RANDOM_STATE_SCHEMA } from "@sdxc/random/schema";

const SAVE_SCHEMA = s.object({ turn: s.number(), random: RANDOM_STATE_SCHEMA });

let random = createRandom("campaign");
let turn = 0;

function save(): string {
	return JSON.stringify({ turn, random: random.state() });
}

function load(text: string) {
	let parsed = s.parseSafe(SAVE_SCHEMA, JSON.parse(text));
	if (!parsed.success) throw new Error("Corrupt save file");
	turn = parsed.value.turn;
	random = restoreRandom(parsed.value.random);
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/random": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
