# ADR-104: Random Package

## Status

**Accepted** - 2026-10-05

## Background

Code across the repo that needs a random number reaches for one of three sources:
`Math.random`, a `() => number` parameter defaulting to it, or `createRandom` from
`@sdxc/sample`. The seeded generator in `@sdxc/sample` is the only one that makes a run
reproducible, but it lives in a package about generating believable people and places, so a
consumer that only needs `int(1, 6)` depends on name lists, prose corpora and street data to
get it. Two places have written their own generator instead of taking that dependency.

The seeded stream also keeps its state inside a closure. A caller can replay a stream from its
seed but cannot save where a stream is and resume it later, which is what a persisted
simulation and a shrinking fuzz case both need.

## Context

### Current randomness sources

| Location                                        | Source                                                                                           | Needs                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `packages/sample/src/random.ts`                 | Owns the seeded generator (sfc32), `Random`                                                      | Every generated value                                  |
| `packages/spec/src/run.ts`, `tool-context.ts`   | `createRandom` from `@sdxc/sample`, and `Math.random` for run ids                                | Per-test streams, a fresh run id                       |
| `packages/logger/src/sample.ts`                 | `random: () => number = Math.random`                                                             | A draw against the sampling rate, replaceable in tests |
| `packages/cron/test/corpus.ts`                  | Hand-written mulberry32 `randomFrom(seed)`                                                       | A reproducible fuzz corpus                             |
| `apps/pkmn/src/game/**`                         | `random: () => number` threaded through the engine, battle and systems, `Math.random` by default | Encounters, captures, natures, battle rolls            |
| `apps/pkmn/src/presentation/overworld/*.ts`     | `Math.random` directly                                                                           | Encounter rolls                                        |
| `apps/auth-saas/database/webhook-deliveries.ts` | `Math.random` for retry jitter                                                                   | Jitter                                                 |
| `apps/uptime/app/data/team.ts`                  | `Math.random().toString(36)` for a slug suffix                                                   | A short non-secret suffix                              |

Secrets are a separate concern and already have their home: `@sdxc/crypto` (`randomBytes`,
`randomToken`), used by `trace-context`, `passkey`, `saml`, `honeypot` and the auth apps.

### Issues identified

| Issue                                           | Impact                                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| The seeded generator sits inside `@sdxc/sample` | A dice roll costs the whole fake-data package                                                         |
| `() => number` is the de-facto interface        | Every consumer re-derives `int`, `pick` and `shuffle` from a float, each with its own off-by-one risk |
| Two hand-written generators                     | Two algorithms to trust, neither tested on its own                                                    |
| Stream state is unreachable                     | A saved simulation or a failing fuzz case cannot resume mid-stream                                    |
| `Math.random` defaults in `apps/pkmn`           | A battle or encounter bug seen once cannot be replayed                                                |

## Decision

Add `@sdxc/random`: one interface for drawing random values, a seeded implementation whose
state can be saved and restored, and a system implementation backed by
`crypto.getRandomValues`. Anything that needs a random number accepts a `Random`, and the
caller decides whether it is reproducible.

### The interface

```typescript
export interface Random {
	/** The next raw draw, in `[0, 1)`. */
	next(): number;
	int(min: number, max: number): number;
	float(min?: number, max?: number): number;
	bool(chance?: number): boolean;
	pick<T>(items: readonly T[]): T;
	shuffle<T>(items: readonly T[]): T[];
}

export interface SeededRandom extends Random {
	readonly seed: Seed;
	derive(label: string): SeededRandom;
	state(): RandomState;
}

export type Seed = number | string;

export interface RandomState {
	seed: Seed;
	words: [number, number, number, number];
}
```

`Random` is what a consumer accepts. `SeededRandom` is what a caller holds when it wants to
replay, derive or persist the stream.

### The implementations

```typescript
import { createRandom, restoreRandom, systemRandom, systemSeed } from "@sdxc/random";

let dice = createRandom("battle-42");
dice.int(1, 6);

let saved = dice.state(); // JSON-serializable
let resumed = restoreRandom(saved); // continues exactly where `dice` stopped

let encounters = dice.derive("encounters"); // independent of how many draws `dice` takes

let jitter = systemRandom(); // unseeded, crypto-backed
jitter.float(0.8, 1.2);

createRandom(systemSeed()); // a fresh seed, logged so the run can be replayed
```

