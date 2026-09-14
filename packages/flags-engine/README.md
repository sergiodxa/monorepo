# @sdxc/flags-engine

Flag evaluation engine: typed targeting rules, percentage splits and pluggable stores.

A flag here is a set of variants, an ordered list of rules about who sees which one, and a
percentage. This package holds that definition format and resolves it: a definition set and an
evaluation context in, a `ResolutionDetails` out. Every outcome travels back on those details,
the failures included, so the evaluation path has one shape.

Evaluation is a pure, synchronous function, which is what lets the same call answer a provider,
an HTTP endpoint and an admin preview. Definitions arrive through a one-method `FlagStore`, so
where they live stays yours to choose.

## Installation

```bash
npm add @sdxc/flags-engine @sdxc/flags
```

[`@sdxc/flags`](https://www.npmjs.com/package/@sdxc/flags) is what an application evaluates
through, and it supplies the vocabulary this package answers in: the evaluation context, the
resolution details, the reasons and the error codes.
[`vitest`](https://www.npmjs.com/package/vitest) is an optional peer, needed by the conformance
suite alone.

## Usage

### Resolving against a set in memory

An engine reads a store once, keeps the parsed snapshot, and resolves every later flag against
it:

```typescript
import { createEngine } from "@sdxc/flags-engine";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";

let engine = createEngine({
	store: new InMemoryFlagStore({
		flags: {
			"new-checkout": { variants: { on: true, off: false }, defaultVariant: "off" },
		},
	}),
});

await engine.load();

engine.evaluate("new-checkout", false);
// { value: false, reason: "STATIC", variant: "off" }
```

### Targeting a rule

Rules are tried in the order they were written, and the first one whose condition holds decides
the variant:

```typescript
let engine = createEngine({
	store: new InMemoryFlagStore({
		flags: {
			"new-checkout": {
				variants: { on: true, off: false },
				defaultVariant: "off",
				targeting: [{ when: { op: "eq", field: "plan.tier", value: "pro" }, serve: "on" }],
			},
		},
	}),
});

await engine.load();

engine.evaluate("new-checkout", false, { targetingKey: "user-1", plan: { tier: "pro" } });
// { value: true, reason: "TARGETING_MATCH", variant: "on" }
```

### Rolling out to a percentage

A rule serving weights buckets its subjects among the arms instead of naming one:

```typescript
let engine = createEngine({
	store: new InMemoryFlagStore({
		flags: {
			"new-checkout": {
				variants: { on: true, off: false },
				defaultVariant: "off",
				targeting: [{ when: { op: "always" }, serve: { weights: { on: 10, off: 90 } } }],
			},
		},
	}),
});

await engine.load();

engine.evaluate("new-checkout", false, { targetingKey: "user-1" });
// { value: …, reason: "SPLIT", variant: … } — the same arm for "user-1" on every request
```

### Serving flags through `@sdxc/flags`

`EngineProvider` is the adapter from an engine onto the `Provider` interface an application
evaluates through:

```typescript
import { createFlags } from "@sdxc/flags/client";
import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { WorkerKVFlagStore } from "@sdxc/flags-engine/store/worker-kv";

export let flags = createFlags({
	provider: () =>
		new EngineProvider(
			createEngine({ store: new WorkerKVFlagStore(env.FLAGS), maxAge: "5 minutes" }),
		),
});

let client = flags.getClient();

await client.boolean("new-checkout", false, { targetingKey: "user-1" });
```

## API

A path says what a module is: everything under `/store` is the one storage contract, and
`/provider` sits beside it because it consumes an engine rather than supplying one.

| Entry point                          | Contains                                                         |
| ------------------------------------ | ---------------------------------------------------------------- |
| `@sdxc/flags-engine`                 | The definition types, their schema, `evaluate` and `evaluateAll` |
| `@sdxc/flags-engine/store`           | The `FlagStore` interface and `FlagStoreError`                   |
| `@sdxc/flags-engine/store/memory`    | `InMemoryFlagStore`                                              |
| `@sdxc/flags-engine/store/worker-kv` | A store over a Cloudflare KV namespace                           |
| `@sdxc/flags-engine/conformance`     | The suite every store runs                                       |
| `@sdxc/flags-engine/provider`        | `EngineProvider`, the adapter onto `@sdxc/flags`                 |

### `FlagSet` and `FlagDefinition`

```typescript
interface FlagSet {
	flags: Record<string, FlagDefinition>;
	segments?: SegmentSet;
}

interface FlagDefinition {
	variants: Record<string, FlagValue>;
	defaultVariant?: string;
	state?: "enabled" | "disabled";
	targeting?: TargetingRule[];
	metadata?: FlagMetadata;
}
```

`variants` holds every value the flag can take, by name, and a flag declares at least one.
`targeting` is tried in order and the first match decides; when none matches, `defaultVariant`
is served. A flag declaring no `defaultVariant` answers with the value the caller passed, which
is how a flag exists to target a few subjects and leave everyone else on their own default. A
flag at `state: "disabled"` serves the caller's default too, so it is switched off with the
rules describing its rollout still written down. `metadata` travels onto every resolution of the
flag. The `state` union is exported as `FlagState`.

### `SegmentSet`

```typescript
type SegmentSet = Record<string, Condition>;
```

Conditions declared once and referenced by name, so "is an internal user" is written in one
place and read by twenty flags. A segment may reference another segment.

### `TargetingRule` and `Condition`

```typescript
interface TargetingRule {
	when: Condition;
	serve: string | Split;
}
```

`serve` is a variant name or the weights the rule buckets its subjects among.

Targeting is a typed union rather than an expression language, so an editor completes the
operator and a definition narrows on `op`:

| Condition                                              | Holds when                                             |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `{ op: "all", of: Condition[] }`                       | Every member holds                                     |
| `{ op: "any", of: Condition[] }`                       | Some member holds                                      |
| `{ op: "not", of: Condition }`                         | The member fails                                       |
| `{ op: "eq" \| "ne", field, value }`                   | The field equals, or differs from, a JSON primitive    |
| `{ op: "in" \| "notIn", field, values }`               | The list carries, or omits, the field's value          |
| `{ op: "lt" \| "lte" \| "gt" \| "gte", field, value }` | The field is a number standing in that relation        |
| `{ op: "startsWith" \| "endsWith", field, value }`     | The field is a string with that prefix or suffix       |
| `{ op: "contains", field, value }`                     | The field is a string carrying that substring          |
| `{ op: "matches", field, pattern }`                    | The field is a string the pattern matches              |
| `{ op: "semver", field, compare, value }`              | The field is a version standing in that relation       |
| `{ op: "exists", field }`                              | The path resolves to a value                           |
| `{ op: "segment", name }`                              | The named segment's condition holds                    |
| `{ op: "always" }`                                     | Every subject, which is what a blanket rollout matches |

`field` is a dotted path into the merged evaluation context, so `plan.tier` reads a nested
structure, `country` a scalar and `roles.0` an array element. A path that resolves to nothing
makes every operator except `exists` false, which keeps a rule about a field the caller left out
from matching everyone; `not` around such a rule holds, as it does around any condition that
fails.

Every operator compares within one type. `eq` on a string field against a number is false rather
than coerced, and `lt` against a value that is not a number is false.

`matches` compiles its pattern with the `v` flag, and a pattern that compiles elsewhere fails
its own flag at parse time.

### `SemVerComparison`

```typescript
type SemVerComparison = "=" | "!=" | "<" | "<=" | ">" | ">=" | "~" | "^";
```

How `semver` compares a version field against its value: `~` holds for a matching major and
minor, `^` for a matching major, and the other six read as they do in arithmetic.

### `Split`

```typescript
interface Split {
	weights: Record<string, number>;
	by?: string;
	seed?: string;
}
```

`weights` are whole, non-negative numbers taken against their own sum, so `{ on: 1, off: 1 }` is
a half-and-half split and one arm widens while the rest stay as written. Subjects are read from
`by`, defaulting to `targetingKey`, and hashed with the flag key — so the same subject lands in
the same arm on every request, in every isolate, and two flags at ten percent cover different
tenths. Two flags naming the same `seed` cover the same subjects instead.

A split needs a subject to hash. When the field it buckets on carries nothing, the evaluation
reports `TARGETING_KEY_MISSING` with the caller's default, so a rollout that reached nobody
reads as one.

### Reasons

Each outcome has exactly one cause, so a consumer reading `reason` alone tells a flag that is
off from a flag system that is broken:

| Outcome                                          | `reason`          | `errorCode`             |
| ------------------------------------------------ | ----------------- | ----------------------- |
| No targeting, and a `defaultVariant`             | `STATIC`          |                         |
| A rule matched and named a variant               | `TARGETING_MATCH` |                         |
| A rule matched and bucketed                      | `SPLIT`           |                         |
| Targeting ran and no rule matched                | `DEFAULT`         |                         |
| No `defaultVariant` to fall back to              | `DEFAULT`         |                         |
| `state: "disabled"`                              | `DISABLED`        |                         |
| No flag under that key                           | `ERROR`           | `FLAG_NOT_FOUND`        |
| The definition was refused at parse time         | `ERROR`           | `PARSE_ERROR`           |
| The variant holds another type                   | `ERROR`           | `TYPE_MISMATCH`         |
| A split found no value under its bucketing field | `ERROR`           | `TARGETING_KEY_MISSING` |
| An evaluation arrived before a load succeeded    | `ERROR`           | `PROVIDER_NOT_READY`    |

### `evaluate(snapshot, key, defaultValue, context?)`

Resolves one flag for one context, answering with the caller's own default whenever the
definition serves no value of the requested type. `defaultValue` is both the fallback and the
type every variant is checked against, so a string variant asked for as a boolean is
`TYPE_MISMATCH`.

```typescript
import { evaluate, parseFlagSet } from "@sdxc/flags-engine";

let snapshot = parseFlagSet({ flags: { beta: { variants: { on: true, off: false } } } });

evaluate(snapshot, "beta", false, { targetingKey: "user-1" });
```

### `evaluateAll(snapshot, context?)`

Resolves every flag the snapshot carries, the refused ones included, for a caller with no
per-flag default to fall back on. A flag producing no value of its own reports `null` beside the
reason.

```typescript
evaluateAll(snapshot, { targetingKey: "user-1" })["beta"];
// { value: true, reason: "STATIC", variant: "on" }
```

### `parseFlagSet(stored)`

Reads a `StoredFlagSet` into the `FlagSnapshot` evaluation runs against: segments resolved,
patterns compiled, variant names checked. It answers for any input at all, because each flag is
parsed on its own — a flag that is refused lands in `snapshot.failures` under its own key with
the reason, and every sibling lands in `snapshot.flags` ready to evaluate.

Parsing once per load is why the snapshot is a type of its own: evaluating a flag then walks a
structure already known to be well formed.

### `createEngine(options)`

Builds an engine over a store, holding definitions once `load` succeeds.

```typescript
let engine = createEngine({ store: new WorkerKVFlagStore(env.FLAGS), maxAge: "5 minutes" });
```

- `options.store` — where definitions are read from, and the whole of what the engine knows
  about storage.
- `options.maxAge` — how long a loaded snapshot counts as current, which is what `stale` is
  measured against. Given none, a snapshot stays current until a caller loads another.

The options object is exported as `EngineOptions`.

### `Engine`

```typescript
interface Engine {
	readonly snapshot: FlagSnapshot | undefined;
	readonly failures: readonly FlagParseFailure[];
	readonly stale: boolean;

	load(): MaybePromise<Result<FlagSnapshot, FlagStoreError>>;
	evaluate<T extends FlagValue>(
		key: string,
		defaultValue: T,
		context?: EvaluationContext,
	): ResolutionDetails<T>;
	evaluateAll(context?: EvaluationContext): Record<string, ResolutionDetails<FlagValue>>;
}
```

`load` reads the store, parses the set once, and keeps the snapshot for every evaluation that
follows; a store reading synchronously loads synchronously, and the answer is `await`-able
either way. It reports a `FlagStoreError` when the store could not hand its set over, which is a
configuration failure a caller reports rather than a flag falling back.

`evaluate` and `evaluateAll` delegate to the pure functions against the held snapshot, answering
with the caller's default under `PROVIDER_NOT_READY` until a load succeeds.

`failures` lists what the held set carried and the engine refused, so a caller logs them once
after a load. `stale` says whether the snapshot has aged past `maxAge`, and reads `true` on a
fresh engine, so one that wants a load reads as one.

Reloading is the caller's to schedule — on the next request, inside `waitUntil`, or from a cron
trigger — because a Worker has a timer only while a request is in flight.

### Snapshot types

`FlagSnapshot` carries `flags` and `failures` as maps keyed by flag key, the resolved
`segments`, the `version` the store called this revision, and the `createdAt` it was stamped at.
`CompiledFlag`, `CompiledRule`, `CompiledCondition` and `CompiledSegments` are the forms inside
it, and `FlagParseFailure` is a `{ key, message }` pair.

### Schemas

`FLAG_DEFINITION_SCHEMA`, `TARGETING_RULE_SCHEMA`, `CONDITION_SCHEMA`, `SPLIT_SCHEMA` and
`SEGMENT_SET_SCHEMA` are the parsers that turn stored JSON into definitions, and they are the
published contract for what a flag is. An admin UI validates a rule against the same schema
before writing what the engine would refuse. Each is a
[Standard Schema](https://standardschema.dev), so it reads through whichever validation library
the caller already has.

### `FlagStore` and `StoredFlagSet`

`@sdxc/flags-engine/store` — the contract between the engine and wherever definitions live.

```typescript
interface FlagStore {
	read(): MaybePromise<Result<StoredFlagSet, FlagStoreError>>;
}

interface StoredFlagSet {
	flags: Record<string, unknown>;
	segments?: Record<string, unknown>;
	version?: string;
}
```

One read that answers with the whole set, because segments are shared across flags and a store
is read once per snapshot. Values arrive as `unknown`: producing the JSON is the store's job and
deciding whether that JSON is a valid flag is the engine's, in one place against one schema.
`read` may answer synchronously, so a store already holding its set costs no promise.

Writing is each store's own business. Both shipped stores expose a `write`, which is where the
capability is used, and a store that is read-only — a JSON file bundled with the worker, a
remote endpoint — is a complete `FlagStore` as it stands.

### `FlagStoreError`

```typescript
new FlagStoreError("KV refused the get", { code: "unavailable", location: "flags", cause });
```

The normalized reason a store could not hand over its set, carried by every failed read.
`code` is `"unavailable"` when the storage could not be reached or refused the read, and
`"invalid_value"` when it answered with something that is not JSON. `location` names where the
store looked, and whatever the underlying storage threw travels as `cause`.

An empty store is a success holding an empty set, so reaching this type means the definitions
exist somewhere and could not be obtained.

### `InMemoryFlagStore`

`@sdxc/flags-engine/store/memory` — holds one definition set in an object, for tests and for a
set compiled into the worker that reads it.

```typescript
let store = new InMemoryFlagStore({ flags: { beta: { variants: { on: true, off: false } } } });

store.read(); // synchronous, always a success
store.write({ flags: {} }); // replaces the whole set
```

Every read hands over a copy, so a caller walking a set keeps reading what it read while the
store goes on being written to. Constructed without a set, it starts out empty.

### `WorkerKVFlagStore`

`@sdxc/flags-engine/store/worker-kv` — keeps the whole definition set as one JSON value under
one key in a [Cloudflare KV](https://developers.cloudflare.com/kv/) namespace, so filling a
snapshot is a single `get` served from the edge cache.

```typescript
let store = new WorkerKVFlagStore(env.FLAGS);
let scoped = new WorkerKVFlagStore(env.FLAGS, { key: "flags:staging" });

await store.read();
await store.write({ flags: { beta: { variants: { on: true, off: false } } } });
```

- `options.key` — the key the whole set is stored under. Defaults to `"flags"`, and an
  application holding more than one set gives each of them its own. It is readable back off the
  instance as `store.key`.

A key holding nothing reads as an empty set, so a namespace an admin has yet to write to is a
working store. A value that is not a JSON object reports `invalid_value`, and a namespace that
refused the call reports `unavailable`. `write` replaces the whole value and reports the same
two codes.

### `conformance(options)`

`@sdxc/flags-engine/conformance` — registers the suite that says what a flag store is, as Vitest
tests against whatever you construct. Run it against a store and the suite says whether it is
one.

```typescript
import { conformance } from "@sdxc/flags-engine/conformance";
import { WorkerKVFlagStore } from "@sdxc/flags-engine/store/worker-kv";

conformance({
	name: "WorkerKVFlagStore",
	create: () => new WorkerKVFlagStore(env.FLAGS),
	seed: (store, set) => env.FLAGS.put(store.key, JSON.stringify(set)),
	write: (store, set) => store.write(set),
	writeText: (store, text) => env.FLAGS.put(store.key, text),
});
```

- `name` — labels the registered suite.
- `create` — builds the store under test, holding nothing. Called for every test, so a store
  over shared storage points each one at a location of its own.
- `seed` — puts a set where the store reads it from, by whatever means the storage gives. A
  read-only store seeds through the file, endpoint or object behind it.
- `write` — stores a set through the store's own write. Supplying it registers the round trip
  assertions, which say a store reads back what it was told to hold.
- `writeText` — puts text where the store reads it from, in place of anything the store would
  serialize. Supplying it registers the assertions about a value the store did not write.

### `EngineProvider`

`@sdxc/flags-engine/provider` — implements the `Provider` interface of
[`@sdxc/flags`](https://www.npmjs.com/package/@sdxc/flags) over an engine and nothing else.

```typescript
let provider = new EngineProvider(createEngine({ store, maxAge: "5 minutes" }));

await provider.initialize(); // PROVIDER_READY, or PROVIDER_ERROR and a throw
await provider.refresh(); // Result<FlagSnapshot, FlagStoreError>
```

It holds no rules, no hash and no schema, which is the demonstration that the engine is usable
on its own: the four resolvers hand their type to `engine.evaluate` and return what it answers,
so a flag the engine reports as `PROVIDER_NOT_READY` or `TYPE_MISMATCH` arrives that way here.

- `initialize` loads the store and emits `PROVIDER_READY`. A store it cannot read emits
  `PROVIDER_ERROR` and throws a `ProviderError` carrying the `FlagStoreError` as its `cause`,
  coded `PARSE_ERROR` for a value that is not a set and `GENERAL` for a store out of reach.
- `refresh` loads again and emits `PROVIDER_CONFIGURATION_CHANGED`, naming every key either
  snapshot answered for — definitions that failed to parse included, since those answer under
  their own key too, so a per-key cache drops exactly what moved.
- `refresh` answers with a `Result` rather than throwing, which is what makes it callable from a
  scheduled reload where a failure is something to log rather than to propagate.
- A reload that fails over an aged snapshot emits `PROVIDER_STALE` once, so an application reads
  ageing definitions off the status channel. The next successful reload returns the provider to
  `PROVIDER_READY`.

`metadata.name` is `"flags-engine"`.

## Pattern: Reloading on a schedule you own

The engine holds a snapshot and reports `stale`; deciding when to read the store again is the
caller's, so put the reload wherever the runtime gives you time for it. Answering the request
from the snapshot in hand and refreshing behind the response keeps evaluation off the read:

```typescript
let engine = createEngine({ store: new WorkerKVFlagStore(env.FLAGS), maxAge: "5 minutes" });

export default {
	async fetch(request, env, ctx) {
		if (engine.stale) ctx.waitUntil(Promise.resolve(engine.load()));

		let enabled = engine.evaluate("new-checkout", false, { targetingKey: userId(request) });

		return new Response(enabled.value ? "new" : "old");
	},
};
```

A cron trigger is the other placement: reload there, and every request reads a snapshot someone
else already paid for.

## Pattern: Logging the definitions that were refused

A definition that is refused costs its own flag and leaves every sibling resolving. The refusals
sit on the engine after a load, which is where they are logged once rather than once per
evaluation of the key:

```typescript
let loaded = await engine.load();

if (isFailure(loaded)) logger.error("flags unavailable", { cause: loaded.error });

for (let failure of engine.failures) {
	logger.warn("flag definition refused", { key: failure.key, reason: failure.message });
}
```

`isFailure` comes from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which is
what `load` answers with.

## Pattern: A store of your own

The interface is one method, so a store against your own tables is a file rather than a project.
Scoping belongs in the store while it is there — one constructed for a tenant reads that
tenant's flags, and the engine never learns a tenant exists:

```typescript
import type { FlagStore, StoredFlagSet } from "@sdxc/flags-engine/store";
import type { Result } from "@sdxc/result";

import { FlagStoreError } from "@sdxc/flags-engine/store";
import { failure, success } from "@sdxc/result";

export class TenantFlagStore implements FlagStore {
	constructor(readonly tenantId: string) {}

	async read(): Promise<Result<StoredFlagSet, FlagStoreError>> {
		try {
			let row = await db.flagSets.findByTenant(this.tenantId);

			return success(row?.set ?? { flags: {} });
		} catch (cause) {
			return failure(
				new FlagStoreError(`The database refused the read for ${this.tenantId}`, {
					code: "unavailable",
					location: this.tenantId,
					cause,
				}),
			);
		}
	}
}
```

Then point the conformance suite at it, giving each test a tenant of its own:

```typescript
conformance({
	name: "TenantFlagStore",
	create: () => new TenantFlagStore(randomUUID()),
	seed: (store, set) => db.flagSets.upsert(store.tenantId, set),
});
```

## Pattern: Previewing a rule before it ships

Evaluation is pure, so an admin UI answers "who would this rule serve" by parsing the edited set
and evaluating it against a context typed into a form — no store, no engine, nothing kept:

```typescript
import type { EvaluationContext } from "@sdxc/flags";
import type { StoredFlagSet } from "@sdxc/flags-engine/store";

import { evaluateAll, parseFlagSet } from "@sdxc/flags-engine";

function preview(set: StoredFlagSet, context: EvaluationContext) {
	return evaluateAll(parseFlagSet(set), context);
}

preview(edited, { targetingKey: "user-1", plan: { tier: "pro" } })["new-checkout"];
// { value: true, reason: "TARGETING_MATCH", variant: "on" }
```

Validating the edit before it is stored uses the same schemas the engine parses with, so the UI
refuses exactly what the engine would:

```typescript
import { FLAG_DEFINITION_SCHEMA } from "@sdxc/flags-engine";
import * as s from "remix/data-schema";

let checked = s.parseSafe(FLAG_DEFINITION_SCHEMA, draft);
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written
`YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out
per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/flags-engine": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later
release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
