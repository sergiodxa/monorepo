# @sdxc/random

Seeded and system random streams with integer, float, pick and shuffle draws, and resumable state.

## Installation

```sh
npm add @sdxc/random
```

The main entry point has no dependencies. The `@sdxc/random/schema` entry point needs [`remix`](https://www.npmjs.com/package/remix) for `remix/data-schema`.

## Usage

### Roll from a seed

```typescript
import { createRandom } from "@sdxc/random";

let dice = createRandom("battle-42");

dice.int(1, 6); // the same values, in the same order, on every run
dice.float(0.85, 1);
dice.bool(0.1);
dice.pick(["rock", "paper", "scissors"]);
dice.shuffle([1, 2, 3, 4, 5]);
```

### Accept randomness in your own API

Type the parameter as `Random` and default it to `systemRandom()`. Production passes nothing; a test passes a seeded stream instead of stubbing `Math.random`.

```typescript
import type { Random } from "@sdxc/random";

import { createRandom, systemRandom } from "@sdxc/random";

function shouldSample(rate: number, random: Random = systemRandom()): boolean {
	return random.bool(rate);
}

shouldSample(0.1); // Web Crypto backed
shouldSample(0.1, createRandom("sampler-test")); // reproducible
```

### Save and resume a stream

`state()` is plain JSON, and `restoreRandom` continues with the draw the original would have taken next.

```typescript
import { createRandom, restoreRandom } from "@sdxc/random";

let encounters = createRandom("world-7");
encounters.int(1, 100);

let saved = JSON.stringify(encounters.state());
let resumed = restoreRandom(JSON.parse(saved));

resumed.int(1, 100) === encounters.int(1, 100); // true
```

### Split one seed into independent streams

`derive(label)` opens a stream seeded from the parent's seed and the label, so extra draws in one part of a program leave the values of another part unchanged.

```typescript
import { createRandom, systemSeed } from "@sdxc/random";

let session = createRandom(systemSeed());

let battle = session.derive("battle");
let loot = session.derive("loot");
```

## API

### `createRandom(seed: Seed): SeededRandom`

Opens a stream on a seed. The same seed produces the same values in the same order on any machine; `42` and `"42"` name the same stream.

### `restoreRandom(state: RandomState): SeededRandom`

Rebuilds a stream from a `state()` snapshot, positioned exactly where the snapshot was taken.

### `systemRandom(): Random`

An unseeded stream drawing from `crypto.getRandomValues`, for jitter, sampling and tie-breakers. It has no seed or state, so it never replays. Generate keys and secrets with Web Crypto directly.

### `systemSeed(): number`

A fresh 32-bit seed from `crypto.getRandomValues`. Log it, and passing it back to `createRandom` replays the run.

### `RANDOM_STATE_SCHEMA: Schema<unknown, RandomState>`

From `@sdxc/random/schema`. A `remix/data-schema` schema for a `RandomState` read from storage: the seed is a string or number, and each of the four words is an unsigned 32-bit integer.

### Types

#### `Random`

The draws every stream offers:

- `next()`: the raw draw, in `[0, 1)`
- `int(min, max)`: an integer with both ends included; throws `RangeError` when a bound is not a safe integer or `max < min`
- `float(min = 0, max = 1)`: a number in `[min, max)`
- `bool(chance = 0.5)`: `true` with probability `chance`
- `pick(items)`: one element, each equally likely; throws `RangeError` on an empty list
- `shuffle(items)`: a shuffled copy, leaving the input in its order

#### `SeededRandom`

A `Random` plus `seed`, `derive(label: string): SeededRandom` and `state(): RandomState`.

#### `Seed`

`number | string`.

#### `RandomState`

`{ seed: Seed; words: [number, number, number, number] }`, the seed and the generator's four unsigned 32-bit words.

## Pattern: A Reproducible Fuzz Test

Draw a fresh seed per run unless one is supplied, and put it in the suite name, so a failure reports the number that replays it.

```typescript
import { createRandom, systemSeed } from "@sdxc/random";
import { describe, expect, test } from "vitest";

import { parseCron } from "./cron.js";

let seed = Number(process.env.FUZZ_SEED) || systemSeed();

describe(`cron parsing (FUZZ_SEED=${seed})`, () => {
	test("every generated expression parses", () => {
		let random = createRandom(seed);

		for (let index = 0; index < 1000; index++) {
			let minute = random.int(0, 59);
			let hour = random.int(0, 23);
			let weekday = random.pick(["MON", "TUE", "WED", "THU", "FRI"]);
			expect(parseCron(`${minute} ${hour} * * ${weekday}`).success).toBe(true);
		}
	});
});
```

## Pattern: Stable Procedural Generation

Give each feature of a generated world its own derived stream. Adding a draw to the terrain generator later keeps every existing world's loot exactly as it was.

```typescript
import type { Random } from "@sdxc/random";

import { createRandom } from "@sdxc/random";

function terrain(random: Random): string[] {
	return Array.from({ length: 8 }, () => random.pick(["plains", "forest", "hills", "lake"]));
}

function loot(random: Random): { gold: number; items: string[] } {
	let gold = random.int(10, 100);
	let items = random.shuffle(["sword", "shield", "potion", "map"]).slice(0, random.int(1, 3));
	return { gold, items };
}

function generateWorld(seed: string) {
	let world = createRandom(seed);
	return {
		terrain: terrain(world.derive("terrain")),
		loot: loot(world.derive("loot")),
	};
}

generateWorld("world-7"); // identical output for "world-7" on every machine
```

## Pattern: Persisting A Simulation

Store the stream's state next to the data it shaped, and validate it on load, since a save file is untrusted input.

```typescript
import * as s from "remix/data-schema";

import { createRandom, restoreRandom } from "@sdxc/random";
import { RANDOM_STATE_SCHEMA } from "@sdxc/random/schema";

let saveSchema = s.object({ turn: s.number(), random: RANDOM_STATE_SCHEMA });

let random = createRandom("campaign");
let turn = 0;

function save(): string {
	return JSON.stringify({ turn, random: random.state() });
}

function load(text: string): boolean {
	let parsed = s.parseSafe(saveSchema, JSON.parse(text));
	if (!parsed.success) return false;

	turn = parsed.value.turn;
	random = restoreRandom(parsed.value.random);
	return true;
}
```

A save that fails the schema leaves the running simulation untouched, and `load` answers `false`.

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