- `createRandom(seed)` keeps the generator and seed hashing from `@sdxc/sample` unchanged, so
  every seed in an existing spec suite or snapshot produces the values it produced before.
- `restoreRandom(state)` rebuilds a stream from a `RandomState`. `RANDOM_STATE_SCHEMA`, exported
  from `@sdxc/random/schema`, validates one read back from storage, since a save file is
  untrusted input.
- `systemRandom()` draws from `crypto.getRandomValues` through a small buffer. It has no seed,
  no state and no `derive`, which is why it is a `Random` and not a `SeededRandom`.
- The main entry point has no runtime dependencies. `systemSeed` calls `crypto.getRandomValues`
  directly, so it no longer imports `@sdxc/crypto`. `remix` is an optional peer, needed only by
  the `@sdxc/random/schema` entry point, so a library that accepts a `Random` (such as
  `@sdxc/logger`, whose `remix` peer is optional) does not pull it in.

### The boundary with `@sdxc/crypto`

`@sdxc/random` draws numbers, elements and orderings. `@sdxc/crypto` makes secrets: keys,
tokens, nonces and IVs. `systemRandom` is crypto-backed so that jitter and sampling are well
distributed, and callers that need a secret keep using `randomBytes` and `randomToken`.

### Consumer changes

| Consumer           | Change                                                                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sdxc/sample`     | Depends on `@sdxc/random`. `createRandom`, `systemSeed`, `Random` and `Seed` leave its exports; `createSample({ seed })` keeps accepting a seed or an open `SeededRandom`                                                                            |
| `@sdxc/spec`       | Imports `createRandom` from `@sdxc/random`; a plugin's `context.random` is a `SeededRandom`. `createRunId` draws its noise from `systemRandom()`                                                                                                     |
| `@sdxc/logger`     | `shouldKeep` takes `random: Random`, defaulting to one module-level `systemRandom()` stream, and draws with `random.bool(rate)`                                                                                                                      |
| `@sdxc/cron` tests | `corpus.ts` replaces `randomFrom` and its helpers with `createRandom(seed)`                                                                                                                                                                          |
| `apps/pkmn`        | `random: () => number` becomes `random: Random` through the engine, battle and systems. The game opens one seeded stream per session and derives `encounters`, `movement`, `creatures` and `battle` from it, so a reported bug replays from its seed |
| `apps/uptime`      | The team slug suffix comes from `systemRandom()`                                                                                                                                                                                                     |
| `apps/auth-saas`   | Webhook retry jitter comes from `systemRandom()`                                                                                                                                                                                                     |

The moved exports leave `@sdxc/sample` in the same change, with no re-exports, and every
importer is updated directly.

### Out of scope

- **Percentage splits in `@sdxc/flags-engine`.** A split buckets a subject by a MurmurHash3 of
  the subject and the flag key, so the same user lands in the same arm in every isolate. That
  is a hash of an input, not a draw from a stream, and it matches the reference engine's
  algorithm.
- **Retry jitter in `@sdxc/result`.** `retry` keeps no dependencies. A caller wanting jitter
  computes the delay itself with a `Random`.

## Usage Examples

### Accepting randomness in a library

A function that draws declares `Random` and defaults to the system source, so production code
passes nothing and a test passes a seeded stream. `@sdxc/logger`'s sampler today:

```typescript
export function shouldKeep(
	options: Sample.Options | undefined,
	outcome: Log.Outcome,
	fields: Readonly<Record<string, Log.Value>>,
	durationMs: number,
	random: () => number = Math.random,
): boolean {
	// …
	return random() < options.rate;
}
```

With `@sdxc/random`:

```typescript
import type { Random } from "@sdxc/random";

import { systemRandom } from "@sdxc/random";

export function shouldKeep(
	options: Sample.Options | undefined,
	outcome: Log.Outcome,
	fields: Readonly<Record<string, Log.Value>>,
	durationMs: number,
	random: Random = systemRandom(),
): boolean {
	// …
	return random.bool(options.rate);
}
```

And its test, which asserts a rate over many draws without stubbing a global:

```typescript
import { createRandom } from "@sdxc/random";

test("keeps roughly the sampled fraction of ok logs", () => {
	let random = createRandom("logger-rate");
	let kept = 0;
	for (let index = 0; index < 10_000; index++) {
		if (shouldKeep({ rate: 0.1 }, "ok", {}, 5, random)) kept++;
	}
	expect(kept).toBeGreaterThan(900);
	expect(kept).toBeLessThan(1100);
});
```

### Replaying a game session

`apps/pkmn` rolls encounters and natures from a float source:

```typescript
export function rollEncounter(map: GameMap, x: number, y: number, random: () => number): boolean {
	if (!map.isEncounter(x, y)) return false;
	return random() < map.encounterRate(x, y) / 255;
}

function pickNature(gameData: GameData, random: () => number): NatureId {
	let ids = [...gameData.natures.keys()];
	if (ids.length === 0) throw new RangeError("Content has no natures to roll.");
	return ids[Math.floor(random() * ids.length)]! as NatureId;
}
```

With a `Random`, the index arithmetic and the non-null assertion go away:

```typescript
export function rollEncounter(map: GameMap, x: number, y: number, random: Random): boolean {
	if (!map.isEncounter(x, y)) return false;
	return random.bool(map.encounterRate(x, y) / 255);
}

function pickNature(gameData: GameData, random: Random): NatureId {
	return random.pick([...gameData.natures.keys()]);
}
```

The game opens one stream per session and derives one per subsystem, so an extra draw in
battle never shifts which encounter the overworld rolls next:

```typescript
let session = createRandom(systemSeed());
log.set({ seed: session.seed });

let engine = new GameEngine({
	encounters: session.derive("encounters"),
	battle: session.derive("battle"),
});
```

A bug report carrying that seed replays the session with `createRandom(reportedSeed)`.

### Saving and resuming a stream

A save stores each stream's state next to the world, and loading restores it, so a loaded game
draws what the uninterrupted game would have drawn:

```typescript
import * as s from "remix/data-schema";

import { restoreRandom } from "@sdxc/random";
import { RANDOM_STATE_SCHEMA } from "@sdxc/random/schema";

function save(world: World, encounters: SeededRandom): SaveFile {
	return { world: serializeWorld(world), random: { encounters: encounters.state() } };
}

function load(file: unknown): Result<SeededRandom, ValidationError> {
	let saved = s.parseSafe(
		s.object({ random: s.object({ encounters: RANDOM_STATE_SCHEMA }) }),
		file,
	);
	if (!saved.success) return failure(new ValidationError(saved.issues));
	return success(restoreRandom(saved.value.random.encounters));
}
```

### A reproducible fuzz corpus

`@sdxc/cron`'s corpus drops its own generator and the helpers built on it:

```typescript
function between(random: () => number, min: number, max: number): number {
	return min + Math.floor(random() * (max - min + 1));
}

let random = randomFrom(seed);
between(random, 0, 59);
```

becomes:

```typescript
let random = createRandom(seed);
random.int(0, 59);
```

A suite drawing a fresh seed per run logs it, and a failing run reproduces from that number:

```typescript
let seed = Number(process.env.CORPUS_SEED) || systemSeed();
let random = createRandom(seed);
```

### Jitter and short suffixes

Values that only need a good spread use the system source. Webhook retry jitter in
`apps/auth-saas`:

```typescript
function jitteredDelay(baseMs: number, random: Random = systemRandom()): number {
	return Math.round(baseMs * random.float(1 - MAX_JITTER_FRACTION, 1 + MAX_JITTER_FRACTION));
}
```

The team slug suffix in `apps/uptime`, which is a tie-breaker and not a secret:

```typescript
let suffix = random
	.int(0, 36 ** 6 - 1)
	.toString(36)
	.padStart(6, "0");
candidate = `${slug}-${suffix}`;
```

An API key or session token stays on `randomToken` from `@sdxc/crypto`.

### Sharing a stream with `@sdxc/sample`

`createSample` keeps accepting a `SeededRandom`, so fake data and other draws in one test come from a
single seed while staying independent of each other:

```typescript
let random = createRandom("checkout-suite");
let sample = createSample({ seed: random.derive("people") });

let customer = sample.person.record();
let cartSize = random.derive("cart").int(1, 5);
```

## Consequences

### Positive

- **One interface:** a function that needs randomness declares `random: Random`, and a test
  passes a seeded stream instead of stubbing `Math.random`.
- **Reproducible apps:** `apps/pkmn` can replay a battle or an encounter from a logged seed.
- **Resumable streams:** `state()` and `restoreRandom` let a persisted simulation or a fuzz
  case continue a stream instead of restarting it.
- **Smaller dependency:** packages that only need draws stop depending on `@sdxc/sample`'s data
  modules.
- **Unchanged values:** existing seeds keep producing the same sequences, so no stored
  expectation changes.

### Negative

- **A breaking change to `@sdxc/sample`:** its consumers import `createRandom` from a new
  package.
- **A threading change in `apps/pkmn`:** every system that takes `() => number` changes
  signature, which touches its tests too.

### Neutral

- **`int` and `pick` keep throwing `RangeError`** on invalid bounds and empty lists, the same
  as `@sdxc/crypto`'s `randomBytes` on an invalid size. Those are programmer errors in the
  call, not runtime outcomes a caller would branch on.

## Implementation Plan

### Phase 1: The package

**Priority:** High
**Estimated Effort:** 2 hours

1. Create `packages/random`, public, with `createRandom`, `restoreRandom`, `systemRandom`,
   `systemSeed`, `RANDOM_STATE_SCHEMA` and the types.
2. Move the generator and its tests from `@sdxc/sample`. Add a golden test pinning the first
   values for a few seeds, so the sequence can never drift.
3. Test `state()` and `restoreRandom` round trips, including after `derive`.
4. Write the README following the package documentation guide.

### Phase 2: Packages

**Priority:** High
**Estimated Effort:** 1 hour

1. `@sdxc/sample` depends on `@sdxc/random` and drops the moved exports.
2. `@sdxc/spec`, `@sdxc/logger` and the `@sdxc/cron` corpus switch over, one commit each.

### Phase 3: Apps

**Priority:** Medium
**Estimated Effort:** 3 hours

1. `apps/pkmn`: thread `Random`, open a seeded session stream, and derive per-subsystem streams.
2. `apps/uptime` and `apps/auth-saas`: replace `Math.random` with `systemRandom()`.

## Alternatives Considered

### 1. Keep the generator in `@sdxc/sample`

Consumers would import `createRandom` from `@sdxc/sample` as `@sdxc/spec` does today.

**Rejected because**: drawing numbers is a capability of its own, and the hand-written
generators in `@sdxc/cron` and the `Math.random` defaults in `apps/pkmn` show that the fake-data
package is too heavy a dependency for consumers to take.

### 2. Standardize on `() => number`

Every consumer would accept a float source, as `@sdxc/logger` and `apps/pkmn` do.

**Rejected because**: it pushes `int`, `pick` and `shuffle` into every consumer, and it cannot
carry a seed, a derive or a saved state.

### 3. A different generator

A newer algorithm such as xoshiro128\*\* would also fit.

**Rejected because**: sfc32 is already fast, well distributed and pinned by existing seeds.
Changing it would change every generated value in every spec suite.

## References

- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-105: Expression Package](./ADR-105-expression-package.md)

## Current Progress

- [x] Phase 1: The package
- [x] Phase 2: Packages
- [x] Phase 3: Apps

## Notes

- `@sdxc/sample`, `@sdxc/spec` and `@sdxc/logger` are public, and a public package cannot
  depend on a private one, so `@sdxc/random` is public from its first commit: it gets a
  description, a `LICENSE.md`, a ✅ in the root README table, and `bun run release:bootstrap
@sdxc/random` before the release that first carries it.
- `apps/pkmn` already writes saves (`src/presentation/core/save.ts`). Storing the session
  stream's `state()` in the save is what makes a loaded game draw the values the uninterrupted
  game would have drawn.
